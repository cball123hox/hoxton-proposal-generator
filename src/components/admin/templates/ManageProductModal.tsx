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
import type { DbProductModule, DbProductSlide, DbRegion, EditableFieldDef } from '../../../types'
import type { UploadProgress } from '../../../lib/upload'

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
  const [editingFieldsSlide, setEditingFieldsSlide] = useState<SlideItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const storagePath = `products/${mod.id}`

  const fetchSlides = useCallback(async () => {
    setLoading(true)

    const { data: slideData } = await supabase
      .from('product_slides')
      .select('*')
      .eq('module_id', mod.id)
      .order('slide_number')

    if (slideData && slideData.length > 0) {
      setSlides(
        (slideData as DbProductSlide[]).map((s) => ({
          id: `slide-${s.slide_number}`,
          dbId: s.id,
          slideNumber: s.slide_number,
          imagePath: s.image_path || `${storagePath}/Slide${s.slide_number}.PNG`,
          editableFields: Array.isArray(s.editable_fields) ? s.editable_fields : [],
        }))
      )
    } else if (mod.slides_count > 0) {
      // No DB records but count exists — build from count
      setSlides(
        Array.from({ length: mod.slides_count }, (_, i) => ({
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

    setLoading(false)
  }, [mod.id, mod.slides_count, storagePath])

  useEffect(() => {
    fetchSlides()
  }, [fetchSlides])

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

  async function handleBulkUpload(files: File[]) {
    if (files.length === 0) return

    setUploading(true)
    setUploadProgress({ total: files.length, completed: 0, currentFile: '' })

    const results = await uploadSlides(files, storagePath, 1, setUploadProgress)

    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      console.error('Upload errors:', errors)
    }

    const successfulUploads = results.filter((r) => !r.error)

    // Delete existing slide records
    await supabase.from('product_slides').delete().eq('module_id', mod.id)

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
    await supabase
      .from('product_modules')
      .update({ slides_count: successfulUploads.length })
      .eq('id', mod.id)

    await logAudit('slide_bulk_uploaded', 'product_module', mod.id, {
      slides_uploaded: successfulUploads.length,
      errors: errors.length,
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
    try {
      let dbId = slideItem.dbId

      // Create DB record if it doesn't exist yet
      if (!dbId) {
        const { data, error: insertErr } = await supabase
          .from('product_slides')
          .insert({
            module_id: mod.id,
            slide_number: slideItem.slideNumber,
            title: `Slide ${slideItem.slideNumber}`,
            slide_type: fields.length > 0 ? 'editable' : 'static',
            image_path: slideItem.imagePath,
            editable_fields: fields as unknown as Record<string, unknown>[],
          })
          .select('id')
          .single()

        if (insertErr || !data) {
          console.error('Failed to create slide record:', insertErr)
          return { success: false, error: insertErr?.message || 'Failed to create slide record' }
        }

        dbId = data.id
      } else {
        // Update existing record
        const { error: updateErr } = await supabase
          .from('product_slides')
          .update({
            editable_fields: fields as unknown as Record<string, unknown>[],
            slide_type: fields.length > 0 ? 'editable' : 'static',
          })
          .eq('id', dbId)

        if (updateErr) {
          console.error('Failed to update slide fields:', updateErr)
          return { success: false, error: updateErr.message }
        }
      }

      // Update local state with fields and dbId
      setSlides((prev) =>
        prev.map((s) =>
          s.slideNumber === slideItem.slideNumber
            ? { ...s, editableFields: fields, dbId }
            : s
        )
      )

      await logAudit('editable_fields_updated', 'product_module', mod.id, {
        slide_number: slideItem.slideNumber,
        field_count: fields.length,
      }, userId)

      return { success: true }
    } catch (err) {
      console.error('Unexpected error saving fields:', err)
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
          slideImageUrl={getSlideUrl(editingFieldsSlide.imagePath)}
          slideLabel={`${mod.name} — Slide ${editingFieldsSlide.slideNumber}`}
          initialFields={editingFieldsSlide.editableFields}
          onSave={(fields) => handleSaveFields(editingFieldsSlide, fields)}
          onClose={() => setEditingFieldsSlide(null)}
        />
      )}
    </Portal>
  )
}
