import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  FileText,
  Send,
  Clock,
  PenLine,
  Eye,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { StatusBadge } from '../components/ui/StatusBadge'
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
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({})
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

      // Fetch recent proposals with region join
      const { data: recentProposals } = await supabase
        .from('proposals')
        .select('id, client_name, region_id, selected_products, status, created_at, sent_at, regions(display_name)')
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentProposals) {
        setProposals(recentProposals as unknown as ProposalRow[])

        // Fetch open counts for these proposals
        const proposalIds = recentProposals.map((p) => p.id)
        if (proposalIds.length > 0) {
          const { data: events } = await supabase
            .from('proposal_events')
            .select('proposal_id')
            .in('proposal_id', proposalIds)
            .eq('event_type', 'opened')

          if (events) {
            const counts: Record<string, number> = {}
            events.forEach((e) => {
              counts[e.proposal_id] = (counts[e.proposal_id] || 0) + 1
            })
            setOpenCounts(counts)
          }
        }
      }

      setLoading(false)
    }

    fetchDashboard()
  }, [user])

  const statCards = [
    { label: 'Total Proposals', value: stats.total, icon: FileText, color: 'text-hoxton-deep' },
    { label: 'Sent This Month', value: stats.sentThisMonth, icon: Send, color: 'text-hoxton-turquoise' },
    { label: 'Pending Approval', value: stats.pendingApproval, icon: Clock, color: 'text-amber-500' },
    { label: 'Drafts', value: stats.draft, icon: PenLine, color: 'text-hoxton-slate' },
  ]

  return (
    <div>
      {/* Greeting */}
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

      {/* Recent Proposals */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-heading font-semibold text-hoxton-deep">
            Recent Proposals
          </h2>
          <Link
            to="/proposals"
            className="inline-flex items-center gap-1 text-sm font-heading font-medium text-hoxton-turquoise hover:text-hoxton-turquoise/80"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4 animate-pulse">
                <div className="h-4 w-32 rounded bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-5 w-24 rounded-full bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-10 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-heading font-medium text-hoxton-deep">
              No proposals yet
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
                    Products
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Date
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Opens
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {proposals.map((proposal) => (
                  <tr
                    key={proposal.id}
                    onClick={() => navigate(`/proposals/${proposal.id}`)}
                    className="cursor-pointer transition-colors hover:bg-hoxton-light/50"
                  >
                    <td className="px-6 py-4 text-sm font-heading font-medium text-hoxton-deep">
                      {proposal.client_name}
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                      {proposal.regions?.display_name ?? proposal.region_id.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                      {proposal.selected_products.length}{' '}
                      {proposal.selected_products.length === 1 ? 'module' : 'modules'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={proposal.status} />
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-gray-400">
                      {formatDate(proposal.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      {openCounts[proposal.id] ? (
                        <span className="inline-flex items-center gap-1 text-sm font-body text-hoxton-slate">
                          <Eye className="h-3.5 w-3.5" />
                          {openCounts[proposal.id]}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300">&mdash;</span>
                      )}
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
