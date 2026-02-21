import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Eye,
  Plus,
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ClientProposalsPage() {
  const { clientName: encodedName } = useParams<{ clientName: string }>()
  const clientName = decodeURIComponent(encodedName ?? '')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !clientName) return

    async function fetchClientProposals() {
      setLoading(true)

      const { data } = await supabase
        .from('proposals')
        .select('id, client_name, region_id, selected_products, status, created_at, sent_at, regions(display_name)')
        .eq('client_name', clientName)
        .order('created_at', { ascending: false })

      if (data) {
        setProposals(data as unknown as ProposalRow[])

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

    fetchClientProposals()
  }, [user, clientName])

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link
            to="/dashboard"
            className="mb-3 inline-flex items-center gap-1 text-sm font-heading font-medium text-hoxton-turquoise hover:text-hoxton-turquoise/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-heading font-semibold text-hoxton-deep">
            {clientName}
          </h1>
          <p className="mt-1 text-sm font-body text-hoxton-slate">
            {loading ? '...' : `${proposals.length} ${proposals.length === 1 ? 'proposal' : 'proposals'}`}
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

      {/* Proposals table */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-heading font-semibold text-hoxton-deep">
            Proposals
          </h2>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4 animate-pulse">
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
              No proposals found
            </p>
            <p className="mt-1 text-sm font-body text-gray-400">
              This client has no proposals yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
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
