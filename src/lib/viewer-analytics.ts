import { supabase } from './supabase'

function getSessionId(): string {
  const key = 'hxt_viewer_session'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

function getDeviceType(): string {
  const ua = navigator.userAgent
  if (/Mobi|Android/i.test(ua)) return 'mobile'
  if (/Tablet|iPad/i.test(ua)) return 'tablet'
  return 'desktop'
}

export async function initViewSession(linkId: string): Promise<string | null> {
  try {
    console.log('[Analytics] initViewSession called with linkId:', linkId)
    const userAgent = navigator.userAgent
    const sessionId = getSessionId()

    // Check if this session has already viewed this link (unique visitor detection)
    let isUnique = true
    try {
      const { count } = await supabase
        .from('link_views')
        .select('id', { count: 'exact', head: true })
        .eq('link_id', linkId)
        .eq('session_id', sessionId)

      if (count && count > 0) isUnique = false
    } catch {
      // Non-critical — default to unique
    }

    const { data, error } = await supabase
      .from('link_views')
      .insert({
        link_id: linkId,
        user_agent: userAgent,
        device_type: getDeviceType(),
        referrer: document.referrer || null,
        session_id: sessionId,
        is_unique_visitor: isUnique,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Analytics] initViewSession INSERT error:', error)
      return null
    }

    console.log('[Analytics] initViewSession success, viewId:', data.id)
    return data.id
  } catch (err) {
    console.error('[Analytics] initViewSession exception:', err)
    return null
  }
}

export async function trackSlideEnter(
  viewId: string,
  linkId: string,
  slideIndex: number,
  slideTitle: string
): Promise<string | null> {
  try {
    console.log('[Analytics] trackSlideEnter:', { viewId, linkId, slideIndex, slideTitle })
    const { data, error } = await supabase
      .from('slide_analytics')
      .insert({
        view_id: viewId,
        link_id: linkId,
        slide_index: slideIndex,
        slide_title: slideTitle,
        time_entered: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Analytics] trackSlideEnter INSERT error:', error)
      return null
    }
    console.log('[Analytics] trackSlideEnter success, analyticId:', data.id)
    return data.id
  } catch (err) {
    console.error('[Analytics] trackSlideEnter exception:', err)
    return null
  }
}

export async function trackSlideExit(
  analyticId: string,
  timeEntered: Date
): Promise<void> {
  try {
    const now = new Date()
    const durationSeconds = (now.getTime() - timeEntered.getTime()) / 1000

    console.log('[Analytics] trackSlideExit:', { analyticId, durationSeconds: Math.round(durationSeconds * 100) / 100 })
    const { error } = await supabase
      .from('slide_analytics')
      .update({
        time_exited: now.toISOString(),
        duration_seconds: Math.round(durationSeconds * 100) / 100,
      })
      .eq('id', analyticId)

    if (error) {
      console.error('[Analytics] trackSlideExit UPDATE error:', error)
    }
  } catch (err) {
    console.error('[Analytics] trackSlideExit exception:', err)
  }
}

// State for flushing the last slide on unload
let _pendingExit: { analyticId: string; timeEntered: Date } | null = null

export function setPendingExit(analyticId: string, timeEntered: Date) {
  _pendingExit = { analyticId, timeEntered }
}

export function clearPendingExit() {
  _pendingExit = null
}

export function flushOnUnload() {
  if (!_pendingExit) return

  const { analyticId, timeEntered } = _pendingExit
  const now = new Date()
  const durationSeconds = (now.getTime() - timeEntered.getTime()) / 1000

  // Use fetch with keepalive for reliability on page unload (supports headers unlike sendBeacon)
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/slide_analytics?id=eq.${analyticId}`
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  fetch(url, {
    method: 'PATCH',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      time_exited: now.toISOString(),
      duration_seconds: Math.round(durationSeconds * 100) / 100,
    }),
  }).catch(() => {})

  _pendingExit = null
}
