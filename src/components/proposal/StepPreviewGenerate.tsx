import { useState, useMemo, useEffect, useCallback } from 'react'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Download,
  Mail,
  Eye,
  Loader2,
  CheckCircle,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Pencil,
  ToggleLeft,
  ToggleRight,
  EyeOff,
} from 'lucide-react'
import { REGIONS, PRODUCT_MODULES } from '../../lib/constants'
import { supabase } from '../../lib/supabase'
import { getSlideUrl } from '../../lib/storage'
import { logger } from '../../lib/logger'
import type { ProposalDraft } from '../../types'

interface StepPreviewGenerateProps {
  draft: ProposalDraft
  onSaveDraft: () => Promise<string | null>
  proposalId: string | null
  updateDraft: (updates: Partial<ProposalDraft>) => void
}

interface EditableFieldDef {
  id: string
  name: string
  label: string
  type: 'text' | 'textarea' | 'table'
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: 'heading' | 'body'
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold'
  color: string
  textAlign: 'left' | 'center' | 'right'
  autoFill?: string
}

interface SlideItem {
  id: string
  section: string
  sectionType: 'intro' | 'divider' | 'context' | 'product' | 'closing'
  label: string
  slideIndex: number
  imagePath: string
  isEditable: boolean
  editableFields?: EditableFieldDef[]
}

interface SectionGroup {
  name: string
  slideIds: string[]
  count: number
  enabledCount: number
}

/* ── Slide thumbnail with fallback ── */

function SlideThumb({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-hoxton-deep ${className}`}>
        <span className="px-1 text-center text-[8px] font-heading font-medium leading-tight text-white/80">
          {alt}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  )
}

/* ── Field overlays for slide preview ── */

const FONT_WEIGHT_MAP: Record<string, string> = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

function SlideFieldOverlays({
  fields,
  values,
}: {
  fields: EditableFieldDef[]
  values: Record<string, string>
}) {
  return (
    <>
      {fields.map((field) => {
        const value = values[field.name]
        if (!value) return null

        const fontFamily =
          field.fontFamily === 'heading'
            ? "'FT Calhern', 'Helvetica Neue', sans-serif"
            : "'Sentient', Georgia, serif"

        // Scale font sizes proportionally: at 1280px wide, 1cqw = 12.8px
        const scaledFontSize = `${field.fontSize / 12.8}cqw`

        if (field.type === 'table') {
          const rows = value.split('\n').filter((r) => r.trim())
          const scaledTableFontSize = `${(field.fontSize * 0.85) / 12.8}cqw`
          return (
            <div
              key={field.id}
              style={{
                position: 'absolute',
                left: `${field.x}%`,
                top: `${field.y}%`,
                width: `${field.width}%`,
                height: `${field.height}%`,
                overflow: 'hidden',
                fontFamily,
                color: field.color,
                textAlign: field.textAlign,
                fontSize: scaledTableFontSize,
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {rows.map((row, ri) => {
                    const cells = row.split('|').map((c) => c.trim())
                    return (
                      <tr key={ri}>
                        {cells.map((c, ci) => (
                          <td
                            key={ci}
                            style={{
                              padding: '0.15em 0.4em',
                              borderBottom: '1px solid rgba(0,0,0,0.1)',
                            }}
                          >
                            {c}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }

        return (
          <div
            key={field.id}
            style={{
              position: 'absolute',
              left: `${field.x}%`,
              top: `${field.y}%`,
              width: `${field.width}%`,
              height: `${field.height}%`,
              display: 'flex',
              alignItems: 'flex-start',
              overflow: 'hidden',
              fontFamily,
              fontSize: scaledFontSize,
              fontWeight: FONT_WEIGHT_MAP[field.fontWeight] || '400',
              color: field.color,
              textAlign: field.textAlign,
              lineHeight: 1.4,
              padding: '0.15em 0.3em',
              whiteSpace: 'pre-wrap',
            }}
          >
            <span style={{ width: '100%', textAlign: field.textAlign }}>
              {value}
            </span>
          </div>
        )
      })}
    </>
  )
}

/* ── Sortable slide item (compact for left panel) ── */

function SortableSlide({
  slide,
  globalIndex,
  totalSlides,
  isActive,
  isDisabled,
  onMoveUp,
  onMoveDown,
  onSelect,
  onToggleEnabled,
}: {
  slide: SlideItem
  globalIndex: number
  totalSlides: number
  isActive: boolean
  isDisabled: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onSelect: () => void
  onToggleEnabled: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all ${
        isDragging
          ? 'z-10 border-hoxton-turquoise shadow-lg'
          : isActive
            ? 'border-hoxton-turquoise/50 bg-hoxton-turquoise/5'
            : 'border-transparent hover:border-gray-100 hover:bg-gray-50'
      } ${isDisabled ? 'opacity-40' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onToggleEnabled() }}
        className={`shrink-0 rounded p-0.5 transition-colors ${
          isDisabled
            ? 'text-gray-300 hover:text-gray-500'
            : 'text-hoxton-turquoise hover:text-hoxton-turquoise/70'
        }`}
        title={isDisabled ? 'Enable slide' : 'Disable slide'}
      >
        {isDisabled ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
      </button>

      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <div className={`h-[34px] w-[60px] shrink-0 overflow-hidden rounded border border-gray-100 ${isDisabled ? 'grayscale' : ''}`}>
          <SlideThumb src={slide.imagePath} alt={slide.label} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-xs font-heading font-medium ${isDisabled ? 'text-gray-400 line-through' : 'text-hoxton-deep'}`}>
            {slide.label}
          </p>
          <p className="text-[10px] font-body text-gray-400">
            Slide {globalIndex + 1}
          </p>
        </div>
      </button>

      {slide.isEditable && !isDisabled && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-hoxton-turquoise/10 px-1.5 py-px text-[9px] font-heading font-semibold text-hoxton-turquoise">
          <Pencil className="h-2 w-2" />
          Edit
        </span>
      )}

      <div className="flex shrink-0 flex-col opacity-0 group-hover:opacity-100">
        <button
          onClick={onMoveUp}
          disabled={globalIndex === 0}
          className="rounded p-px text-gray-300 hover:text-hoxton-deep disabled:opacity-0"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={globalIndex === totalSlides - 1}
          className="rounded p-px text-gray-300 hover:text-hoxton-deep disabled:opacity-0"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

