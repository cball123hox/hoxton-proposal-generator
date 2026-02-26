import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft,
  Pencil,
  FileDown,
  FileText,
  Mail,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  MapPin,
  User,
  Layers,
  BarChart3,
  AlertTriangle,
  Eye,
  Send,
  Link2,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { logProposalEvent } from '../lib/proposal-events'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Badge } from '../components/ui/Badge'
import { REGIONS, PRODUCT_MODULES, CATEGORIES } from '../lib/constants'
import { getSlideUrl } from '../lib/storage'
import { getProposalLinks, getViewerUrl } from '../lib/tracking'
import { SendProposalModal } from '../components/proposal/SendProposalModal'
import { ProposalAnalyticsTab } from '../components/proposal/ProposalAnalyticsTab'
import type { Proposal, ProposalStatus, ProposalLink } from '../types'

type Tab = 'overview' | 'slides' | 'activity' | 'tracking' | 'analytics'

interface ProposalEvent {
  id: string
  event_type: string
  event_data: Record<string, unknown> | null
  created_at: string
  actor_id: string | null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function regionDisplay(regionId: string): string {
  return REGIONS.find((r) => r.id === regionId)?.display ?? regionId.toUpperCase()
}

function regionIntroSlides(regionId: string): number {
  return REGIONS.find((r) => r.id === regionId)?.introSlides ?? 0
}

/* ── Slide image with fallback ── */
function SlideThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-hoxton-deep">
        <span className="px-2 text-center text-[9px] font-heading font-medium leading-tight text-white/80">
          {alt}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

/* ── Time-ago helper ── */
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDateTime(dateStr)
}

