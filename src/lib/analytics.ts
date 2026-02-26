import { supabase } from './supabase'

/* ── Types ── */

export interface AnalyticsOverview {
  totalViews: number
  uniqueVisitors: number
  avgTimeSpent: number // seconds
  completionRate: number // 0-100
}

export interface SlideHeatmapItem {
  slideIndex: number
  slideTitle: string
  viewCount: number
  avgDuration: number // seconds
  minDuration: number
  maxDuration: number
  /** Per-session durations: { viewId, duration } */
  sessions: { viewId: string; duration: number }[]
}

export interface ViewerSession {
  viewId: string
  linkId: string
  recipientName: string
  recipientEmail: string
  deviceType: string | null
  startedAt: string
  totalDuration: number // seconds
  slidesViewed: number
  totalSlides: number
  isUniqueVisitor: boolean
  /** Ordered slide journey */
  slides: {
    slideIndex: number
    slideTitle: string | null
    timeEntered: string
    duration: number | null
  }[]
}

/* ── Data fetching ── */

export async function getProposalAnalytics(
  proposalId: string,
  totalSlideCount: number
): Promise<AnalyticsOverview> {
  // Get all links for this proposal
  const { data: links } = await supabase
    .from('proposal_links')
    .select('id')
    .eq('proposal_id', proposalId)

  if (!links || links.length === 0) {
    return { totalViews: 0, uniqueVisitors: 0, avgTimeSpent: 0, completionRate: 0 }
  }

  const linkIds = links.map((l) => l.id)

  // Get all views
  const { data: views } = await supabase
    .from('link_views')
    .select('id, is_unique_visitor')
    .in('link_id', linkIds)

  if (!views || views.length === 0) {
    return { totalViews: 0, uniqueVisitors: 0, avgTimeSpent: 0, completionRate: 0 }
  }

  const totalViews = views.length
  const uniqueVisitors = views.filter((v) => v.is_unique_visitor).length
  const viewIds = views.map((v) => v.id)

  // Get all slide analytics
  const { data: slideData } = await supabase
    .from('slide_analytics')
    .select('view_id, slide_index, duration_seconds')
    .in('view_id', viewIds)

  if (!slideData || slideData.length === 0) {
    return { totalViews, uniqueVisitors, avgTimeSpent: 0, completionRate: 0 }
  }

  // Avg time spent per session
  const sessionDurations: Record<string, number> = {}
  const sessionSlides: Record<string, Set<number>> = {}

  for (const s of slideData) {
    if (!sessionDurations[s.view_id]) {
      sessionDurations[s.view_id] = 0
      sessionSlides[s.view_id] = new Set()
    }
    sessionDurations[s.view_id] += s.duration_seconds ?? 0
    sessionSlides[s.view_id].add(s.slide_index)
  }

  const durations = Object.values(sessionDurations)
  const avgTimeSpent = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0

  // Completion rate: % of viewers who saw >= 80% of slides
  const threshold = Math.ceil(totalSlideCount * 0.8)
  const completedSessions = Object.values(sessionSlides).filter(
    (s) => s.size >= threshold
  ).length
  const completionRate = viewIds.length > 0
    ? Math.round((completedSessions / viewIds.length) * 100)
    : 0

  return { totalViews, uniqueVisitors, avgTimeSpent, completionRate }
}