/* ── Main component ── */

export function StepPreviewGenerate({ draft, onSaveDraft, proposalId, updateDraft }: StepPreviewGenerateProps) {
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [disabledSlides, setDisabledSlides] = useState<Set<string>>(
    () => new Set(draft.disabledSlides || [])
  )

  const toggleSlideEnabled = useCallback((slideId: string) => {
    setDisabledSlides((prev) => {
      const next = new Set(prev)
      if (next.has(slideId)) next.delete(slideId)
      else next.add(slideId)
      return next
    })
  }, [])

  // Sync disabledSlides back to draft
  useEffect(() => {
    updateDraft({ disabledSlides: Array.from(disabledSlides) })
  }, [disabledSlides, updateDraft])

  const region = REGIONS.find((r) => r.id === draft.regionId)
  const selectedModules = useMemo(
    () => PRODUCT_MODULES.filter((p) => draft.selectedProducts.includes(p.id)),
    [draft.selectedProducts]
  )

  const initialSlides = useMemo(() => {
    const items: SlideItem[] = []
    let idx = 0

    const introCount = region?.introSlides ?? 0
    for (let i = 1; i <= introCount; i++) {
      items.push({
        id: `intro-${i}`,
        section: `Introduction — ${region?.name ?? 'Region'}`,
        sectionType: 'intro',
        label: `Introduction Slide ${i}`,
        slideIndex: idx++,
        imagePath: getSlideUrl(`intro-${draft.regionId}/Slide${i}.PNG`),
        isEditable: false,
      })
    }

    items.push({
      id: 'divider-aof',
      section: 'Areas of Focus',
      sectionType: 'divider',
      label: 'Areas of Focus',
      slideIndex: idx++,
      imagePath: getSlideUrl('dividers/areas-of-focus.PNG'),
      isEditable: false,
    })

    items.push({
      id: 'context-summary',
      section: 'Summary of Context',
      sectionType: 'context',
      label: 'Summary of Context',
      slideIndex: idx++,
      imagePath: getSlideUrl('context/summary.PNG'),
      isEditable: true,
    })

    for (const mod of selectedModules) {
      for (let i = 1; i <= mod.slides; i++) {
        items.push({
          id: `product-${mod.id}-${i}`,
          section: mod.name,
          sectionType: 'product',
          label: `${mod.name} — Slide ${i}`,
          slideIndex: idx++,
          imagePath: getSlideUrl(`products/${mod.id}/Slide${i}.PNG`),
          isEditable: false,
        })
      }
    }

    const closingSlides = [
      { key: 'moving-forward', label: 'Moving Forward' },
      { key: 'next-steps', label: 'Next Steps' },
      { key: 'disclaimer', label: 'Disclaimer' },
      { key: 'thank-you', label: 'Thank You' },
    ]
    for (const cs of closingSlides) {
      items.push({
        id: `closing-${cs.key}`,
        section: 'Closing',
        sectionType: 'closing',
        label: cs.label,
        slideIndex: idx++,
        imagePath: getSlideUrl(`closing/${cs.key}.PNG`),
        isEditable: false,
      })
    }

    return items
  }, [region, draft.regionId, selectedModules])

  const [slides, setSlides] = useState<SlideItem[]>(initialSlides)

  useEffect(() => {
    setSlides(initialSlides)
  }, [initialSlides])

  // Fetch editable field definitions via Edge Functions and attach to slides
  useEffect(() => {
    async function fetchFieldDefs() {
      const fieldMap: Record<string, EditableFieldDef[]> = {}

      // Fetch intro slide fields via Edge Function
      if (region) {
        try {
          const { data: introPack } = await supabase
            .from('intro_packs')
            .select('id')
            .eq('region_id', draft.regionId)
            .eq('is_active', true)
            .single()

          if (introPack) {
            const { data, error } = await supabase.functions.invoke('get-slide-fields', {
              body: { slideType: 'intro', parentId: introPack.id },
            })

            if (!error && data?.slides) {
              for (const s of data.slides) {
                const fields = Array.isArray(s.editable_fields) ? s.editable_fields as EditableFieldDef[] : []
                if (fields.length > 0) {
                  fieldMap[`intro-${s.slide_number}`] = fields
                }
              }
            }
          }
        } catch (err) {
          logger.warn('[Preview] Failed to fetch intro field defs:', err)
        }
      }

      // Fetch product slide fields via Edge Function
      for (const mod of selectedModules) {
        try {
          const { data, error } = await supabase.functions.invoke('get-slide-fields', {
            body: { slideType: 'product', parentId: mod.id },
          })

          if (!error && data?.slides) {
            for (const s of data.slides) {
              const fields = Array.isArray(s.editable_fields) ? s.editable_fields as EditableFieldDef[] : []
              if (fields.length > 0) {
                fieldMap[`product-${mod.id}-${s.slide_number}`] = fields
              }
            }
          }
        } catch (err) {
          logger.warn(`[Preview] Failed to fetch product field defs for ${mod.id}:`, err)
        }
      }

      // Attach field defs to slides
      if (Object.keys(fieldMap).length > 0) {
        setSlides((prev) =>
          prev.map((s) => ({
            ...s,
            editableFields: fieldMap[s.id] || undefined,
            isEditable: s.isEditable || !!fieldMap[s.id],
          }))
        )
      }
    }

    fetchFieldDefs()
  }, [region, draft.regionId, selectedModules.map((m) => m.id).join(',')])

  // Group slides into sections for the left panel
  const sections = useMemo(() => {
    const groups: SectionGroup[] = []
    let currentSection = ''
    for (const slide of slides) {
      if (slide.section !== currentSection) {
        groups.push({ name: slide.section, slideIds: [], count: 0, enabledCount: 0 })
        currentSection = slide.section
      }
      const group = groups[groups.length - 1]
      group.slideIds.push(slide.id)
      group.count++
      if (!disabledSlides.has(slide.id)) group.enabledCount++
    }
    return groups
  }, [slides, disabledSlides])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Only include expanded items in the sortable context
  const sortableIds = useMemo(
    () => slides.filter((s) => expandedSections.has(s.section)).map((s) => s.id),
    [slides, expandedSections]
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSlides((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  function moveSlide(from: number, to: number) {
    setSlides((items) => arrayMove(items, from, to))
  }

  function toggleSection(name: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function getGlobalIndex(slideId: string) {
    return slides.findIndex((s) => s.id === slideId)
  }

  // Keyboard navigation for preview
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && activeSlideIndex > 0) {
        setActiveSlideIndex(activeSlideIndex - 1)
      }
      if (e.key === 'ArrowRight' && activeSlideIndex < slides.length - 1) {
        setActiveSlideIndex(activeSlideIndex + 1)
      }
    },
    [activeSlideIndex, slides.length]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)

    try {
      // Ensure draft is saved first and we have a proposal ID
      const savedId = await onSaveDraft()
      const id = savedId || proposalId
      if (!id) {
        throw new Error('Could not save proposal — please try again')
      }

      const pdfServiceUrl = import.meta.env.VITE_PDF_SERVICE_URL || ''
      if (!pdfServiceUrl) {
        throw new Error('PDF service URL not configured')
      }

      // Build the slide order from current slide arrangement, excluding disabled slides
      const enabledSlides = slides.filter((s) => !disabledSlides.has(s.id))
      const slideOrderPayload = enabledSlides.map((s) => ({
        id: s.id,
        type: s.id === 'context-summary' ? 'context' as const : 'image' as const,
        imagePath: s.imagePath,
        label: s.label,
        editableFields: s.editableFields,
      }))

      const response = await fetch(`${pdfServiceUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: id,
          clientName: draft.clientName,
          advisorName: '',
          regionId: draft.regionId,
          introSlidesCount: region?.introSlides ?? 0,
          selectedProducts: selectedModules.map((m) => ({
            id: m.id,
            name: m.name,
            slides: m.slides,
          })),
          context: draft.context,
          feeData: {},
          slideOrder: slideOrderPayload,
          editableFieldsData: draft.editableFieldsData || {},
          staticAssetsBaseUrl: window.location.origin,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'PDF generation failed')
      }

      setPdfPath(result.pdfPath)
      setGenerated(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setGenError(message)
      logger.error('[PDF] Generation failed:', message)
    } finally {
      setGenerating(false)
    }
  }

  const activeSlide = slides[activeSlideIndex]
  const enabledCount = slides.length - disabledSlides.size
  const disabledCount = disabledSlides.size

  return (
    <div>
      <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
        Preview & Generate
      </h2>
      <p className="mt-1 mb-6 text-sm font-body text-hoxton-slate">
        Review and reorder your slides, then generate the final PDF
      </p>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">Client</p>
          <p className="mt-1 text-base font-heading font-semibold text-hoxton-deep">{draft.clientName}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">Region</p>
          <p className="mt-1 text-base font-heading font-semibold text-hoxton-deep">{region?.display ?? draft.regionId}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">Total Slides</p>
          <p className="mt-1 text-base font-heading font-semibold text-hoxton-turquoise">
            {enabledCount}
            {disabledCount > 0 && (
              <span className="ml-1 text-sm font-normal text-gray-400">of {slides.length}</span>
            )}
          </p>
        </div>
      </div>

      {/* Split panel */}
      <div className="mb-6 flex flex-col gap-5 lg:flex-row">
        {/* LEFT — Slide order list */}
        <div className="w-full rounded-2xl border border-gray-100 bg-white lg:w-[45%]">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-heading font-semibold text-hoxton-deep">
              Slide Order
            </h3>
            <p className="text-[11px] font-body text-gray-400">
              Expand sections to reorder slides
            </p>
          </div>

          <div className="max-h-[520px] overflow-y-auto p-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                {sections.map((section) => {
                  const isExpanded = expandedSections.has(section.name)
                  const sectionSlides = section.slideIds
                    .map((id) => slides.find((s) => s.id === id)!)
                    .filter(Boolean)
                  const hasEditable = sectionSlides.some((s) => s.isEditable)

                  return (
                    <div key={section.name} className="mb-1">
                      {/* Section header */}
                      <button
                        onClick={() => toggleSection(section.name)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50"
                      >
                        <ChevronRightIcon
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                        <span className="flex-1 truncate text-xs font-heading font-semibold text-hoxton-deep">
                          {section.name}
                        </span>
                        {hasEditable && (
                          <Pencil className="h-2.5 w-2.5 shrink-0 text-hoxton-turquoise" />
                        )}
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-heading font-semibold ${
                          section.enabledCount < section.count
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {section.enabledCount < section.count
                            ? `${section.enabledCount}/${section.count}`
                            : section.count}
                        </span>
                      </button>

                      {/* Expanded slides */}
                      {isExpanded && (
                        <div className="ml-2 space-y-0.5 pb-1">
                          {sectionSlides.map((slide) => {
                            const gi = getGlobalIndex(slide.id)
                            return (
                              <SortableSlide
                                key={slide.id}
                                slide={slide}
                                globalIndex={gi}
                                totalSlides={slides.length}
                                isActive={gi === activeSlideIndex}
                                isDisabled={disabledSlides.has(slide.id)}
                                onMoveUp={() => gi > 0 && moveSlide(gi, gi - 1)}
                                onMoveDown={() =>
                                  gi < slides.length - 1 && moveSlide(gi, gi + 1)
                                }
                                onSelect={() => setActiveSlideIndex(gi)}
                                onToggleEnabled={() => toggleSlideEnabled(slide.id)}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* RIGHT — Slide preview */}
        <div className="flex w-full flex-col rounded-2xl border border-gray-100 bg-white lg:w-[55%]">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-heading font-semibold text-hoxton-slate">
              {activeSlide?.section}
            </p>
            <p className="text-[11px] font-body text-gray-400">
              {activeSlide?.label}
            </p>
          </div>

          {/* Large preview */}
          <div className="flex flex-1 items-center justify-center p-4">
            <div
              className={`relative aspect-video w-full overflow-hidden rounded-lg border border-gray-100 bg-gray-50 ${
                activeSlide && disabledSlides.has(activeSlide.id) ? 'grayscale opacity-50' : ''
              }`}
              style={{ containerType: 'inline-size' }}
            >
              {activeSlide && (
                <>
                  <SlideThumb
                    src={activeSlide.imagePath}
                    alt={activeSlide.label}
                    className="h-full w-full"
                  />
                  {activeSlide.editableFields && activeSlide.editableFields.length > 0 && (
                    <SlideFieldOverlays
                      fields={activeSlide.editableFields}
                      values={draft.editableFieldsData?.[activeSlide.id] || {}}
                    />
                  )}
                </>
              )}
              {activeSlide && disabledSlides.has(activeSlide.id) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900/70 px-4 py-2 text-sm font-heading font-semibold text-white">
                    <EyeOff className="h-4 w-4" />
                    Slide Disabled
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setActiveSlideIndex(Math.max(0, activeSlideIndex - 1))}
              disabled={activeSlideIndex === 0}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4 -rotate-90" />
            </button>

            <span className="text-xs font-heading font-medium text-gray-500">
              Slide {activeSlideIndex + 1} of {slides.length}
              {activeSlide && disabledSlides.has(activeSlide.id) && (
                <span className="ml-1 text-amber-500">(disabled)</span>
              )}
            </span>

            <button
              onClick={() =>
                setActiveSlideIndex(Math.min(slides.length - 1, activeSlideIndex + 1))
              }
              disabled={activeSlideIndex === slides.length - 1}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom — Slide count + Generate */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-6 py-4">
        <p className="text-sm font-heading font-semibold text-hoxton-deep">
          Your proposal: {enabledCount} slides
          {disabledCount > 0 && (
            <span className="ml-1 font-normal text-gray-400">({disabledCount} disabled)</span>
          )}
        </p>

        {generated && pdfPath ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-heading font-semibold text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              PDF ready
            </div>
            <button
              onClick={async () => {
                const { data } = await supabase.storage.from('proposals').createSignedUrl(pdfPath, 3600)
                if (data?.signedUrl) {
                  const a = document.createElement('a')
                  a.href = data.signedUrl
                  a.download = `${(draft.clientName || 'proposal').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
                  a.click()
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2 text-sm font-heading font-semibold text-white hover:bg-hoxton-turquoise/90"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-hoxton-grey bg-white px-4 py-2 text-sm font-heading font-semibold text-hoxton-deep hover:bg-hoxton-light">
              <Mail className="h-4 w-4" />
              Email to Client
            </button>
            <button
              onClick={async () => {
                const { data } = await supabase.storage.from('proposals').createSignedUrl(pdfPath, 3600)
                if (data?.signedUrl) {
                  window.open(data.signedUrl, '_blank')
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-hoxton-grey bg-white px-4 py-2 text-sm font-heading font-semibold text-hoxton-deep hover:bg-hoxton-light"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {genError && (
              <p className="text-sm font-body text-red-600">{genError}</p>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-6 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-70"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating... {enabledCount} slides
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate PDF
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
