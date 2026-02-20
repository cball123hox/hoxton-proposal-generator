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
import { X, Upload, Loader2 } from 'lucide-react'
import { Portal } from '../../ui/Portal'
import { SortableSlideItem } from './SortableSlideItem'
import { SlideDropZone } from './SlideDropZone'
import { FieldEditor } from './FieldEditor'
import { supabase } from '../../../lib/supabase'
import { getSlideUrl } from '../../../lib/storage'
import { uploadSlides, replaceSingleSlide, deleteSlideFile } from '../../../lib/upload'
import { logAudit } from '../../../lib/audit'
import type { DbRegion, DbIntroPack, DbIntroSlide, EditableFieldDef } from '../../../types'
import type { UploadProgress } from '../../../lib/upload'

interface ManageIntroPackModalProps {
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

export function ManageIntroPackModal({ region, userId, onClose, onRefresh }: ManageIntroPackModalProps) {
  const [introPack, setIntroPack] = useState<DbIntroPack | null>(null)
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [replacingSlide, setReplacingSlide] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [hasReordered, setHasReordered] = useState(false)
  const [editingFieldsSlide, setEditingFieldsSlide] = useState<SlideItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const storagePath = `intro-${region.id}`

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Get or create intro pack for this region
    let { data: pack } = await supabase
      .from('intro_packs')
      .select('*')
      .eq('region_id', region.id)
      .eq('is_active', true)
      .single()

    if (!pack) {
      const { data: newPack } = await supabase
        .from('intro_packs')
        .insert({ region_id: region.id, name: `${region.display_name} Intro Pack` })
        .select('*')
        .single()
      pack = newPack
    }

    if (pack) {
      setIntroPack(pack as DbIntroPack)

      const { data: slideData } = await supabase
        .from('intro_slides')
        .select('*')
        .eq('intro_pack_id', pack.id)
        .order('slide_number')

      if (slideData && slideData.length > 0) {
        setSlides(
          (slideData as DbIntroSlide[]).map((s) => ({
            id: `slide-${s.slide_number}`,
            dbId: s.id,
            slideNumber: s.slide_number,
            imagePath: s.image_path || `${storagePath}/Slide${s.slide_number}.PNG`,
            editableFields: Array.isArray(s.editable_fields) ? s.editable_fields : [],
          }))
        )
      } else if (region.intro_slides_count > 0) {
        // DB records missing but count exists — build from count
        setSlides(
          Array.from({ length: region.intro_slides_count }, (_, i) => ({
            id: `slide-${i + 1}`,
            dbId: null,
            slideNumber: i + 1,
            imagePath: `${storagePath}/Slide${i + 1}.PNG`,
            editableFields: [],
          }))
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

  async function handleBulkUpload(files: File[]) {
    if (files.length === 0 || !introPack) return

    setUploading(true)
    setUploadProgress({ total: files.length, completed: 0, currentFile: '' })

    const results = await uploadSlides(files, storagePath, 1, setUploadProgress)

    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      console.error('Upload errors:', errors)
    }

    const successfulUploads = results.filter((r) => !r.error)

    // Delete existing slide records for this pack
    await supabase.from('intro_slides').delete().eq('intro_pack_id', introPack.id)

    // Create new slide records
    if (successfulUploads.length > 0) {
      const records = successfulUploads.map((r) => ({
        intro_pack_id: introPack.id,
        slide_number: r.slideNumber,
        title: `Slide ${r.slideNumber}`,
        slide_type: 'static' as const,
        image_path: r.path,
      }))
      await supabase.from('intro_slides').insert(records)
    }

    // Update slide count on regions table
    await supabase
      .from('regions')
      .update({ intro_slides_count: successfulUploads.length })
      .eq('id', region.id)

    await logAudit('slide_bulk_uploaded', 'intro_pack', region.id, {
      slides_uploaded: successfulUploads.length,
      errors: errors.length,
    }, userId)

    setUploading(false)
    setUploadProgress(null)
    setHasReordered(false)

    await onRefresh()
    await fetchData()
  }

  async function handleReplaceSlide(slideNumber: number, file: File) {
    setReplacingSlide(slideNumber)

    const result = await replaceSingleSlide(file, storagePath, slideNumber)

    if (!result.error) {
      await logAudit('slide_replaced', 'intro_pack', region.id, {
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
    if (!introPack) return

    await deleteSlideFile(storagePath, slideNumber)

    // Delete the DB record
    await supabase
      .from('intro_slides')
      .delete()
      .eq('intro_pack_id', introPack.id)
      .eq('slide_number', slideNumber)

    await logAudit('slide_deleted', 'intro_pack', region.id, {
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
      .update({ intro_slides_count: newCount })
      .eq('id', region.id)

    await onRefresh()
  }

  async function handleSaveFields(slideItem: SlideItem, fields: EditableFieldDef[]) {
    setSlides((prev) =>
      prev.map((s) =>
        s.slideNumber === slideItem.slideNumber ? { ...s, editableFields: fields } : s
      )
    )

    if (slideItem.dbId) {
      await supabase
        .from('intro_slides')
        .update({
          editable_fields: fields as unknown as Record<string, unknown>[],
          slide_type: fields.length > 0 ? 'editable' : 'static',
        })
        .eq('id', slideItem.dbId)

      await logAudit('editable_fields_updated', 'intro_pack', region.id, {
        slide_number: slideItem.slideNumber,
        field_count: fields.length,
      }, userId)
    }
  }

  async function handleSaveOrder() {
    if (!introPack || !hasReordered) return
    setSaving(true)

    // Update slide_number for each slide based on new position
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      if (slide.dbId) {
        await supabase
          .from('intro_slides')
          .update({ slide_number: i + 1 })
          .eq('id', slide.dbId)
      }
    }

    await logAudit('slide_reordered', 'intro_pack', region.id, {
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
                {region.display_name} — Intro Pack
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
                              onEditFields={() => setEditingFieldsSlide(slide)}
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
          slideImageUrl={getSlideUrl(editingFieldsSlide.imagePath)}
          slideLabel={`${region.display_name} Intro — Slide ${editingFieldsSlide.slideNumber}`}
          initialFields={editingFieldsSlide.editableFields}
          onSave={(fields) => handleSaveFields(editingFieldsSlide, fields)}
          onClose={() => setEditingFieldsSlide(null)}
        />
      )}
    </Portal>
  )
}
