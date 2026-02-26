import { supabase } from './supabase'
import type { ProposalLink } from '../types'

const TOKEN_LENGTH = 12
const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function generateTrackingToken(): string {
  const array = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => TOKEN_CHARS[byte % TOKEN_CHARS.length]).join('')
}

export function getViewerUrl(token: string): string {
  return `${window.location.origin}/view/${token}`
}

interface CreateLinkOptions {
  allowDownload?: boolean
  expiresAt?: string | null
}

export async function createProposalLink(
  proposalId: string,
  recipientEmail: string,
  recipientName: string,
  sentBy: string,
  options?: CreateLinkOptions
): Promise<{ link: string; token: string; data: ProposalLink } | { error: string }> {
  const token = generateTrackingToken()

  const { data, error } = await supabase
    .from('proposal_links')
    .insert({
      proposal_id: proposalId,
      token,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      sent_by: sentBy,
      allow_download: options?.allowDownload ?? true,
      expires_at: options?.expiresAt ?? null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return {
    link: getViewerUrl(token),
    token,
    data: data as ProposalLink,
  }
}

export async function revokeProposalLink(linkId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('proposal_links')
    .update({ is_active: false })
    .eq('id', linkId)

  if (error) return { error: error.message }
  return {}
}

export async function getProposalLinks(proposalId: string): Promise<ProposalLink[]> {
  const { data: links, error } = await supabase
    .from('proposal_links')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })

  if (error || !links) return []

  // Fetch view counts for each link
  const linkIds = links.map((l) => l.id)
  if (linkIds.length === 0) return links as ProposalLink[]

  const { data: viewCounts } = await supabase
    .from('link_views')
    .select('link_id, started_at')
    .in('link_id', linkIds)

  const countMap: Record<string, { count: number; lastViewed: string | null }> = {}
  if (viewCounts) {
    for (const v of viewCounts) {
      if (!countMap[v.link_id]) {
        countMap[v.link_id] = { count: 0, lastViewed: null }
      }
      countMap[v.link_id].count++
      if (!countMap[v.link_id].lastViewed || v.started_at > countMap[v.link_id].lastViewed!) {
        countMap[v.link_id].lastViewed = v.started_at
      }
    }
  }

  return links.map((l) => ({
    ...(l as ProposalLink),
    view_count: countMap[l.id]?.count ?? 0,
    last_viewed_at: countMap[l.id]?.lastViewed ?? null,
  }))
}
