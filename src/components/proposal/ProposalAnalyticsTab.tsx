import { useEffect, useState, useCallback } from 'react'
import {
  Eye,
  Users,
  Clock,
  CheckCircle2,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertTriangle,
  X,
} from 'lucide-react'
import {
  getProposalAnalytics,
  getSlideHeatmapData,
  getViewerSessions,
  hasRecentViewer,
} from '../../lib/analytics'
import type {
  AnalyticsOverview,
  SlideHeatmapItem,
  ViewerSession,
} from '../../lib/analytics'
import { getSlideUrl } from '../../lib/storage'

/* ── Helpers ── */

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'mobile') return <Smartphone className="h-4 w-4" />
  if (type === 'tablet') return <Tablet className="h-4 w-4" />
  return <Monitor className="h-4 w-4" />
}

/**
 * Interpolate between turquoise (#1AB0C4) and warm orange (#E85D3A)
 * t = 0 → turquoise, t = 1 → orange/red
 */
function heatColor(t: number): string {
  const r = Math.round(26 + (232 - 26) * t)
  const g = Math.round(176 + (93 - 176) * t)
  const b = Math.round(196 + (58 - 196) * t)
  return `rgb(${r}, ${g}, ${b})`
}

/* ── Slide thumbnail with fallback ── */

function SlideThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-hoxton-deep">
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
      loading="lazy"
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

/* ── Stat Card ── */

function StatCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-hoxton-turquoise">{icon}</span>
        <span className="text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
      </div>
      <p className="text-2xl font-heading font-semibold text-hoxton-deep">{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs font-body text-hoxton-slate">{subtitle}</p>
      )}
    </div>
  )
}

/* ── Slide Detail Modal ── */

