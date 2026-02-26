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
import { X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Portal } from '../../ui/Portal'
import { SortableSlideItem } from './SortableSlideItem'
import { SlideDropZone } from './SlideDropZone'
import { FieldEditor } from './FieldEditor'
import { supabase } from '../../../lib/supabase'
import { getSlideUrl } from '../../../lib/storage'
import { uploadSlides, replaceSingleSlide, deleteSlideFile } from '../../../lib/upload'
import { logAudit } from '../../../lib/audit'
import { logger } from '../../../lib/logger'
import type { DbProductModule, DbProductSlide, DbRegion, EditableFieldDef } from '../../../types'
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

interface ManageProductModalProps {
  module: DbProductModule
  regions: DbRegion[]
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

export function ManageProductModal({ module: mod, regions, userId, onClose, onRefresh }: ManageProductModalProps) {
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [managedRegions, setManagedRegions] = useState<string[]>([...mod.regions])
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

  const storagePath = `products/${mod.id}`

  const fetchSlides = useCallback(async () => {
    setLoading(true)

    // Fetch slides via Edge Function (service role) to bypass RLS
    logger.log('[fetchSlides] Calling get-slide-fields with parentId:', mod.id)
    let dbSlides: DbProductSlide[] = []
    try {
      const { data: fnResult, error: fnError } = await supabase.functions.invoke('get-slide-fields', {
        body: { slideType: 'product', parentId: mod.id },
      })

      logger.log('[fetchSlides] get-slide-fields response — error:', fnError, '| data type:', typeof fnResult, '| data:', JSON.stringify(fnResult)?.slice(0, 500))

      if (fnError) {
        logger.error('[fetchSlides] get-slide-fields error:', fnError)
      } else if (fnResult?.slides && Array.isArray(fnResult.slides)) {
        dbSlides = fnResult.slides as DbProductSlide[]
      } else if (Array.isArray(fnResult)) {
        dbSlides = fnResult as DbProductSlide[]
      }
    } catch (fetchErr) {
      logger.error('[fetchSlides] get-slide-fields exception:', fetchErr)
    }

    logger.log('[fetchSlides] Parsed dbSlides count:', dbSlides.length, dbSlides.length > 0 ? '| first slide id: ' + dbSlides[0]?.id + ', fields: ' + (Array.isArray(dbSlides[0]?.editable_fields) ? dbSlides[0].editable_fields.length : 0) : '')
    const dbMap = new Map(dbSlides.map((s) => [s.slide_number, s]))

    // Use whichever is larger: DB record count or slides_count
    const totalSlides = Math.max(dbSlides.length, mod.slides_count)

    if (totalSlides > 0) {
      setSlides(
        Array.from({ length: totalSlides }, (_, i) => {
          const num = i + 1
          const db = dbMap.get(num)
          // Parse editable_fields — handle JSONB returned as array, object, or string
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

    setLoading(false)
  }, [mod.id, mod.slides_count, storagePath])

  useEffect(() => {
    fetchSlides()
  }, [fetchSlides])

  // Escape key to close (only when FieldEditor is not open)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !editingFieldsSlide) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingFieldsSlide, onClose])

  function toggleRegion(regionId: string) {
    setManagedRegions((prev) =>
      prev.includes(regionId)
        ? prev.filter((r) => r !== regionId)
        : [...prev, regionId]
    )
  }

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
    if (files.length === 0) return

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

    if (replaceAll) {
      // Delete existing slide records
      await supabase.from('product_slides').delete().eq('module_id', mod.id)
    }

    // Create new slide records
    if (successfulUploads.length > 0) {
      const records = successfulUploads.map((r) => ({
        module_id: mod.id,
        slide_number: r.slideNumber,
        title: `Slide ${r.slideNumber}`,
        slide_type: 'static' as const,
        image_path: r.path,
      }))
      await supabase.from('product_slides').insert(records)
    }

    // Update slide count
    const newTotal = replaceAll ? successfulUploads.length : existingCount + successfulUploads.length
    await supabase
      .from('product_modules')
      .update({ slides_count: newTotal })
      .eq('id', mod.id)

    await logAudit('slide_bulk_uploaded', 'product_module', mod.id, {
      slides_uploaded: successfulUploads.length,
      errors: errors.length,
      mode: replaceAll ? 'replace' : 'append',
    }, userId)

    setUploading(false)
    setUploadProgress(null)
    setHasReordered(false)

    await onRefresh()
    await fetchSlides()
  }

  async function handleReplaceSlide(slideNumber: number, file: File) {
    setReplacingSlide(slideNumber)

    const result = await replaceSingleSlide(file, storagePath, slideNumber)

    if (!result.error) {
      await logAudit('slide_replaced', 'product_module', mod.id, {
        slide_number: slideNumber,
      }, userId)

      // Force thumbnail refresh with cache-bust
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
    await deleteSlideFile(storagePath, slideNumber)

    // Delete DB record
    await supabase
      .from('product_slides')
      .delete()
      .eq('module_id', mod.id)
      .eq('slide_number', slideNumber)

    await logAudit('slide_deleted', 'product_module', mod.id, {
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
      .from('product_modules')
      .update({ slides_count: newCount })
      .eq('id', mod.id)

    await onRefresh()
  }

  async function handleSave() {
    setSaving(true)

    // Save region changes
    const sortedOld = [...mod.regions].sort()
    const sortedNew = [...managedRegions].sort()
    if (JSON.stringify(sortedOld) !== JSON.stringify(sortedNew)) {
      await supabase
        .from('product_modules')
        .update({ regions: managedRegions })
        .eq('id', mod.id)

      await logAudit('module_updated', 'product_module', mod.id, {
        old_regions: mod.regions,
        new_regions: managedRegions,
      }, userId)
    }

    // Save reorder
    if (hasReordered) {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        if (slide.dbId) {
          await supabase
            .from('product_slides')
            .update({ slide_number: i + 1 })
            .eq('id', slide.dbId)
        }
      }

      await logAudit('slide_reordered', 'product_module', mod.id, {
        new_order: slides.map((s, i) => ({ original: s.slideNumber, newPosition: i + 1 })),
      }, userId)
    }

    setSaving(false)
    setHasReordered(false)
    await onRefresh()
    onClose()
  }

  async function handleSaveFields(slideItem: SlideItem, fields: EditableFieldDef[]): Promise<{ success: boolean; error?: string }> {
    logger.log('[SaveFields] === START (Edge Function) ===')
    logger.log('[SaveFields] slideItem:', { dbId: slideItem.dbId, slideNumber: slideItem.slideNumber })
    logger.log('[SaveFields] fields to save (count=' + fields.length + '):', JSON.stringify(fields))

    try {
      const payload = {
        slideType: 'product' as const,
        slideId: slideItem.dbId,
        editableFields: fields,
        parentId: mod.id,
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

      await logAudit('editable_fields_updated', 'product_module', mod.id, {
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

  const hasChanges = hasReordered || JSON.stringify([...mod.regions].sort()) !== JSON.stringify([...managedRegions].sort())

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
                {mod.name}
              </h3>
              <p className="text-sm font-body text-gray-400">
                {slides.length} slides &middot; {mod.category}
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
                {/* Region toggles */}
                <div className="mb-6">
                  <h4 className="mb-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Enabled Regions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {regions.map((region) => {
                      const enabled = managedRegions.includes(region.id)
                      return (
                        <button
                          key={region.id}
                          onClick={() => toggleRegion(region.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-heading font-medium transition-all ${
                            enabled
                              ? 'border-hoxton-turquoise bg-hoxton-turquoise/5 text-hoxton-deep'
                              : 'border-gray-200 text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          {enabled ? (
                            <ToggleRight className="h-4 w-4 text-hoxton-turquoise" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                          {region.display_name}
                        </button>
                      )
                    })}
                  </div>
                </div>

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
                                logger.log('[ProductModal] Fields clicked — slide:', JSON.stringify({ id: slide.id, dbId: slide.dbId, slideNumber: slide.slideNumber, fieldsCount: slide.editableFields.length }))
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
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {editingFieldsSlide && (
        <FieldEditor
          key={`product-${editingFieldsSlide.slideNumber}`}
          slideImageUrl={getSlideUrl(editingFieldsSlide.imagePath)}
          slideLabel={`${mod.name} — Slide ${editingFieldsSlide.slideNumber}`}
          initialFields={editingInitialFields}
          onSave={(fields) => handleSaveFields(editingFieldsSlide, fields)}
          onClose={() => setEditingFieldsSlide(null)}
        />
      )}
    </Portal>
  )
}
