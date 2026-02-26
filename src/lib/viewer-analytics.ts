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

/** Best-effort IP fetch — returns null if it fails or takes too long */
async function fetchViewerIp(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    return data.ip || null
  } catch {
    return null
  }
}

export async function initViewSession(linkId: string): Promise<string | null> {
  try {
    const userAgent = navigator.userAgent
    const sessionId = getSessionId()

    // Fire IP fetch in background — don't block session creation
    const ipPromise = fetchViewerIp()

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

    if (error) return null

    // Update IP in background once it resolves (non-blocking)
    ipPromise.then((ip) => {
      if (ip && data?.id) {
        supabase
          .from('link_views')
          .update({ viewer_ip: ip })
          .eq('id', data.id)
          .then(() => {})
      }
    })

    return data.id
  } catch {
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
    const { data, error } = await supabase
      .from('slide_analytics')
      .insert({
        view_id: viewId,
        link_id: linkId,
        slide_index: slideIndex,
        slide_title: slideTitle,
      })
      .select('id')
      .single()

    if (error) return null
    return data.id
  } catch {
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

    await supabase
      .from('slide_analytics')
      .update({
        time_exited: now.toISOString(),
        duration_seconds: Math.round(durationSeconds * 100) / 100,
      })
      .eq('id', analyticId)
  } catch {
    // fire-and-forget
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
