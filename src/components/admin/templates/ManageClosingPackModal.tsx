import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { X, Loader2 } from 'lucide-react'
import { Portal } from '../../ui/Portal'
import { SortableSlideItem } from './SortableSlideItem'
import { SlideDropZone } from './SlideDropZone'
import { FieldEditor } from './FieldEditor'
import { supabase } from '../../../lib/supabase'
import { getSlideUrl } from '../../../lib/storage'
import { uploadSlides, replaceSingleSlide, deleteSlideFile } from '../../../lib/upload'
import { logAudit } from '../../../lib/audit'
import { logger } from '../../../lib/logger'
import { useToast } from '../../ui/Toast'
import type { DbRegion, DbClosingPack, DbClosingSlide, EditableFieldDef } from '../../../types'
import type { UploadProgress } from '../../../lib/upload'

/** Robustly extract EditableFieldDef[] from whatever Supabase returns for a JSONB column */
function parseEditableFields(raw: unknown): EditableFieldDef[] {
  if (!raw) return []

  // Direct array (normal JSONB return)
  if (Array.isArray(raw)) return raw as EditableFieldDef[]

  // String (double-encoded or text column) — parse and check
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as EditableFieldDef[]
    } catch { /* ignore parse errors */ }
    return []
  }

  // Object — might be wrapped like {fields: [...]} or {0: {...}, 1: {...}}
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.fields)) return obj.fields as EditableFieldDef[]
    if (Array.isArray(obj.data)) return obj.data as EditableFieldDef[]
    if ('0' in obj) {
      const arr = Object.values(obj)
      if (arr.length > 0 && typeof arr[0] === 'object') return arr as EditableFieldDef[]
    }
  }

  logger.warn('[parseEditableFields] Unrecognized format:', typeof raw, raw)
  return []
}

interface ManageClosingPackModalProps {
  region: DbRegion
  userId: string
  onClose: () => void
  onRefresh: () => Promise<void>
}

interface SlideItem {
  id: string
  dbId: string | null
  slideNumber: number
  imagePath: string
  editableFields: EditableFieldDef[]
}

