import type { ProposalStatus } from '../../types'
import { Badge } from './Badge'

const STATUS_CONFIG: Record<ProposalStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  draft: { label: 'Draft', variant: 'default' },
  pending_approval: { label: 'Pending Approval', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  sent: { label: 'Sent', variant: 'info' },
}

interface StatusBadgeProps {
  status: ProposalStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
