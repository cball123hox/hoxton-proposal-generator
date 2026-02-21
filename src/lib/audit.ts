import { supabase } from './supabase'
import { logger } from './logger'
import type { AuditAction } from '../types'

export async function logAudit(
  action: AuditAction,
  entityType: string,
  entityId: string,
  changes: Record<string, unknown>,
  userId: string
): Promise<void> {
  const { error } = await supabase.from('template_audit_log').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    changes,
    performed_by: userId,
  })
  if (error) {
    logger.error('[Audit] Failed to log:', error.message)
  }
}