function SlideDetailModal({
  slide,
  slideImageUrl,
  onClose,
}: {
  slide: SlideHeatmapItem
  slideImageUrl: string
  onClose: () => void
}) {
  const maxSessionDur = Math.max(...slide.sessions.map((s) => s.duration), 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="mb-4 pr-8 text-lg font-heading font-semibold text-hoxton-deep">
          {slide.slideTitle}
        </h3>

        <div className="mb-5 aspect-video overflow-hidden rounded-lg bg-gray-100">
          <SlideThumb src={slideImageUrl} alt={slide.slideTitle} />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-hoxton-light/60 p-3 text-center">
            <p className="text-lg font-heading font-semibold text-hoxton-deep">
              {slide.viewCount}
            </p>
            <p className="text-[10px] font-heading font-medium uppercase text-hoxton-slate">
              Views
            </p>
          </div>
          <div className="rounded-xl bg-hoxton-light/60 p-3 text-center">
            <p className="text-lg font-heading font-semibold text-hoxton-deep">
              {formatDuration(slide.avgDuration)}
            </p>
            <p className="text-[10px] font-heading font-medium uppercase text-hoxton-slate">
              Avg
            </p>
          </div>
          <div className="rounded-xl bg-hoxton-light/60 p-3 text-center">
            <p className="text-lg font-heading font-semibold text-hoxton-deep">
              {formatDuration(slide.minDuration)}
            </p>
            <p className="text-[10px] font-heading font-medium uppercase text-hoxton-slate">
              Min
            </p>
          </div>
          <div className="rounded-xl bg-hoxton-light/60 p-3 text-center">
            <p className="text-lg font-heading font-semibold text-hoxton-deep">
              {formatDuration(slide.maxDuration)}
            </p>
            <p className="text-[10px] font-heading font-medium uppercase text-hoxton-slate">
              Max
            </p>
          </div>
        </div>

        <h4 className="mb-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
          Duration by Session
        </h4>
        <div className="space-y-2">
          {slide.sessions
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 15)
            .map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-right text-xs font-heading font-medium text-hoxton-slate tabular-nums">
                  {formatDuration(s.duration)}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(s.duration / maxSessionDur) * 100}%`,
                      backgroundColor: heatColor(s.duration / maxSessionDur),
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════
   Main Analytics Tab Component
   ═══════════════════════════════════ */

export function ProposalAnalyticsTab({
  proposalId,
  totalSlideCount,
  slideImages,
}: {
  proposalId: string
  totalSlideCount: number
  /** Map of slide index → image URL for heatmap thumbnails */
  slideImages: { index: number; url: string; label: string }[]
}) {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [heatmap, setHeatmap] = useState<SlideHeatmapItem[]>([])
  const [sessions, setSessions] = useState<ViewerSession[]>([])
  const [isLive, setIsLive] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [selectedSlide, setSelectedSlide] = useState<SlideHeatmapItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [overviewData, heatmapData, sessionData, live] = await Promise.all([
      getProposalAnalytics(proposalId, totalSlideCount),
      getSlideHeatmapData(proposalId),
      getViewerSessions(proposalId, totalSlideCount),
      hasRecentViewer(proposalId),
    ])
    setOverview(overviewData)
    setHeatmap(heatmapData)
    setSessions(sessionData)
    setIsLive(live)
    setLoading(false)
  }, [proposalId, totalSlideCount])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Refresh live indicator every 60s
  useEffect(() => {
    const timer = setInterval(async () => {
      const live = await hasRecentViewer(proposalId)
      setIsLive(live)
    }, 60000)
    return () => clearInterval(timer)
  }, [proposalId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-hoxton-slate" />
      </div>
    )
  }

  if (!overview || overview.totalViews === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center">
        <BarChart3 className="mx-auto mb-3 h-12 w-12 text-gray-200" />
        <p className="text-lg font-heading font-medium text-hoxton-deep">No views yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm font-body leading-relaxed text-hoxton-slate">
          Once your client opens the proposal link, you&apos;ll see detailed analytics here — including which slides they spent the most time on.
        </p>
      </div>
    )
  }

  // Build merged heatmap: all slides from slideImages, with analytics data overlaid
  const heatmapByIndex: Record<number, SlideHeatmapItem> = {}
  for (const h of heatmap) heatmapByIndex[h.slideIndex] = h

  const mergedHeatmap: (SlideHeatmapItem & { url: string })[] = slideImages.map((img) => {
    const data = heatmapByIndex[img.index]
    return {
      slideIndex: img.index,
      slideTitle: data?.slideTitle || img.label,
      viewCount: data?.viewCount ?? 0,
      avgDuration: data?.avgDuration ?? 0,
      minDuration: data?.minDuration ?? 0,
      maxDuration: data?.maxDuration ?? 0,
      sessions: data?.sessions ?? [],
      url: img.url,
    }
  })

  const maxAvgDuration = Math.max(...mergedHeatmap.map((s) => s.avgDuration), 1)

  // Find selected slide image URL
  const selectedSlideUrl = selectedSlide
    ? slideImages.find((s) => s.index === selectedSlide.slideIndex)?.url || ''
    : ''

  return (
    <div className="space-y-6">
      {/* Live indicator */}
      {isLive && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-heading font-medium text-emerald-700">
            Someone is viewing now
          </span>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Eye className="h-4 w-4" />}
          label="Total Views"
          value={String(overview.totalViews)}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Unique Visitors"
          value={String(overview.uniqueVisitors)}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg. Time Spent"
          value={formatDuration(overview.avgTimeSpent)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completion Rate"
          value={`${overview.completionRate}%`}
          subtitle="Viewed 80%+ of slides"
        />
      </div>

      {/* ── Slide Heatmap ── */}
      {mergedHeatmap.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
              Slide Engagement Heatmap
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-heading font-medium text-hoxton-slate">Low</span>
              <div
                className="h-2.5 w-24 rounded-full"
                style={{
                  background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})`,
                }}
              />
              <span className="text-[10px] font-heading font-medium text-hoxton-slate">High</span>
            </div>
          </div>

          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            }}
          >
            {mergedHeatmap.map((slide) => {
              const heat = maxAvgDuration > 0 ? slide.avgDuration / maxAvgDuration : 0

              return (
                <button
                  key={slide.slideIndex}
                  onClick={() => setSelectedSlide(slide)}
                  className="group overflow-hidden rounded-xl border border-gray-100 text-left transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-video overflow-hidden bg-gray-50">
                    <SlideThumb src={slide.url} alt={slide.slideTitle} />
                    <div
                      className="absolute inset-0 transition-opacity group-hover:opacity-70"
                      style={{
                        backgroundColor: heatColor(heat),
                        opacity: slide.viewCount > 0 ? 0.35 : 0.1,
                      }}
                    />
                    <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-heading font-semibold text-white tabular-nums">
                      {slide.viewCount > 0 ? formatDuration(slide.avgDuration) : '—'}
                    </div>
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[10px] font-heading font-medium text-hoxton-deep">
                      {slide.slideTitle}
                    </p>
                    <p className="text-[9px] font-body text-gray-400">
                      {slide.viewCount > 0
                        ? `${slide.viewCount} view${slide.viewCount !== 1 ? 's' : ''}`
                        : 'No views'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Viewer Sessions ── */}
      {sessions.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="border-b border-gray-50 px-6 py-4">
            <h3 className="text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
              Viewer Activity
            </h3>
          </div>

          <div className="divide-y divide-gray-50">
            {sessions.map((session) => {
              const isExpanded = expandedSession === session.viewId
              const completionPct = session.totalSlides > 0
                ? Math.round((session.slidesViewed / session.totalSlides) * 100)
                : 0

              return (
                <div key={session.viewId}>
                  <button
                    onClick={() =>
                      setExpandedSession(isExpanded ? null : session.viewId)
                    }
                    className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50/50"
                  >
                    {/* Device icon */}
                    <div className="shrink-0 text-hoxton-slate">
                      <DeviceIcon type={session.deviceType} />
                    </div>

                    {/* Name + email */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-heading font-medium text-hoxton-deep">
                          {session.recipientName}
                        </p>
                        {!session.isUniqueVisitor && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-heading font-semibold text-amber-700">
                            Return visit
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs font-body text-gray-400">
                        {session.recipientEmail}
                      </p>
                    </div>

                    {/* Time ago */}
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-xs font-heading font-medium text-hoxton-slate">
                        {timeAgo(session.startedAt)}
                      </p>
                      <p className="text-[10px] font-body text-gray-400">
                        {formatDuration(session.totalDuration)}
                      </p>
                    </div>

                    {/* Completion bar */}
                    <div className="hidden w-28 shrink-0 sm:block">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] font-heading font-medium text-hoxton-slate tabular-nums">
                          {session.slidesViewed} / {session.totalSlides}
                        </span>
                        <span className="text-[10px] font-heading font-medium text-hoxton-slate tabular-nums">
                          {completionPct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-hoxton-turquoise transition-all"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Expand arrow */}
                    <div className="shrink-0 text-gray-300">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {/* Expanded: slide journey */}
                  {isExpanded && session.slides.length > 0 && (
                    <div className="border-t border-gray-50 bg-hoxton-light/30 px-6 py-4">
                      <p className="mb-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                        Slide Journey
                      </p>

                      {/* Mobile: duration + time ago */}
                      <div className="mb-3 flex items-center gap-4 sm:hidden">
                        <span className="text-xs font-heading font-medium text-hoxton-slate">
                          {timeAgo(session.startedAt)}
                        </span>
                        <span className="text-xs font-body text-gray-400">
                          {formatDuration(session.totalDuration)} total
                        </span>
                        <span className="text-xs font-body text-gray-400">
                          {session.slidesViewed}/{session.totalSlides} slides
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {session.slides.map((s, i) => {
                          const maxDur = Math.max(
                            ...session.slides.map((sl) => sl.duration ?? 0),
                            1
                          )
                          const barPct =
                            maxDur > 0 ? ((s.duration ?? 0) / maxDur) * 100 : 0

                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-5 shrink-0 text-right text-[10px] font-heading font-medium text-gray-400 tabular-nums">
                                {s.slideIndex + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.max(barPct, 2)}%`,
                                        backgroundColor: heatColor(
                                          barPct / 100
                                        ),
                                      }}
                                    />
                                  </div>
                                  <span className="w-10 shrink-0 text-right text-[10px] font-heading font-medium text-hoxton-slate tabular-nums">
                                    {s.duration != null
                                      ? formatDuration(s.duration)
                                      : '—'}
                                  </span>
                                </div>
                              </div>
                              <span className="hidden w-36 shrink-0 truncate text-[10px] font-body text-gray-400 sm:block">
                                {s.slideTitle || `Slide ${s.slideIndex + 1}`}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Slide Detail Modal ── */}
      {selectedSlide && (
        <SlideDetailModal
          slide={selectedSlide}
          slideImageUrl={selectedSlideUrl}
          onClose={() => setSelectedSlide(null)}
        />
      )}
    </div>
  )
}