export function ManageClosingPackModal({ region, userId, onClose, onRefresh }: ManageClosingPackModalProps) {
  const { addToast } = useToast()
  const [closingPack, setClosingPack] = useState<DbClosingPack | null>(null)
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [replacingSlide, setReplacingSlide] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [hasReordered, setHasReordered] = useState(false)
  // Field editor state — snapshots captured at click time so refetches can't clobber them
  const [editingFieldsSlide, setEditingFieldsSlide] = useState<SlideItem | null>(null)
  const [editingInitialFields, setEditingInitialFields] = useState<EditableFieldDef[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const storagePath = `closing-${region.id}`

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)

    // Get or create closing pack for this region
    let { data: pack } = await supabase
      .from('closing_packs')
      .select('*')
      .eq('region_id', region.id)
      .eq('is_active', true)
      .single()

    if (!pack) {
      const { data: newPack } = await supabase
        .from('closing_packs')
        .insert({ region_id: region.id, name: `${region.display_name} Closing Pack` })
        .select('*')
        .single()
      pack = newPack
    }

    if (pack) {
      setClosingPack(pack as DbClosingPack)

      // Fetch slides via Edge Function (service role) to bypass RLS
      logger.log('[fetchData] Calling get-slide-fields with parentId:', pack.id)
      let dbSlides: DbClosingSlide[] = []
      try {
        const { data: fnResult, error: fnError } = await supabase.functions.invoke('get-slide-fields', {
          body: { slideType: 'closing', parentId: pack.id },
        })

        logger.log('[fetchData] get-slide-fields response — error:', fnError, '| data type:', typeof fnResult, '| data:', JSON.stringify(fnResult)?.slice(0, 500))

        if (fnError) {
          logger.error('[fetchData] get-slide-fields error:', fnError)
        } else if (fnResult?.slides && Array.isArray(fnResult.slides)) {
          dbSlides = fnResult.slides as DbClosingSlide[]
        } else if (Array.isArray(fnResult)) {
          dbSlides = fnResult as DbClosingSlide[]
        }
      } catch (fetchErr) {
        logger.error('[fetchData] get-slide-fields exception:', fetchErr)
      }

      logger.log('[fetchData] Parsed dbSlides count:', dbSlides.length, dbSlides.length > 0 ? '| first slide id: ' + dbSlides[0]?.id + ', fields: ' + (Array.isArray(dbSlides[0]?.editable_fields) ? dbSlides[0].editable_fields.length : 0) : '')
      const dbMap = new Map(dbSlides.map((s) => [s.slide_number, s]))

      // Use whichever is larger: DB record count or closing_slides_count
      const totalSlides = Math.max(dbSlides.length, region.closing_slides_count)

      if (totalSlides > 0) {
        setSlides(
          Array.from({ length: totalSlides }, (_, i) => {
            const num = i + 1
            const db = dbMap.get(num)
            const fields = parseEditableFields(db?.editable_fields)
            return {
              id: `slide-${num}`,
              dbId: db?.id ?? null,
              slideNumber: num,
              imagePath: db?.image_path || `${storagePath}/Slide${num}.PNG`,
              editableFields: fields,
            }
          })
        )
      } else {
        setSlides([])
      }
    }

    setLoading(false)
  }, [region, storagePath])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Escape key to close (only when FieldEditor is not open)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !editingFieldsSlide) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingFieldsSlide, onClose])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSlides((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id)
        const newIndex = prev.findIndex((s) => s.id === over.id)
        setHasReordered(true)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  async function handleBulkUpload(files: File[], replaceAll: boolean) {
    if (files.length === 0 || !closingPack) return

    setUploading(true)
    setUploadProgress({ total: files.length, completed: 0, currentFile: '' })

    const existingCount = slides.length
    const startNumber = replaceAll ? 1 : existingCount + 1
    const results = await uploadSlides(files, storagePath, startNumber, setUploadProgress)

    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      logger.error('Upload errors:', errors)
    }

    const successfulUploads = results.filter((r) => !r.error)

    if (successfulUploads.length === 0) {
      addToast('error', 'All uploads failed — no slides were added')
      setUploading(false)
      setUploadProgress(null)
      return
    }

    if (replaceAll) {
      // Delete existing slide records for this pack
      await supabase.from('closing_slides').delete().eq('closing_pack_id', closingPack.id)
    }

    // Create new slide records
    const records = successfulUploads.map((r) => ({
      closing_pack_id: closingPack.id,
      slide_number: r.slideNumber,
      title: `Slide ${r.slideNumber}`,
      slide_type: 'static' as const,
      image_path: r.path,
    }))
    const { error: insertError } = await supabase.from('closing_slides').insert(records)

    if (insertError) {
      logger.error('Failed to insert closing_slides records:', insertError)
      addToast('error', `Failed to save slide records: ${insertError.message}`)
      setUploading(false)
      setUploadProgress(null)
      return
    }

    // Update slide count on regions table
    const newTotal = replaceAll ? successfulUploads.length : existingCount + successfulUploads.length
    await supabase
      .from('regions')
      .update({ closing_slides_count: newTotal })
      .eq('id', region.id)

    await logAudit('slide_bulk_uploaded', 'closing_pack', region.id, {
      slides_uploaded: successfulUploads.length,
      errors: errors.length,
      mode: replaceAll ? 'replace' : 'append',
    }, userId)

    setUploading(false)
    setUploadProgress(null)
    setHasReordered(false)

    // Optimistically add new slides to local state so they appear immediately
    if (!replaceAll) {
      setSlides((prev) => [
        ...prev,
        ...successfulUploads.map((r) => ({
          id: `slide-${r.slideNumber}`,
          dbId: null as string | null,
          slideNumber: r.slideNumber,
          imagePath: r.path,
          editableFields: [] as EditableFieldDef[],
        })),
      ])
    }

    addToast('success', `${successfulUploads.length} slide${successfulUploads.length !== 1 ? 's' : ''} uploaded successfully`)

    await onRefresh()
    // Silent refresh to sync dbIds and authoritative data without showing spinner
    await fetchData(true)
  }

  async function handleReplaceSlide(slideNumber: number, file: File) {
    setReplacingSlide(slideNumber)

    const result = await replaceSingleSlide(file, storagePath, slideNumber)

    if (!result.error) {
      await logAudit('slide_replaced', 'closing_pack', region.id, {
        slide_number: slideNumber,
      }, userId)

      // Force thumbnail refresh by updating state with cache-bust
      setSlides((prev) =>
        prev.map((s) =>
          s.slideNumber === slideNumber
            ? { ...s, imagePath: `${storagePath}/Slide${slideNumber}.PNG?t=${Date.now()}` }
            : s
        )
      )
    }

    setReplacingSlide(null)
  }

  async function handleDeleteSlide(slideNumber: number) {
    if (!closingPack) return

    await deleteSlideFile(storagePath, slideNumber)

    // Delete the DB record
    await supabase
      .from('closing_slides')
      .delete()
      .eq('closing_pack_id', closingPack.id)
      .eq('slide_number', slideNumber)

    await logAudit('slide_deleted', 'closing_pack', region.id, {
      slide_number: slideNumber,
    }, userId)

    // Remove from local state and renumber
    setSlides((prev) => {
      const filtered = prev.filter((s) => s.slideNumber !== slideNumber)
      return filtered.map((s, i) => ({
        ...s,
        id: `slide-${i + 1}`,
        slideNumber: i + 1,
      }))
    })

    // Update count
    const newCount = slides.length - 1
    await supabase
      .from('regions')
      .update({ closing_slides_count: newCount })
      .eq('id', region.id)

    await onRefresh()
  }

  async function handleSaveFields(slideItem: SlideItem, fields: EditableFieldDef[]): Promise<{ success: boolean; error?: string }> {
    logger.log('[SaveFields] === START (Edge Function) ===')
    logger.log('[SaveFields] slideItem:', { dbId: slideItem.dbId, slideNumber: slideItem.slideNumber })
    logger.log('[SaveFields] fields to save (count=' + fields.length + '):', JSON.stringify(fields))

    try {
      const payload = {
        slideType: 'closing' as const,
        slideId: slideItem.dbId,
        editableFields: fields,
        parentId: closingPack?.id,
        slideNumber: slideItem.slideNumber,
        imagePath: slideItem.imagePath,
      }
      logger.log('[SaveFields] Invoking save-slide-fields with:', JSON.stringify(payload))

      const { data, error } = await supabase.functions.invoke('save-slide-fields', {
        body: payload,
      })

      logger.log('[SaveFields] Edge Function response — data:', JSON.stringify(data), '| error:', JSON.stringify(error))

      if (error) {
        const msg = typeof error === 'object' && 'message' in error ? (error as { message: string }).message : String(error)
        logger.error('[SaveFields] Edge Function network/invoke error:', msg)
        return { success: false, error: msg }
      }

      if (data?.error) {
        logger.error('[SaveFields] Server returned error:', data.error)
        return { success: false, error: data.error }
      }

      const savedRow = data?.data
      const newDbId = savedRow?.id || slideItem.dbId

      logger.log('[SaveFields] Success — saved row id:', newDbId, 'editable_fields count:', Array.isArray(savedRow?.editable_fields) ? savedRow.editable_fields.length : 'N/A')

      // Update local state — this keeps the badge correct without refetching
      setSlides((prev) =>
        prev.map((s) =>
          s.slideNumber === slideItem.slideNumber
            ? { ...s, editableFields: fields, dbId: newDbId }
            : s
        )
      )

      await logAudit('editable_fields_updated', 'closing_pack', region.id, {
        slide_number: slideItem.slideNumber,
        field_count: fields.length,
      }, userId)

      logger.log('[SaveFields] === DONE — success ===')
      return { success: true }
    } catch (err) {
      logger.error('[SaveFields] === EXCEPTION ===', err)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  async function handleSaveOrder() {
    if (!closingPack || !hasReordered) return
    setSaving(true)

    // Update slide_number for each slide based on new position
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      if (slide.dbId) {
        await supabase
          .from('closing_slides')
          .update({ slide_number: i + 1 })
          .eq('id', slide.dbId)
      }
    }

    await logAudit('slide_reordered', 'closing_pack', region.id, {
      new_order: slides.map((s, i) => ({ original: s.slideNumber, newPosition: i + 1 })),
    }, userId)

    setHasReordered(false)
    setSaving(false)
    await onRefresh()
    await fetchData()
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h3 className="font-heading font-semibold text-hoxton-deep">
                {region.display_name} — Closing Pack
              </h3>
              <p className="text-sm font-body text-gray-400">
                {slides.length} slides
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-hoxton-turquoise" />
              </div>
            ) : (
              <>
                {/* Drop zone / upload area */}
                <SlideDropZone
                  existingSlideCount={slides.length}
                  uploading={uploading}
                  uploadProgress={uploadProgress}
                  onUpload={handleBulkUpload}
                />

                {/* Slide list */}
                {slides.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                      Slides
                    </h4>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={slides.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {slides.map((slide, idx) => (
                            <SortableSlideItem
                              key={slide.id}
                              id={slide.id}
                              slideNumber={slide.slideNumber}
                              index={idx}
                              total={slides.length}
                              imageSrc={getSlideUrl(slide.imagePath)}
                              onReplace={(file) => handleReplaceSlide(slide.slideNumber, file)}
                              onDelete={() => handleDeleteSlide(slide.slideNumber)}
                              onEditFields={() => {
                                logger.log('[ClosingPackModal] Fields clicked — slide:', JSON.stringify({ id: slide.id, dbId: slide.dbId, slideNumber: slide.slideNumber, fieldsCount: slide.editableFields.length }))
                                setEditingFieldsSlide(slide)
                                setEditingInitialFields([...slide.editableFields])
                              }}
                              fieldCount={slide.editableFields.length}
                              isReplacing={replacingSlide === slide.slideNumber}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-heading font-medium text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep"
            >
              Close
            </button>
            {hasReordered && (
              <button
                onClick={handleSaveOrder}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Order
              </button>
            )}
          </div>
        </div>
      </div>

      {editingFieldsSlide && (
        <FieldEditor
          key={`closing-${editingFieldsSlide.slideNumber}`}
          slideImageUrl={getSlideUrl(editingFieldsSlide.imagePath)}
          slideLabel={`${region.display_name} Closing — Slide ${editingFieldsSlide.slideNumber}`}
          initialFields={editingInitialFields}
          onSave={(fields) => handleSaveFields(editingFieldsSlide, fields)}
          onClose={() => setEditingFieldsSlide(null)}
        />
      )}
    </Portal>
  )
}
