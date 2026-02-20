import { useState, useEffect, useMemo } from 'react'
import { Loader2, Pencil, ChevronRight, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSlideUrl } from '../../lib/storage'
import { REGIONS, PRODUCT_MODULES } from '../../lib/constants'
import type { ProposalDraft, EditableFieldDef, EditableFieldsData } from '../../types'

interface StepCustomiseSlidesProps {
  draft: ProposalDraft
  updateDraft: (updates: Partial<ProposalDraft>) => void
}

interface EditableSlide {
  slideId: string
  sectionName: string
  slideLabel: string
  imagePath: string
  fields: EditableFieldDef[]
}

export function StepCustomiseSlides({ draft, updateDraft }: StepCustomiseSlidesProps) {
  const [loading, setLoading] = useState(true)
  const [editableSlides, setEditableSlides] = useState<EditableSlide[]>([])
  const [expandedSlide, setExpandedSlide] = useState<string | null>(null)

  const region = REGIONS.find((r) => r.id === draft.regionId)
  const selectedModules = PRODUCT_MODULES.filter((p) =>
    draft.selectedProducts.includes(p.id)
  )

  // Fetch editable field definitions from the DB
  useEffect(() => {
    async function fetchEditableFields() {
      setLoading(true)
      const slides: EditableSlide[] = []

      // 1. Fetch intro slides with editable fields
      if (region) {
        const { data: introPack } = await supabase
          .from('intro_packs')
          .select('id')
          .eq('region_id', draft.regionId)
          .eq('is_active', true)
          .single()

        if (introPack) {
          const { data: introSlides } = await supabase
            .from('intro_slides')
            .select('*')
            .eq('intro_pack_id', introPack.id)
            .order('slide_number')

          if (introSlides) {
            for (const s of introSlides) {
              const fields = Array.isArray(s.editable_fields) ? s.editable_fields as EditableFieldDef[] : []
              if (fields.length > 0) {
                slides.push({
                  slideId: `intro-${s.slide_number}`,
                  sectionName: `Introduction — ${region.name}`,
                  slideLabel: `Introduction Slide ${s.slide_number}`,
                  imagePath: s.image_path || `intro-${draft.regionId}/Slide${s.slide_number}.PNG`,
                  fields,
                })
              }
            }
          }
        }
      }

      // 2. Fetch product slides with editable fields
      for (const mod of selectedModules) {
        const { data: productSlides } = await supabase
          .from('product_slides')
          .select('*')
          .eq('module_id', mod.id)
          .order('slide_number')

        if (productSlides) {
          for (const s of productSlides) {
            const fields = Array.isArray(s.editable_fields) ? s.editable_fields as EditableFieldDef[] : []
            if (fields.length > 0) {
              slides.push({
                slideId: `product-${mod.id}-${s.slide_number}`,
                sectionName: mod.name,
                slideLabel: `${mod.name} — Slide ${s.slide_number}`,
                imagePath: s.image_path || `products/${mod.id}/Slide${s.slide_number}.PNG`,
                fields,
              })
            }
          }
        }
      }

      setEditableSlides(slides)
      if (slides.length > 0) {
        setExpandedSlide(slides[0].slideId)
      }

      // Auto-fill fields that have autoFill configured
      const currentData = { ...draft.editableFieldsData }
      let updated = false
      for (const slide of slides) {
        if (!currentData[slide.slideId]) {
          currentData[slide.slideId] = {}
        }
        for (const field of slide.fields) {
          if (field.autoFill && !currentData[slide.slideId][field.name]) {
            const value = getAutoFillValue(field.autoFill, draft)
            if (value) {
              currentData[slide.slideId][field.name] = value
              updated = true
            }
          }
        }
      }
      if (updated) {
        updateDraft({ editableFieldsData: currentData })
      }

      setLoading(false)
    }

    fetchEditableFields()
  }, [draft.regionId, draft.selectedProducts.join(',')])

  function handleFieldChange(slideId: string, fieldName: string, value: string) {
    const newData: EditableFieldsData = {
      ...draft.editableFieldsData,
      [slideId]: {
        ...(draft.editableFieldsData[slideId] || {}),
        [fieldName]: value,
      },
    }
    updateDraft({ editableFieldsData: newData })
  }

  function getFieldValue(slideId: string, fieldName: string): string {
    return draft.editableFieldsData[slideId]?.[fieldName] || ''
  }

  // Group slides by section
  const sections = useMemo(() => {
    const groups: { name: string; slides: EditableSlide[] }[] = []
    for (const slide of editableSlides) {
      const existing = groups.find((g) => g.name === slide.sectionName)
      if (existing) {
        existing.slides.push(slide)
      } else {
        groups.push({ name: slide.sectionName, slides: [slide] })
      }
    }
    return groups
  }, [editableSlides])

  // Count filled fields for progress
  const totalFields = editableSlides.reduce((sum, s) => sum + s.fields.length, 0)
  const filledFields = editableSlides.reduce((sum, s) => {
    return sum + s.fields.filter((f) => getFieldValue(s.slideId, f.name).trim().length > 0).length
  }, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-hoxton-turquoise" />
        <span className="ml-3 text-sm font-heading font-medium text-gray-400">
          Checking for editable slides...
        </span>
      </div>
    )
  }

  if (editableSlides.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
          Customise Slides
        </h2>
        <p className="mt-1 mb-6 text-sm font-body text-hoxton-slate">
          Review and customise editable content on your slides
        </p>

        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center">
          <Check className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <p className="text-base font-heading font-semibold text-hoxton-deep">
            No editable slides found
          </p>
          <p className="mt-1 text-sm font-body text-gray-400">
            None of the selected slides have editable fields. You can continue to preview.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
        Customise Slides
      </h2>
      <p className="mt-1 mb-6 text-sm font-body text-hoxton-slate">
        Fill in the editable fields on your slides. Some fields are pre-filled from your proposal details.
      </p>

      {/* Progress bar */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white px-6 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-heading font-medium text-hoxton-deep">
            {filledFields} of {totalFields} fields completed
          </span>
          <span className="text-xs font-heading font-semibold text-hoxton-turquoise">
            {totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 100}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-hoxton-turquoise transition-all"
            style={{ width: `${totalFields > 0 ? (filledFields / totalFields) * 100 : 100}%` }}
          />
        </div>
      </div>

      {/* Sections with slides */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.name} className="rounded-2xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 px-6 py-3">
              <h3 className="text-sm font-heading font-semibold text-hoxton-deep">
                {section.name}
              </h3>
            </div>

            <div className="divide-y divide-gray-50">
              {section.slides.map((slide) => {
                const isExpanded = expandedSlide === slide.slideId
                const slideFieldsFilled = slide.fields.filter(
                  (f) => getFieldValue(slide.slideId, f.name).trim().length > 0
                ).length
                const allFilled = slideFieldsFilled === slide.fields.length

                return (
                  <div key={slide.slideId}>
                    {/* Slide header */}
                    <button
                      onClick={() => setExpandedSlide(isExpanded ? null : slide.slideId)}
                      className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="h-10 w-[70px] shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                        <img
                          src={getSlideUrl(slide.imagePath)}
                          alt={slide.slideLabel}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-heading font-medium text-hoxton-deep">
                          {slide.slideLabel}
                        </p>
                        <p className="text-xs font-body text-gray-400">
                          {slide.fields.length} editable field{slide.fields.length !== 1 ? 's' : ''}
                          {allFilled && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-emerald-600">
                              <Check className="h-3 w-3" /> Done
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-heading font-semibold ${
                          allFilled
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-hoxton-turquoise/10 text-hoxton-turquoise'
                        }`}>
                          {slideFieldsFilled}/{slide.fields.length}
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </div>
                    </button>

                    {/* Expanded: fields form + preview */}
                    {isExpanded && (
                      <div className="flex gap-6 border-t border-gray-100 px-6 py-5">
                        {/* Left — slide preview */}
                        <div className="w-[280px] shrink-0">
                          <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                            <div className="aspect-video">
                              <img
                                src={getSlideUrl(slide.imagePath)}
                                alt={slide.slideLabel}
                                className="h-full w-full object-contain"
                              />
                              {/* Overlay showing field positions */}
                              {slide.fields.map((field) => (
                                <div
                                  key={field.id}
                                  className="absolute border border-hoxton-turquoise/40 bg-hoxton-turquoise/10"
                                  style={{
                                    left: `${field.x}%`,
                                    top: `${field.y}%`,
                                    width: `${field.width}%`,
                                    height: `${field.height}%`,
                                  }}
                                >
                                  <span className="absolute left-0 top-0 bg-hoxton-turquoise px-1 py-px text-[8px] font-heading font-semibold text-white">
                                    {field.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Right — field inputs */}
                        <div className="flex-1 space-y-4">
                          {slide.fields.map((field) => (
                            <div key={field.id}>
                              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-heading font-medium text-hoxton-deep">
                                <Pencil className="h-3 w-3 text-hoxton-turquoise" />
                                {field.label}
                                {field.autoFill && (
                                  <span className="rounded-full bg-hoxton-turquoise/10 px-2 py-px text-[10px] font-heading font-semibold text-hoxton-turquoise">
                                    Auto-filled
                                  </span>
                                )}
                              </label>

                              {field.type === 'text' && (
                                <input
                                  type="text"
                                  value={getFieldValue(slide.slideId, field.name)}
                                  onChange={(e) => handleFieldChange(slide.slideId, field.name, e.target.value)}
                                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-body text-hoxton-deep placeholder:text-gray-300 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
                                />
                              )}

                              {field.type === 'textarea' && (
                                <textarea
                                  value={getFieldValue(slide.slideId, field.name)}
                                  onChange={(e) => handleFieldChange(slide.slideId, field.name, e.target.value)}
                                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                                  rows={4}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-body text-hoxton-deep placeholder:text-gray-300 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
                                />
                              )}

                              {field.type === 'table' && (
                                <textarea
                                  value={getFieldValue(slide.slideId, field.name)}
                                  onChange={(e) => handleFieldChange(slide.slideId, field.name, e.target.value)}
                                  placeholder="Enter table data (one row per line, columns separated by | )"
                                  rows={6}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm text-hoxton-deep placeholder:text-gray-300 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getAutoFillValue(autoFill: string, draft: ProposalDraft): string {
  switch (autoFill) {
    case 'client_name':
      return draft.clientName
    case 'hxt_reference':
      return draft.hxtNumber
    case 'date':
      return new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    case 'region_name': {
      const region = REGIONS.find((r) => r.id === draft.regionId)
      return region?.display ?? ''
    }
    case 'advisor_name':
      // Would need to look up from profile, return empty for manual fill
      return ''
    default:
      return ''
  }
}
