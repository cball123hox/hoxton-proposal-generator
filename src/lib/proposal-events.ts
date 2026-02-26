import { supabase } from './supabase'

/**
 * Log a proposal event to the activity timeline.
 * Non-blocking — failures are silently ignored so they never block user actions.
 */
export async function logProposalEvent(
  proposalId: string,
  eventType: string,
  eventData?: Record<string, unknown>,
  actorId?: string
): Promise<void> {
  try {
    await supabase
      .from('proposal_events')
      .insert({
        proposal_id: proposalId,
        event_type: eventType,
        event_data: eventData || {},
        actor_id: actorId || null,
      })
  } catch {
    // Non-critical — don't block actions if event logging fails
  }
}
