import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getSlideUrl } from '../lib/storage'
import { REGIONS, PRODUCT_MODULES } from '../lib/constants'
import {
  initViewSession,
  trackSlideEnter,
  trackSlideExit,
  setPendingExit,
  clearPendingExit,
  flushOnUnload,
} from '../lib/viewer-analytics'
import type { Proposal, EditableFieldDef } from '../types'

/* ── Types ── */

interface LinkData {
  id: string
  proposal_id: string
  is_active: boolean
  expires_at: string | null
  allow_download: boolean
  recipient_name: string
}

interface ViewerSlide {
  id: string
  label: string
  imageUrl: string
  editableFields?: EditableFieldDef[]
}

/* ── Font weight map (matches StepPreviewGenerate) ── */

const FONT_WEIGHT_MAP: Record<string, string> = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

/* ── SlideFieldOverlays (reused pattern from StepPreviewGenerate) ── */

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

/* ── Slide image with fallback ── */

function SlideImage({
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
        <span className="px-2 text-center text-xs font-heading font-medium text-white/70">
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

/* ── Assemble slides from proposal data ── */

async function assembleSlides(
  proposal: Proposal,
  fieldDefs: Record<string, EditableFieldDef[]>
): Promise<ViewerSlide[]> {
  const items: ViewerSlide[] = []
  const region = REGIONS.find((r) => r.id === proposal.region_id)
  const selectedModules = PRODUCT_MODULES.filter((p) =>
    proposal.selected_products.includes(p.id)
  )
  const disabledSet = new Set(proposal.disabled_slides || [])

  // 1. Intro slides
  const introCount = region?.introSlides ?? 0
  for (let i = 1; i <= introCount; i++) {
    const id = `intro-${i}`
    if (disabledSet.has(id)) continue
    items.push({
      id,
      label: `Introduction Slide ${i}`,
      imageUrl: getSlideUrl(`intro-${proposal.region_id}/Slide${i}.PNG`),
      editableFields: fieldDefs[id],
    })
  }

  // 2. Divider
  if (!disabledSet.has('divider-aof')) {
    items.push({
      id: 'divider-aof',
      label: 'Areas of Focus',
      imageUrl: getSlideUrl('dividers/areas-of-focus.PNG'),
    })
  }

  // 3. Context
  if (!disabledSet.has('context-summary')) {
    items.push({
      id: 'context-summary',
      label: 'Summary of Context',
      imageUrl: getSlideUrl('context/summary.PNG'),
      editableFields: fieldDefs['context-summary'],
    })
  }

  // 4. Product slides
  for (const mod of selectedModules) {
    for (let i = 1; i <= mod.slides; i++) {
      const id = `product-${mod.id}-${i}`
      if (disabledSet.has(id)) continue
      items.push({
        id,
        label: `${mod.name} — Slide ${i}`,
        imageUrl: getSlideUrl(`products/${mod.id}/Slide${i}.PNG`),
        editableFields: fieldDefs[id],
      })
    }
  }

  // 5. Closing slides (from DB)
  try {
    const { data: closingPack } = await supabase
      .from('closing_packs')
      .select('id')
      .eq('region_id', proposal.region_id)
      .eq('is_active', true)
      .single()

    if (closingPack) {
      const { data: closingSlides } = await supabase
        .from('closing_slides')
        .select('slide_number, image_path, editable_fields')
        .eq('closing_pack_id', closingPack.id)
        .order('slide_number')

      if (closingSlides && closingSlides.length > 0) {
        for (const s of closingSlides) {
          const id = `closing-${s.slide_number}`
          if (disabledSet.has(id)) continue
          const fields = Array.isArray(s.editable_fields)
            ? (s.editable_fields as EditableFieldDef[])
            : []
          items.push({
            id,
            label: `Closing Slide ${s.slide_number}`,
            imageUrl: getSlideUrl(
              s.image_path || `closing-${proposal.region_id}/Slide${s.slide_number}.PNG`
            ),
            editableFields: fields.length > 0 ? fields : fieldDefs[id],
          })
        }
      } else {
        // Fallback: use region closing_slides_count
        const { data: dbRegion } = await supabase
          .from('regions')
          .select('closing_slides_count')
          .eq('id', proposal.region_id)
          .single()

        const count = dbRegion?.closing_slides_count ?? 0
        for (let i = 1; i <= count; i++) {
          const id = `closing-${i}`
          if (disabledSet.has(id)) continue
          items.push({
            id,
            label: `Closing Slide ${i}`,
            imageUrl: getSlideUrl(`closing-${proposal.region_id}/Slide${i}.PNG`),
            editableFields: fieldDefs[id],
          })
        }
      }
    }
  } catch {
    // Closing slides unavailable — continue without them
  }

  return items
}

/* ── Fetch editable field definitions from DB ── */

async function fetchFieldDefs(
  proposal: Proposal
): Promise<Record<string, EditableFieldDef[]>> {
  const fieldMap: Record<string, EditableFieldDef[]> = {}

  // Intro slide fields
  try {
    const { data: introPack } = await supabase
      .from('intro_packs')
      .select('id')
      .eq('region_id', proposal.region_id)
      .eq('is_active', true)
      .single()

    if (introPack) {
      const { data: introSlides } = await supabase
        .from('intro_slides')
        .select('slide_number, editable_fields')
        .eq('intro_pack_id', introPack.id)

      if (introSlides) {
        for (const s of introSlides) {
          const fields = Array.isArray(s.editable_fields)
            ? (s.editable_fields as EditableFieldDef[])
            : []
          if (fields.length > 0) {
            fieldMap[`intro-${s.slide_number}`] = fields
          }
        }
      }
    }
  } catch {
    // Non-critical
  }

  // Product slide fields
  const selectedModules = PRODUCT_MODULES.filter((p) =>
    proposal.selected_products.includes(p.id)
  )

  for (const mod of selectedModules) {
    try {
      const { data: productSlides } = await supabase
        .from('product_slides')
        .select('slide_number, editable_fields')
        .eq('module_id', mod.id)

      if (productSlides) {
        for (const s of productSlides) {
          const fields = Array.isArray(s.editable_fields)
            ? (s.editable_fields as EditableFieldDef[])
            : []
          if (fields.length > 0) {
            fieldMap[`product-${mod.id}-${s.slide_number}`] = fields
          }
        }
      }
    } catch {
      // Non-critical
    }
  }

  return fieldMap
}

/* ── Main component ── */

export function ProposalViewerPage() {
  const { token } = useParams<{ token: string }>()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<LinkData | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [slides, setSlides] = useState<ViewerSlide[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  // Analytics refs
  const viewIdRef = useRef<string | null>(null)
  const currentAnalyticRef = useRef<{ id: string; enteredAt: Date } | null>(null)

  // Thumbnail strip ref
  const thumbStripRef = useRef<HTMLDivElement>(null)

  // Swipe tracking
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  /* ── Load data ── */
  useEffect(() => {
    if (!token) {
      setError('No token provided')
      setLoading(false)
      return
    }

    async function load() {
      // 1. Validate link
      const { data: linkData, error: linkError } = await supabase
        .from('proposal_links')
        .select('id, proposal_id, is_active, expires_at, allow_download, recipient_name')
        .eq('token', token!)
        .single()

      if (linkError || !linkData) {
        setError('This link is no longer available')
        setLoading(false)
        return
      }

      const ld = linkData as LinkData

      if (!ld.is_active) {
        setError('This link has been revoked')
        setLoading(false)
        return
      }

      if (ld.expires_at && new Date(ld.expires_at) < new Date()) {
        setError('This link has expired')
        setLoading(false)
        return
      }

      setLink(ld)

      // 2. Fetch proposal
      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', ld.proposal_id)
        .single()

      if (proposalError || !proposalData) {
        setError('This link is no longer available')
        setLoading(false)
        return
      }

      const prop = proposalData as Proposal
      setProposal(prop)

      // 3. Fetch field definitions + assemble slides
      const fieldDefs = await fetchFieldDefs(prop)
      const assembled = await assembleSlides(prop, fieldDefs)
      setSlides(assembled)
      setLoading(false)

      // 4. Init analytics
      const vid = await initViewSession(ld.id)
      viewIdRef.current = vid
    }

    load()
  }, [token])

  /* ── Slide transition helper ── */
  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length || index === currentIndex || transitioning)
        return
      setTransitioning(true)
      setTimeout(() => {
        setCurrentIndex(index)
        setTransitioning(false)
      }, 150)
    },
    [slides.length, currentIndex, transitioning]
  )

  /* ── Analytics: track slide enters/exits ── */
  useEffect(() => {
    if (!slides.length || !link) return

    const slide = slides[currentIndex]
    if (!slide) return

    // Exit previous slide
    if (currentAnalyticRef.current) {
      trackSlideExit(currentAnalyticRef.current.id, currentAnalyticRef.current.enteredAt)
      clearPendingExit()
      currentAnalyticRef.current = null
    }

    // Enter new slide
    const enteredAt = new Date()
    if (viewIdRef.current) {
      trackSlideEnter(viewIdRef.current, link.id, currentIndex, slide.label).then(
        (analyticId) => {
          if (analyticId) {
            currentAnalyticRef.current = { id: analyticId, enteredAt }
            setPendingExit(analyticId, enteredAt)
          }
        }
      )
    }
  }, [currentIndex, slides.length, link])

  /* ── Flush analytics on unload ── */
  useEffect(() => {
    window.addEventListener('beforeunload', flushOnUnload)
    return () => {
      flushOnUnload()
      window.removeEventListener('beforeunload', flushOnUnload)
    }
  }, [])

  /* ── Keyboard navigation ── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') goToSlide(currentIndex - 1)
      if (e.key === 'ArrowRight') goToSlide(currentIndex + 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToSlide, currentIndex])

  /* ── Auto-scroll thumbnail strip ── */
  useEffect(() => {
    const strip = thumbStripRef.current
    if (!strip) return
    const thumb = strip.children[currentIndex] as HTMLElement
    if (!thumb) return
    thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [currentIndex])

  /* ── Touch / pointer swipe ── */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerStartRef.current) return
      const dx = e.clientX - pointerStartRef.current.x
      const dy = e.clientY - pointerStartRef.current.y
      pointerStartRef.current = null

      // Only trigger on horizontal swipes > 50px with more horizontal than vertical movement
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goToSlide(currentIndex + 1)
        else goToSlide(currentIndex - 1)
      }
    },
    [goToSlide, currentIndex]
  )

  /* ── PDF download handler ── */
  const handleDownload = useCallback(async () => {
    if (!proposal?.pdf_path) return
    const { data } = await supabase.storage
      .from('proposals')
      .createSignedUrl(proposal.pdf_path, 3600)
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = `${(proposal.client_name || 'proposal').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
      a.click()
    }
  }, [proposal])

  /* ── Current slide data ── */
  const currentSlide = slides[currentIndex]
  const fieldValues = useMemo(() => {
    if (!currentSlide || !proposal?.editable_fields_data) return {}
    return proposal.editable_fields_data[currentSlide.id] || {}
  }, [currentSlide, proposal?.editable_fields_data])

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-hoxton-deep">
        <img
          src="/hoxton-logo-white.svg"
          alt="Hoxton"
          className="mb-6 h-10 animate-pulse"
        />
        <Loader2 className="h-6 w-6 animate-spin text-hoxton-turquoise" />
      </div>
    )
  }

  /* ── Error state ── */
  if (error || !link || !proposal || slides.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-hoxton-deep px-4">
        <img src="/hoxton-logo-white.svg" alt="Hoxton" className="mb-8 h-10" />
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-heading font-semibold text-white">
            {error || 'This link is no longer available'}
          </h1>
          <p className="mt-3 text-sm font-body text-hoxton-grey">
            Please contact your adviser for a new link.
          </p>
        </div>
      </div>
    )
  }

  /* ── Main viewer ── */
  return (
    <div className="flex h-screen flex-col bg-hoxton-deep select-none">
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/hoxton-logo-white.svg" alt="Hoxton" className="h-6 shrink-0 sm:h-7" />
          <span className="hidden truncate text-sm font-heading font-medium text-white/80 sm:block">
            Proposal for {proposal.client_name}
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <span className="text-xs font-heading font-medium text-white/60 tabular-nums">
            {currentIndex + 1} / {slides.length}
          </span>

          {link.allow_download && proposal.pdf_path && (
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-hoxton-turquoise px-3 py-1.5 text-xs font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/80"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Slide area ── */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2 py-3 sm:px-10 sm:py-6"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* Prev arrow */}
        <button
          onClick={() => goToSlide(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="absolute left-1 z-10 rounded-full bg-black/30 p-1.5 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white disabled:opacity-0 sm:left-3 sm:p-2"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        {/* Slide container (16:9) */}
        <div
          className={`relative aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-black/20 shadow-2xl transition-opacity duration-150 ${
            transitioning ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ containerType: 'inline-size' }}
        >
          {currentSlide && (
            <>
              <SlideImage
                src={currentSlide.imageUrl}
                alt={currentSlide.label}
                className="h-full w-full"
              />
              {currentSlide.editableFields &&
                currentSlide.editableFields.length > 0 && (
                  <SlideFieldOverlays
                    fields={currentSlide.editableFields}
                    values={fieldValues}
                  />
                )}
            </>
          )}
        </div>

        {/* Next arrow */}
        <button
          onClick={() => goToSlide(currentIndex + 1)}
          disabled={currentIndex === slides.length - 1}
          className="absolute right-1 z-10 rounded-full bg-black/30 p-1.5 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white disabled:opacity-0 sm:right-3 sm:p-2"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </div>

      {/* ── Thumbnail strip ── */}
      <div className="shrink-0 border-t border-white/10 bg-black/20 px-2 py-2 sm:px-6 sm:py-3">
        <div
          ref={thumbStripRef}
          className="flex gap-1.5 overflow-x-auto sm:gap-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => goToSlide(i)}
              className={`group relative shrink-0 overflow-hidden rounded transition-all ${
                i === currentIndex
                  ? 'ring-2 ring-hoxton-turquoise ring-offset-1 ring-offset-hoxton-deep'
                  : 'opacity-50 hover:opacity-80'
              }`}
              title={slide.label}
            >
              <div className="h-[42px] w-[75px] sm:h-[50px] sm:w-[89px]">
                <SlideImage
                  src={slide.imageUrl}
                  alt={slide.label}
                  className="h-full w-full"
                />
              </div>
              {i === currentIndex && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-hoxton-turquoise" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
