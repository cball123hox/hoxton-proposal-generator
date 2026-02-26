import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plus,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { StatusBadge } from '../components/ui/StatusBadge'
import { markNotificationsAsSeen, getProposalViewStats, type ProposalViewStats } from '../lib/notifications'
import { REGIONS } from '../lib/constants'
import type { ProposalStatus } from '../types'

type FilterTab = 'all' | 'draft' | 'pending_approval' | 'sent'
type SortMode = 'newest' | 'recently_viewed'

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

function regionName(regionId: string): string {
  return REGIONS.find((r) => r.id === regionId)?.display ?? regionId.toUpperCase()
}

export function MyProposalsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<FilterTab>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [viewStats, setViewStats] = useState<Record<string, ProposalViewStats>>({})
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'system_admin'

  // Mark notifications as seen when visiting this page
  useEffect(() => {
    markNotificationsAsSeen()
  }, [])

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
        query = query.eq('advisor_id', user!.id)
      }

      if (tab !== 'all') {
        query = query.eq('status', tab)
      }

      const { data, count } = await query

      if (data) {
        setProposals(data as ProposalRow[])
        setTotalCount(count ?? 0)

        // Fetch view stats
        const proposalIds = data.map((p) => p.id)
        if (proposalIds.length > 0) {
          const stats = await getProposalViewStats(proposalIds)
          setViewStats(stats)
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

  // Apply sort
  const sortedProposals = [...proposals]
  if (sortMode === 'recently_viewed') {
    sortedProposals.sort((a, b) => {
      const aLast = viewStats[a.id]?.lastViewedAt || ''
      const bLast = viewStats[b.id]?.lastViewedAt || ''
      if (!aLast && !bLast) return 0
      if (!aLast) return 1
      if (!bLast) return -1
      return bLast.localeCompare(aLast)
    })
  }

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

      {/* Filter Tabs + Sort */}
      <div className="mb-6 flex items-center justify-between">
        <div className="inline-flex gap-1 rounded-xl bg-white p-1 shadow-sm border border-gray-100">
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

        <button
          onClick={() => setSortMode(sortMode === 'newest' ? 'recently_viewed' : 'newest')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs font-heading font-medium text-hoxton-slate transition-colors hover:bg-hoxton-light hover:text-hoxton-deep"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortMode === 'newest' ? 'Newest first' : 'Recently viewed'}
        </button>
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
                    Client Views
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedProposals.map((p) => {
                  const vs = viewStats[p.id]
                  const views = vs?.totalViews ?? 0

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
                        {views > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/proposals/${p.id}?tab=analytics`)
                            }}
                            className="group flex items-center gap-2"
                          >
                            <div className="flex items-center gap-1.5">
                              {vs?.isLive && (
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                              )}
                              <Eye className="h-3.5 w-3.5 text-hoxton-slate group-hover:text-hoxton-turquoise" />
                              <span className="text-sm font-heading font-medium text-hoxton-slate group-hover:text-hoxton-turquoise">
                                {views}
                              </span>
                            </div>
                            {vs?.lastViewedAt && (
                              <span className="text-[10px] font-body text-gray-400">
                                {timeAgo(vs.lastViewedAt)}
                              </span>
                            )}
                          </button>
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