/* ── Event icon + label mapping ── */
function eventIcon(type: string): { icon: React.ReactNode; color: string } {
  switch (type) {
    case 'created':
      return { icon: <FileText className="h-4 w-4" />, color: 'text-hoxton-turquoise bg-hoxton-turquoise/10' }
    case 'edited':
      return { icon: <Pencil className="h-4 w-4" />, color: 'text-hoxton-slate bg-hoxton-slate/10' }
    case 'submitted':
      return { icon: <Clock className="h-4 w-4" />, color: 'text-amber-500 bg-amber-50' }
    case 'approved':
      return { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-emerald-600 bg-emerald-50' }
    case 'rejected':
      return { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500 bg-red-50' }
    case 'sent':
      return { icon: <Send className="h-4 w-4" />, color: 'text-hoxton-turquoise bg-hoxton-turquoise/10' }
    case 'opened':
      return { icon: <Eye className="h-4 w-4" />, color: 'text-emerald-600 bg-emerald-50' }
    case 'pdf_generated':
      return { icon: <FileDown className="h-4 w-4" />, color: 'text-hoxton-deep bg-hoxton-light' }
    case 'downloaded':
      return { icon: <FileDown className="h-4 w-4" />, color: 'text-hoxton-turquoise bg-hoxton-turquoise/10' }
    case 'link_revoked':
      return { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500 bg-red-50' }
    default:
      return { icon: <Clock className="h-4 w-4" />, color: 'text-gray-400 bg-gray-50' }
  }
}

function eventLabel(type: string, data: Record<string, unknown> | null): string {
  const name = (data?.recipient_name as string) || ''
  switch (type) {
    case 'created': return 'Proposal created'
    case 'edited': return 'Proposal edited'
    case 'submitted': return 'Submitted for approval'
    case 'approved': return 'Proposal approved'
    case 'rejected': return 'Proposal rejected'
    case 'sent': return name ? `Tracking link sent to ${name}` : 'Tracking link sent'
    case 'opened': return name ? `Proposal opened by ${name}` : 'Proposal opened by client'
    case 'pdf_generated': return 'PDF generated'
    case 'downloaded': return name ? `PDF downloaded by ${name}` : 'PDF downloaded by client'
    case 'link_revoked': return name ? `Tracking link revoked for ${name}` : 'Tracking link revoked'
    default: return type
  }
}

function eventSubtitle(type: string, data: Record<string, unknown> | null): string | null {
  if (!data) return null
  const email = data.recipient_email as string | undefined
  const device = data.device_type as string | undefined
  const notes = data.notes as string | undefined

  if (type === 'sent' && email) return email
  if (type === 'opened') {
    const parts: string[] = []
    if (email) parts.push(email)
    if (device) parts.push(device)
    return parts.length > 0 ? parts.join(' · ') : null
  }
  if (type === 'downloaded' && email) return email
  if ((type === 'approved' || type === 'rejected') && notes) return notes
  return null
}

export function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [events, setEvents] = useState<ProposalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  // Action states
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Approval
  const [approvalNotes, setApprovalNotes] = useState('')
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false)

  // Tracking links
  const [trackingLinks, setTrackingLinks] = useState<ProposalLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)

  const isAdmin = profile?.role === 'system_admin'

  useEffect(() => {
    if (!id) return

    async function fetchProposal() {
      setLoading(true)

      const { data } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
        setProposal(data as Proposal)
      }

      const { data: eventData } = await supabase
        .from('proposal_events')
        .select('*')
        .eq('proposal_id', id)
        .order('created_at', { ascending: false })

      if (eventData) {
        setEvents(eventData as ProposalEvent[])
      }

      setLoading(false)
    }

    fetchProposal()
  }, [id])

  // Fetch tracking links on load (needed for Analytics tab visibility + Tracking tab)
  useEffect(() => {
    if (!id) return
    setLoadingLinks(true)
    getProposalLinks(id).then((data) => {
      setTrackingLinks(data)
      setLoadingLinks(false)
    })
  }, [id])

  // Refresh events helper
  async function refreshEvents() {
    if (!id) return
    // Small delay to let the INSERT propagate
    await new Promise((r) => setTimeout(r, 300))
    const { data: eventData } = await supabase
      .from('proposal_events')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false })
    if (eventData) setEvents(eventData as ProposalEvent[])
  }

  // Auto-refresh events every 30 seconds when on the activity tab
  useEffect(() => {
    if (tab !== 'activity' || !id) return
    const interval = setInterval(refreshEvents, 30_000)
    return () => clearInterval(interval)
  }, [tab, id])

  /* ── Actions ── */

  async function handleGeneratePdf() {
    if (!proposal) return
    setGenerating(true)
    // Mock PDF generation (3s delay)
    await new Promise((r) => setTimeout(r, 3000))
    const pdfPath = `/pdfs/${proposal.id}.pdf`
    await supabase
      .from('proposals')
      .update({ pdf_path: pdfPath, pdf_generated_at: new Date().toISOString() })
      .eq('id', proposal.id)
    setProposal({ ...proposal, pdf_path: pdfPath, pdf_generated_at: new Date().toISOString() })
    logProposalEvent(proposal.id, 'pdf_generated', {}, user?.id)
    refreshEvents()
    setGenerating(false)
  }

  async function handleDelete() {
    if (!proposal || !confirm('Are you sure you want to delete this draft?')) return
    setDeleting(true)
    await supabase.from('proposals').delete().eq('id', proposal.id)
    navigate('/proposals')
  }

  async function handleApprove() {
    if (!proposal || !user) return
    setApproving(true)
    await supabase
      .from('proposals')
      .update({
        status: 'approved' as ProposalStatus,
        approved_by: user.id,
        approval_notes: approvalNotes || null,
      })
      .eq('id', proposal.id)
    setProposal({ ...proposal, status: 'approved', approved_by: user.id, approval_notes: approvalNotes || undefined })
    logProposalEvent(proposal.id, 'approved', { notes: approvalNotes || undefined }, user.id)
    refreshEvents()
    setApproving(false)
  }

  async function handleReject() {
    if (!proposal || !user) return
    setRejecting(true)
    await supabase
      .from('proposals')
      .update({
        status: 'rejected' as ProposalStatus,
        approved_by: user.id,
        approval_notes: approvalNotes || null,
      })
      .eq('id', proposal.id)
    setProposal({ ...proposal, status: 'rejected', approved_by: user.id, approval_notes: approvalNotes || undefined })
    logProposalEvent(proposal.id, 'rejected', { notes: approvalNotes || undefined }, user.id)
    refreshEvents()
    setRejecting(false)
  }

  /* ── Build slide list for preview tab ── */
  function buildSlideList(): { section: string; slides: { src: string; label: string }[] }[] {
    if (!proposal) return []

    const sections: { section: string; slides: { src: string; label: string }[] }[] = []

    // Intro slides
    const introCount = regionIntroSlides(proposal.region_id)
    if (introCount > 0) {
      sections.push({
        section: `Intro Pack — ${regionDisplay(proposal.region_id)}`,
        slides: Array.from({ length: introCount }).map((_, i) => ({
          src: getSlideUrl(`intro-${proposal.region_id}/Slide${i + 1}.PNG`),
          label: `Intro Slide ${i + 1}`,
        })),
      })
    }

    // Product slides grouped by category
    const selectedMods = PRODUCT_MODULES.filter((m) =>
      proposal.selected_products.includes(m.id)
    )

    CATEGORIES.forEach((cat) => {
      const catMods = selectedMods.filter((m) => m.category === cat)
      catMods.forEach((mod) => {
        sections.push({
          section: mod.name,
          slides: Array.from({ length: mod.slides }).map((_, i) => ({
            src: getSlideUrl(`products/${mod.id}/Slide${i + 1}.PNG`),
            label: `${mod.name} — Slide ${i + 1}`,
          })),
        })
      })
    })

    return sections
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div>
        <div className="mb-6 animate-pulse">
          <div className="h-4 w-32 rounded bg-gray-100 mb-4" />
          <div className="h-8 w-64 rounded bg-gray-100 mb-2" />
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-gray-100" />
            <div className="h-6 w-24 rounded-full bg-gray-100" />
            <div className="h-6 w-28 rounded-full bg-gray-100" />
          </div>
        </div>
        <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="font-heading font-medium text-hoxton-deep">Proposal not found</p>
        <p className="mt-1 text-sm font-body text-gray-400">
          This proposal may have been deleted or you don't have access.
        </p>
        <Link
          to="/proposals"
          className="mt-4 inline-flex items-center gap-1 text-sm font-heading font-medium text-hoxton-turquoise hover:text-hoxton-turquoise/80"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to proposals
        </Link>
      </div>
    )
  }

  const totalSlides =
    regionIntroSlides(proposal.region_id) +
    PRODUCT_MODULES.filter((m) => proposal.selected_products.includes(m.id)).reduce(
      (sum, m) => sum + m.slides,
      0
    )

  const slideSections = buildSlideList()

  return (
    <div>
      {/* Back link */}
      <Link
        to="/proposals"
        className="mb-4 inline-flex items-center gap-1 text-sm font-heading font-medium text-hoxton-slate hover:text-hoxton-deep"
      >
        <ChevronLeft className="h-4 w-4" />
        All Proposals
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-hoxton-deep">
              {proposal.client_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {proposal.hxt_reference && (
                <Badge variant="default">{proposal.hxt_reference}</Badge>
              )}
              <StatusBadge status={proposal.status} />
              <Badge variant="info">{regionDisplay(proposal.region_id)}</Badge>
              <span className="text-sm font-body text-gray-400">
                Created {formatDate(proposal.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {proposal.status === 'draft' && (
            <Link
              to={`/proposals/new?edit=${proposal.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hoxton-grey bg-white px-3.5 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          )}

          {!proposal.pdf_path && (
            <button
              onClick={handleGeneratePdf}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-hoxton-deep px-3.5 py-2 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-deep/90 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {generating ? 'Generating...' : 'Generate PDF'}
            </button>
          )}

          {proposal.pdf_path && (
            <>
              <button
                onClick={async () => {
                  const { data } = await supabase.storage.from('proposals').createSignedUrl(proposal.pdf_path!, 3600)
                  if (data?.signedUrl) {
                    const a = document.createElement('a')
                    a.href = data.signedUrl
                    a.download = `${proposal.client_name.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
                    a.click()
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hoxton-grey bg-white px-3.5 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
              >
                <FileDown className="h-3.5 w-3.5" />
                Download PDF
              </button>
              <button
                onClick={async () => {
                  const { data } = await supabase.storage.from('proposals').createSignedUrl(proposal.pdf_path!, 3600)
                  if (data?.signedUrl) {
                    window.open(data.signedUrl, '_blank')
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hoxton-grey bg-white px-3.5 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </>
          )}

          {proposal.pdf_path && (
            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-hoxton-turquoise px-3.5 py-2 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90"
            >
              <Send className="h-3.5 w-3.5" />
              Send Proposal
            </button>
          )}

          <button
            onClick={() => setShowSendModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hoxton-grey bg-white px-3.5 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
          >
            <Mail className="h-3.5 w-3.5" />
            Email to Client
          </button>

          {proposal.status === 'draft' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-heading font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-100">
        <div className="flex gap-6 overflow-x-auto">
          {(
            [
              { key: 'overview', label: 'Overview' },
              { key: 'slides', label: 'Slide Preview' },
              { key: 'activity', label: 'Activity' },
              { key: 'tracking', label: 'Tracking' },
              { key: 'analytics', label: 'Analytics' },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 border-b-2 pb-3 text-sm font-heading font-medium transition-colors ${
                tab === t.key
                  ? 'border-hoxton-turquoise text-hoxton-turquoise'
                  : 'border-transparent text-hoxton-slate hover:border-gray-200 hover:text-hoxton-deep'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards row */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Client details */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-hoxton-turquoise" />
                <h3 className="text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
                  Client Details
                </h3>
              </div>
              <p className="text-lg font-heading font-medium text-hoxton-deep">
                {proposal.client_name}
              </p>
              {proposal.client_email && (
                <p className="mt-1 text-sm font-body text-hoxton-slate">
                  {proposal.client_email}
                </p>
              )}
              {proposal.hxt_reference && (
                <p className="mt-2 text-sm font-body text-hoxton-slate">
                  HXT Ref:{' '}
                  <span className="font-heading font-medium text-hoxton-deep">
                    {proposal.hxt_reference}
                  </span>
                </p>
              )}
            </div>

            {/* Region */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-hoxton-turquoise" />
                <h3 className="text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
                  Region
                </h3>
              </div>
              <p className="text-lg font-heading font-medium text-hoxton-deep">
                {regionDisplay(proposal.region_id)}
              </p>
              <p className="mt-1 text-sm font-body text-hoxton-slate">
                {regionIntroSlides(proposal.region_id)} intro slides
              </p>
            </div>

            {/* Slides */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-hoxton-turquoise" />
                <h3 className="text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
                  Total Slides
                </h3>
              </div>
              <p className="text-3xl font-heading font-semibold text-hoxton-deep">
                {totalSlides}
              </p>
              <p className="mt-1 text-sm font-body text-hoxton-slate">
                {proposal.selected_products.length} product{proposal.selected_products.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>

          {/* Products list */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h3 className="mb-4 text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
              Selected Products
            </h3>
            {proposal.selected_products.length === 0 ? (
              <p className="text-sm font-body text-gray-400">No products selected</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {proposal.selected_products.map((pid) => {
                  const mod = PRODUCT_MODULES.find((m) => m.id === pid)
                  return (
                    <div
                      key={pid}
                      className="flex items-center gap-2 rounded-lg border border-gray-100 bg-hoxton-light/50 px-3 py-2"
                    >
                      <span className="text-sm font-heading font-medium text-hoxton-deep">
                        {mod?.name ?? pid}
                      </span>
                      <span className="text-xs font-body text-gray-400">
                        {mod?.slides ?? 0} slides
                      </span>
                      {mod?.layout === 'old' && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-heading font-semibold uppercase text-amber-700">
                          Legacy
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Context summary */}
          {proposal.summary_context && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h3 className="mb-4 text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
                Summary Context
              </h3>
              <div className="space-y-4">
                {proposal.summary_context.situation && (
                  <div>
                    <p className="text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                      Situation
                    </p>
                    <p className="mt-1 text-sm font-body leading-relaxed text-hoxton-deep">
                      {proposal.summary_context.situation}
                    </p>
                  </div>
                )}
                {proposal.summary_context.objectives && (
                  <div>
                    <p className="text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                      Objectives
                    </p>
                    <p className="mt-1 text-sm font-body leading-relaxed text-hoxton-deep">
                      {proposal.summary_context.objectives}
                    </p>
                  </div>
                )}
                {proposal.summary_context.focus && (
                  <div>
                    <p className="text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                      Focus
                    </p>
                    <p className="mt-1 text-sm font-body leading-relaxed text-hoxton-deep">
                      {proposal.summary_context.focus}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fee data */}
          {proposal.fee_data && Object.keys(proposal.fee_data).length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h3 className="mb-4 text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
                Fee Information
              </h3>
              <pre className="text-sm font-body text-hoxton-deep whitespace-pre-wrap">
                {JSON.stringify(proposal.fee_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Approval section (admin only, pending proposals) */}
          {isAdmin && proposal.status === 'pending_approval' && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-heading font-semibold uppercase tracking-wider text-amber-700">
                  Approval Required
                </h3>
              </div>
              <p className="mb-4 text-sm font-body text-hoxton-slate">
                This proposal is awaiting your approval before it can be sent to the client.
              </p>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add notes (optional)..."
                rows={3}
                className="mb-4 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-body text-hoxton-deep placeholder:text-gray-400 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleApprove}
                  disabled={approving || rejecting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {approving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve
                </button>
                <button
                  onClick={handleReject}
                  disabled={approving || rejecting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {rejecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Show approval notes if already actioned */}
          {proposal.approval_notes && proposal.status !== 'pending_approval' && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h3 className="mb-2 text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
                Approval Notes
              </h3>
              <p className="text-sm font-body text-hoxton-deep">{proposal.approval_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Slide Preview ── */}
      {tab === 'slides' && (
        <div className="space-y-8">
          {slideSections.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center">
              <Layers className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="font-heading font-medium text-hoxton-deep">No slides to preview</p>
              <p className="mt-1 text-sm font-body text-gray-400">
                Select products in the proposal builder to see slides here.
              </p>
            </div>
          ) : (
            slideSections.map((section, sIdx) => (
              <div key={sIdx}>
                <div className="mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-hoxton-slate" />
                  <h3 className="text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                    {section.section}
                  </h3>
                  <span className="rounded-full bg-hoxton-grey px-2 py-0.5 text-[10px] font-heading font-medium text-hoxton-deep">
                    {section.slides.length} slides
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {section.slides.map((slide, i) => (
                    <div
                      key={i}
                      className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="aspect-video overflow-hidden bg-gray-50">
                        <SlideThumb src={slide.src} alt={slide.label} />
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="truncate text-[11px] font-heading font-medium text-hoxton-deep">
                          {slide.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tab: Activity ── */}
      {tab === 'activity' && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="flex items-center justify-between border-b border-gray-50 px-6 py-3">
            <h3 className="text-sm font-heading font-semibold text-hoxton-deep">
              Activity Timeline
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] font-body text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Auto-refreshing
            </span>
          </div>
          {events.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Clock className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="font-heading font-medium text-hoxton-deep">No activity yet</p>
              <p className="mt-1 text-sm font-body text-gray-400">
                Events will appear here as the proposal progresses.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {events.map((event) => {
                const display = eventIcon(event.event_type)
                const label = eventLabel(event.event_type, event.event_data)
                const subtitle = eventSubtitle(event.event_type, event.event_data)
                return (
                  <div key={event.id} className="flex items-start gap-3 px-6 py-4">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${display.color}`}>
                      {display.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-heading font-medium text-hoxton-deep">
                        {label}
                      </p>
                      {subtitle && (
                        <p className="mt-0.5 text-xs font-body text-hoxton-slate">
                          {subtitle}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-body text-gray-400" title={formatDateTime(event.created_at)}>
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tracking ── */}
      {tab === 'tracking' && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          {loadingLinks ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-hoxton-slate" />
            </div>
          ) : trackingLinks.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Link2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="font-heading font-medium text-hoxton-deep">No tracking links yet</p>
              <p className="mt-1 text-sm font-body text-gray-400">
                Send this proposal to generate tracking links.
              </p>
              {proposal.pdf_path && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-hoxton-turquoise px-4 py-2 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90"
                >
                  <Send className="h-4 w-4" />
                  Send Proposal
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="border-b border-gray-50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-heading font-semibold text-hoxton-deep">
                    {trackingLinks.length} tracking link{trackingLinks.length !== 1 ? 's' : ''}
                  </h3>
                  <span className="text-sm font-body text-hoxton-slate">
                    {trackingLinks.reduce((sum, l) => sum + (l.view_count ?? 0), 0)} total views
                  </span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {trackingLinks.map((link) => {
                  const isExpired = link.expires_at && new Date(link.expires_at) < new Date()
                  return (
                    <div key={link.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-heading font-medium text-hoxton-deep">
                          {link.recipient_name}
                        </p>
                        <p className="text-xs font-body text-gray-400">{link.recipient_email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-heading font-medium text-hoxton-deep">
                          {link.view_count ?? 0} views
                        </p>
                        {link.last_viewed_at && (
                          <p className="text-[10px] font-body text-gray-400">
                            Last: {formatDateTime(link.last_viewed_at)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!link.is_active ? (
                          <Badge variant="error">Revoked</Badge>
                        ) : isExpired ? (
                          <Badge variant="warning">Expired</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                        {link.is_active && !isExpired && (
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(getViewerUrl(link.token))
                              } catch { /* noop */ }
                            }}
                            className="rounded p-1.5 text-hoxton-slate hover:bg-hoxton-grey/50 hover:text-hoxton-deep"
                            title="Copy link"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Analytics ── */}
      {tab === 'analytics' && (
        <ProposalAnalyticsTab
          proposalId={proposal.id}
          totalSlideCount={totalSlides}
          slideImages={(() => {
            const images: { index: number; url: string; label: string }[] = []
            let idx = 0
            // Intro slides
            const introCount = regionIntroSlides(proposal.region_id)
            for (let i = 1; i <= introCount; i++) {
              images.push({
                index: idx++,
                url: getSlideUrl(`intro-${proposal.region_id}/Slide${i}.PNG`),
                label: `Intro ${i}`,
              })
            }
            // Product slides
            const selectedMods = PRODUCT_MODULES.filter((m) =>
              proposal.selected_products.includes(m.id)
            )
            for (const mod of selectedMods) {
              for (let i = 1; i <= mod.slides; i++) {
                images.push({
                  index: idx++,
                  url: getSlideUrl(`products/${mod.id}/Slide${i}.PNG`),
                  label: `${mod.name} ${i}`,
                })
              }
            }
            return images
          })()}
        />
      )}

      {/* Send Proposal Modal */}
      {showSendModal && (
        <SendProposalModal
          onClose={() => {
            setShowSendModal(false)
            // Refresh tracking links
            if (id) getProposalLinks(id).then(setTrackingLinks)
          }}
          proposalId={proposal.id}
          clientName={proposal.client_name}
          clientEmail={proposal.client_email}
        />
      )}
    </div>
  )
}
