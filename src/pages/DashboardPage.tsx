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
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { StatusBadge } from '../components/ui/StatusBadge'
import { HoxtonLogo } from '../components/ui/HoxtonLogo'
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

function getMonthStart(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export function DashboardPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<ProposalStats>({ total: 0, sentThisMonth: 0, pendingApproval: 0, draft: 0 })
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [loading, setLoading] = useState(true)

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