export async function getSlideHeatmapData(
  proposalId: string
): Promise<SlideHeatmapItem[]> {
  const { data: links } = await supabase
    .from('proposal_links')
    .select('id')
    .eq('proposal_id', proposalId)

  if (!links || links.length === 0) return []

  const linkIds = links.map((l) => l.id)

  const { data: views } = await supabase
    .from('link_views')
    .select('id')
    .in('link_id', linkIds)

  if (!views || views.length === 0) return []

  const viewIds = views.map((v) => v.id)

  const { data: slideData } = await supabase
    .from('slide_analytics')
    .select('view_id, slide_index, slide_title, duration_seconds')
    .in('view_id', viewIds)

  if (!slideData || slideData.length === 0) return []

  // Group by slide_index
  const slideMap: Record<number, {
    title: string
    durations: number[]
    sessions: { viewId: string; duration: number }[]
    viewIds: Set<string>
  }> = {}

  for (const s of slideData) {
    const idx = s.slide_index
    if (!slideMap[idx]) {
      slideMap[idx] = {
        title: s.slide_title || `Slide ${idx + 1}`,
        durations: [],
        sessions: [],
        viewIds: new Set(),
      }
    }
    const dur = s.duration_seconds ?? 0
    slideMap[idx].durations.push(dur)
    slideMap[idx].viewIds.add(s.view_id)
    slideMap[idx].sessions.push({ viewId: s.view_id, duration: dur })
  }

  return Object.entries(slideMap)
    .map(([idx, data]) => ({
      slideIndex: Number(idx),
      slideTitle: data.title,
      viewCount: data.viewIds.size,
      avgDuration: data.durations.length > 0
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
        : 0,
      minDuration: data.durations.length > 0 ? Math.min(...data.durations) : 0,
      maxDuration: data.durations.length > 0 ? Math.max(...data.durations) : 0,
      sessions: data.sessions,
    }))
    .sort((a, b) => a.slideIndex - b.slideIndex)
}

export async function getViewerSessions(
  proposalId: string,
  totalSlideCount: number
): Promise<ViewerSession[]> {
  const { data: links } = await supabase
    .from('proposal_links')
    .select('id, recipient_name, recipient_email')
    .eq('proposal_id', proposalId)

  if (!links || links.length === 0) return []

  const linkMap: Record<string, { name: string; email: string }> = {}
  for (const l of links) {
    linkMap[l.id] = { name: l.recipient_name, email: l.recipient_email }
  }

  const linkIds = links.map((l) => l.id)

  const { data: views } = await supabase
    .from('link_views')
    .select('id, link_id, device_type, started_at, is_unique_visitor')
    .in('link_id', linkIds)
    .order('started_at', { ascending: false })

  if (!views || views.length === 0) return []

  const viewIds = views.map((v) => v.id)

  const { data: slideData } = await supabase
    .from('slide_analytics')
    .select('view_id, slide_index, slide_title, time_entered, duration_seconds')
    .in('view_id', viewIds)
    .order('time_entered', { ascending: true })

  // Group slide data by view_id
  const slidesByView: Record<string, typeof slideData> = {}
  if (slideData) {
    for (const s of slideData) {
      if (!slidesByView[s.view_id]) slidesByView[s.view_id] = []
      slidesByView[s.view_id].push(s)
    }
  }

  return views.map((v) => {
    const linkInfo = linkMap[v.link_id] || { name: 'Unknown', email: '' }
    const slides = slidesByView[v.id] || []
    const totalDuration = slides.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)
    const uniqueSlideIndices = new Set(slides.map((s) => s.slide_index))

    return {
      viewId: v.id,
      linkId: v.link_id,
      recipientName: linkInfo.name,
      recipientEmail: linkInfo.email,
      deviceType: v.device_type,
      startedAt: v.started_at,
      totalDuration,
      slidesViewed: uniqueSlideIndices.size,
      totalSlides: totalSlideCount,
      isUniqueVisitor: v.is_unique_visitor,
      slides: slides.map((s) => ({
        slideIndex: s.slide_index,
        slideTitle: s.slide_title,
        timeEntered: s.time_entered,
        duration: s.duration_seconds,
      })),
    }
  })
}

/** Check if any view started in the last N minutes */
export async function hasRecentViewer(
  proposalId: string,
  minutesAgo = 5
): Promise<boolean> {
  const { data: links } = await supabase
    .from('proposal_links')
    .select('id')
    .eq('proposal_id', proposalId)

  if (!links || links.length === 0) return false

  const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('link_views')
    .select('id', { count: 'exact', head: true })
    .in('link_id', links.map((l) => l.id))
    .gte('started_at', cutoff)

  return (count ?? 0) > 0
}
