import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plus,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { StatusBadge } from '../components/ui/StatusBadge'
import { REGIONS } from '../lib/constants'
import type { ProposalStatus } from '../types'

type FilterTab = 'all' | 'draft' | 'pending_approval' | 'sent'

interface ProposalRow {
  id: string
  client_name: string
  hxt_reference: string | null
  region_id: string
  selected_products: string[]
  status: ProposalStatus
  created_at: string
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'sent', label: 'Sent' },
]

const PAGE_SIZE = 20

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function regionName(regionId: string): string {
  return REGIONS.find((r) => r.id === regionId)?.display ?? regionId.toUpperCase()
}

export function MyProposalsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<FilterTab>('all')
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({})
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'system_admin'

  useEffect(() => {
    if (!user) return

    async function fetchProposals() {
      setLoading(true)

      let query = supabase
        .from('proposals')
        .select('id, client_name, hxt_reference, region_id, selected_products, status, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (!isAdmin) {
        query = query.eq('advisor_id', user.id)
      }

      if (tab !== 'all') {
        query = query.eq('status', tab)
      }

      const { data, count } = await query

      if (data) {
        setProposals(data as ProposalRow[])
        setTotalCount(count ?? 0)

        // Fetch open counts
        const proposalIds = data.map((p) => p.id)
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

    fetchProposals()
  }, [user, isAdmin, tab, page])

  // Reset to page 0 when changing tab
  useEffect(() => {
    setPage(0)
  }, [tab])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-hoxton-deep">
            My Proposals
            {!loading && (
              <span className="ml-2 text-lg font-normal text-hoxton-slate">
                ({totalCount})
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm font-body text-hoxton-slate">
            {isAdmin ? 'All proposals across advisors' : 'View and manage your proposals'}
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

      {/* Filter Tabs */}
      <div className="mb-6 inline-flex gap-1 rounded-xl bg-white p-1 shadow-sm border border-gray-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-heading font-medium transition-colors ${
              tab === t.key
                ? 'bg-hoxton-turquoise text-white shadow-sm'
                : 'text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4 animate-pulse">
                <div className="h-4 w-32 rounded bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-24 rounded bg-gray-100" />
                <div className="h-4 w-12 rounded bg-gray-100" />
                <div className="h-5 w-20 rounded-full bg-gray-100" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-10 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-heading font-medium text-hoxton-deep">
              {tab === 'all' ? 'No proposals yet' : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} proposals`}
            </p>
            <p className="mt-1 text-sm font-body text-gray-400">
              {tab === 'all'
                ? 'Create your first proposal to get started'
                : 'Try a different filter or create a new proposal'}
            </p>
            {tab === 'all' && (
              <Link
                to="/proposals/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2 text-sm font-heading font-semibold text-white hover:bg-hoxton-turquoise/90"
              >
                <Plus className="h-4 w-4" />
                New Proposal
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Client Name
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    HXT Ref
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
                    Created
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Client Opens
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {proposals.map((p) => {
                  const opens = openCounts[p.id] ?? 0
                  const maxBar = 10

                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/proposals/${p.id}`)}
                      className="cursor-pointer transition-colors hover:bg-hoxton-light/50"
                    >
                      <td className="px-6 py-4 text-sm font-heading font-medium text-hoxton-deep">
                        {p.client_name}
                      </td>
                      <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                        {p.hxt_reference ? (
                          <span className="rounded bg-hoxton-grey px-1.5 py-0.5 text-xs font-heading font-medium text-hoxton-deep">
                            {p.hxt_reference}
                          </span>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                        {regionName(p.region_id)}
                      </td>
                      <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                        {p.selected_products.length}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-6 py-4 text-sm font-body text-gray-400">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {opens > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-hoxton-turquoise"
                                style={{ width: `${Math.min((opens / maxBar) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs font-heading font-medium text-hoxton-slate">
                              <Eye className="h-3 w-3" />
                              {opens}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-300">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <p className="text-xs font-body text-gray-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`h-7 w-7 rounded-lg text-xs font-heading font-medium transition-colors ${
                    i === page
                      ? 'bg-hoxton-turquoise text-white'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
