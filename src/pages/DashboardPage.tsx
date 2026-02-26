import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  FileText,
  Send,
  Clock,
  PenLine,
  ChevronRight,
  ArrowRight,
  Users,
  Eye,
  FileDown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Bell,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { StatusBadge } from '../components/ui/StatusBadge'
import { HoxtonLogo } from '../components/ui/HoxtonLogo'
import {
  getRecentNotifications,
  getLastSeenTimestamp,
  markNotificationsAsSeen,
  type NotificationItem,
} from '../lib/notifications'
import type { ProposalStatus } from '../types'

interface ProposalRow {
  id: string
  client_name: string
  region_id: string
  selected_products: string[]
  status: ProposalStatus
  created_at: string
  sent_at: string | null
  regions: { display_name: string } | null
}

interface ClientGroup {
  clientName: string
  region: string
  proposalCount: number
  latestDate: string
  latestStatus: ProposalStatus
}

interface ProposalStats {
  total: number
  sentThisMonth: number
  pendingApproval: number
  draft: number
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

function getMonthStart(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

/* ── Notification display helpers ── */

function notifIcon(type: string): React.ReactNode {
  switch (type) {
    case 'opened': return <Eye className="h-4 w-4" />
    case 'downloaded': return <FileDown className="h-4 w-4" />
    case 'sent': return <Send className="h-4 w-4" />
    case 'approved': return <CheckCircle2 className="h-4 w-4" />
    case 'rejected': return <XCircle className="h-4 w-4" />
    case 'pdf_generated': return <FileDown className="h-4 w-4" />
    default: return <Bell className="h-4 w-4" />
  }
}

function notifColor(type: string): string {
  switch (type) {
    case 'opened': return 'text-emerald-600 bg-emerald-50'
    case 'downloaded': return 'text-hoxton-turquoise bg-hoxton-turquoise/10'
    case 'sent': return 'text-hoxton-turquoise bg-hoxton-turquoise/10'
    case 'approved': return 'text-emerald-600 bg-emerald-50'
    case 'rejected': return 'text-red-500 bg-red-50'
    case 'pdf_generated': return 'text-hoxton-deep bg-hoxton-light'
    default: return 'text-gray-400 bg-gray-50'
  }
}

function notifText(n: NotificationItem): string {
  const name = (n.event_data?.recipient_name as string) || n.client_name
  switch (n.event_type) {
    case 'opened': return `${name} opened your proposal`
    case 'downloaded': return `${name} downloaded the PDF`
    case 'sent': return `Tracking link sent to ${name}`
    case 'approved': return `Proposal for ${n.client_name} approved`
    case 'rejected': return `Proposal for ${n.client_name} rejected`
    case 'pdf_generated': return `PDF generated for ${n.client_name}`
    default: return `Activity on ${n.client_name}`
  }
}

export function DashboardPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<ProposalStats>({ total: 0, sentThisMonth: 0, pendingApproval: 0, draft: 0 })
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [lastSeen, setLastSeen] = useState<string | null>(null)

  const isAdmin = profile?.role === 'system_admin'

  useEffect(() => {
    if (!user) return

    async function fetchDashboard() {
      setLoading(true)

      // Fetch all proposals for stats (RLS handles access filtering)
      const { data: allProposals } = await supabase
        .from('proposals')
        .select('id, status, sent_at')

      if (allProposals) {
        const monthStart = getMonthStart()
        setStats({
          total: allProposals.length,
          sentThisMonth: allProposals.filter(
            (p) => p.status === 'sent' && p.sent_at && p.sent_at >= monthStart
          ).length,
          pendingApproval: allProposals.filter((p) => p.status === 'pending_approval').length,
          draft: allProposals.filter((p) => p.status === 'draft').length,
        })
      }

      // Fetch all proposals with region join (for client grouping)
      const { data: recentProposals } = await supabase
        .from('proposals')
        .select('id, client_name, region_id, selected_products, status, created_at, sent_at, regions(display_name)')
        .order('created_at', { ascending: false })

      if (recentProposals) {
        setProposals(recentProposals as unknown as ProposalRow[])
      }

      setLoading(false)
    }

    // Fetch notifications
    const ls = getLastSeenTimestamp()
    setLastSeen(ls)

    getRecentNotifications(user.id, 10).then(setNotifications)

    // Mark as seen when viewing dashboard
    markNotificationsAsSeen()

    fetchDashboard()
  }, [user])

  // Group proposals by client name
  const clientGroups = useMemo<ClientGroup[]>(() => {
    const groups = new Map<string, ProposalRow[]>()
    for (const p of proposals) {
      const existing = groups.get(p.client_name)
      if (existing) {
        existing.push(p)
      } else {
        groups.set(p.client_name, [p])
      }
    }

    return Array.from(groups.entries()).map(([clientName, clientProposals]) => {
      // Proposals are already sorted by created_at desc from the query
      const latest = clientProposals[0]
      return {
        clientName,
        region: latest.regions?.display_name ?? latest.region_id.toUpperCase(),
        proposalCount: clientProposals.length,
        latestDate: latest.created_at,
        latestStatus: latest.status,
      }
    })
  }, [proposals])

  const statCards = [
    { label: 'Total Proposals', value: stats.total, icon: FileText, color: 'text-hoxton-deep' },
    { label: 'Sent This Month', value: stats.sentThisMonth, icon: Send, color: 'text-hoxton-turquoise' },
    { label: 'Pending Approval', value: stats.pendingApproval, icon: Clock, color: 'text-amber-500' },
    { label: 'Drafts', value: stats.draft, icon: PenLine, color: 'text-hoxton-slate' },
  ]

  return (
    <div>
      {/* Logo + Greeting */}
      <div className="mb-2">
        <HoxtonLogo size="sm" variant="dark" />
      </div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-hoxton-deep">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-1 text-sm font-body text-hoxton-slate">
            Here's what's happening with your proposals
          </p>
        </div>
        <Link
          to="/proposals/new"
          className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90"
        >
          <Plus className="h-4 w-4" />
          New Proposal
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-100 bg-white p-6"
          >
            {loading ? (
              <div className="animate-pulse">
                <div className="mb-3 h-4 w-24 rounded bg-gray-100" />
                <div className="mb-2 h-9 w-16 rounded bg-gray-100" />
                <div className="h-3 w-20 rounded bg-gray-100" />
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-center gap-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-sm font-heading font-medium text-gray-400">
                    {card.label}
                  </span>
                </div>
                <p className={`text-3xl font-heading font-semibold ${card.color}`}>
                  {card.value}
                </p>
                <p className="mt-1 text-xs font-body text-gray-400">
                  {card.label === 'Sent This Month'
                    ? new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                    : isAdmin
                      ? 'Across all advisors'
                      : 'Your proposals'}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-hoxton-turquoise" />
            <h2 className="text-lg font-heading font-semibold text-hoxton-deep">
              Recent Activity
            </h2>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-heading font-medium text-hoxton-deep">No recent activity</p>
            <p className="mt-1 text-sm font-body text-gray-400">
              Client viewing events will appear here when proposals are shared.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((n) => {
              const isNew = lastSeen ? n.created_at > lastSeen : true
              return (
                <Link
                  key={n.id}
                  to={`/proposals/${n.proposal_id}?tab=analytics`}
                  className={`flex items-start gap-3 px-6 py-3.5 transition-colors hover:bg-hoxton-light/50 ${
                    isNew ? 'bg-hoxton-turquoise/[0.04]' : ''
                  }`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${notifColor(n.event_type)}`}>
                    {notifIcon(n.event_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-heading font-medium text-hoxton-deep">
                      {notifText(n)}
                    </p>
                    <p className="mt-0.5 text-xs font-body text-hoxton-slate">
                      {n.client_name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-body text-gray-400">
                    {timeAgo(n.created_at)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Clients Overview */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-heading font-semibold text-hoxton-deep">
            Clients
          </h2>
          <Link
            to="/proposals"
            className="inline-flex items-center gap-1 text-sm font-heading font-medium text-hoxton-turquoise hover:text-hoxton-turquoise/80"
          >
            View all proposals
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4 animate-pulse">
                <div className="h-4 w-32 rounded bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-16 rounded bg-gray-100" />
                <div className="h-5 w-24 rounded-full bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : clientGroups.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-heading font-medium text-hoxton-deep">
              No clients yet
            </p>
            <p className="mt-1 text-sm font-body text-gray-400">
              Create your first proposal to get started
            </p>
            <Link
              to="/proposals/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2 text-sm font-heading font-semibold text-white hover:bg-hoxton-turquoise/90"
            >
              <Plus className="h-4 w-4" />
              New Proposal
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Client
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Region
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Proposals
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Latest Status
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Last Updated
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientGroups.map((group) => (
                  <tr
                    key={group.clientName}
                    onClick={() => navigate(`/clients/${encodeURIComponent(group.clientName)}`)}
                    className="cursor-pointer transition-colors hover:bg-hoxton-light/50"
                  >
                    <td className="px-6 py-4 text-sm font-heading font-medium text-hoxton-deep">
                      {group.clientName}
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                      {group.region}
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                      {group.proposalCount} {group.proposalCount === 1 ? 'proposal' : 'proposals'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={group.latestStatus} />
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-gray-400">
                      {formatDate(group.latestDate)}
                    </td>
                    <td className="px-6 py-4">
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
