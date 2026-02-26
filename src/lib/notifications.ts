import { supabase } from './supabase'

const LAST_SEEN_KEY = 'hxt_notif_last_seen'

/* ── Types ── */

export interface NotificationItem {
  id: string
  event_type: string
  event_data: Record<string, unknown> | null
  created_at: string
  proposal_id: string
  client_name: string
}

/* ── Data fetching ── */

/**
 * Fetch recent proposal_events for all proposals owned by the given user.
 * Joins with proposals to get client_name for display.
 */
export async function getRecentNotifications(
  userId: string,
  limit = 10
): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('proposal_events')
    .select('id, event_type, event_data, created_at, proposal_id, proposals!inner(client_name, advisor_id)')
    .eq('proposals.advisor_id', userId)
    .in('event_type', ['opened', 'downloaded', 'sent', 'approved', 'rejected', 'pdf_generated'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row: Record<string, unknown>) => {
    const proposals = row.proposals as Record<string, unknown> | null
    return {
      id: row.id as string,
      event_type: row.event_type as string,
      event_data: row.event_data as Record<string, unknown> | null,
      created_at: row.created_at as string,
      proposal_id: row.proposal_id as string,
      client_name: (proposals?.client_name as string) || 'Unknown',
    }
  })
}

/**
 * Count events newer than the given timestamp for all proposals owned by this user.
 */
export async function getUnreadCount(
  userId: string,
  lastSeen: string | null
): Promise<number> {
  if (!lastSeen) {
    // If never seen, count events from last 24h
    lastSeen = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }

  const { count, error } = await supabase
    .from('proposal_events')
    .select('id, proposals!inner(advisor_id)', { count: 'exact', head: true })
    .eq('proposals.advisor_id', userId)
    .in('event_type', ['opened', 'downloaded', 'sent', 'approved', 'rejected'])
    .gt('created_at', lastSeen)

  if (error) return 0
  return count ?? 0
}

/* ── Last-seen tracking ── */

export function getLastSeenTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY)
  } catch {
    return null
  }
}

export function markNotificationsAsSeen(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
  } catch {
    // localStorage unavailable
  }
}

/* ── View stats per proposal ── */

export interface ProposalViewStats {
  proposalId: string
  totalViews: number
  lastViewedAt: string | null
  isLive: boolean // viewed in last 5 min
}

/**
 * Fetch view stats for a batch of proposal IDs.
 */
export async function getProposalViewStats(
  proposalIds: string[]
): Promise<Record<string, ProposalViewStats>> {
  if (proposalIds.length === 0) return {}

  // Get opened events for these proposals
  const { data: events } = await supabase
    .from('proposal_events')
    .select('proposal_id, created_at')
    .in('proposal_id', proposalIds)
    .eq('event_type', 'opened')
    .order('created_at', { ascending: false })

  if (!events) return {}

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const statsMap: Record<string, ProposalViewStats> = {}

  for (const e of events) {
    if (!statsMap[e.proposal_id]) {
      statsMap[e.proposal_id] = {
        proposalId: e.proposal_id,
        totalViews: 0,
        lastViewedAt: null,
        isLive: false,
      }
    }
    statsMap[e.proposal_id].totalViews++
    if (!statsMap[e.proposal_id].lastViewedAt) {
      statsMap[e.proposal_id].lastViewedAt = e.created_at
    }
    if (e.created_at >= fiveMinAgo) {
      statsMap[e.proposal_id].isLive = true
    }
  }

  return statsMap
}
