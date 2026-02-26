import { useState, useEffect, useCallback } from 'react'
import { Copy, Link2, Loader2, XCircle, ExternalLink, Send, X } from 'lucide-react'
import { Portal } from '../ui/Portal'
import { Badge } from '../ui/Badge'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../lib/auth'
import { createProposalLink, revokeProposalLink, getProposalLinks, getViewerUrl } from '../../lib/tracking'
import type { ProposalLink } from '../../types'

interface SendProposalModalProps {
  onClose: () => void
  proposalId: string
  clientName: string
  clientEmail?: string
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SendProposalModal({ onClose, proposalId, clientName, clientEmail }: SendProposalModalProps) {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [recipientName, setRecipientName] = useState(clientName)
  const [recipientEmail, setRecipientEmail] = useState(clientEmail ?? '')
  const [allowDownload, setAllowDownload] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  const [links, setLinks] = useState<ProposalLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    fetchLinks()
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEscape)
    }
  }, [handleEscape])

  async function fetchLinks() {
    setLoadingLinks(true)
    const data = await getProposalLinks(proposalId)
    setLinks(data)
    setLoadingLinks(false)
  }

  async function handleGenerate() {
    if (!user || !recipientEmail.trim() || !recipientName.trim()) return
    setGenerating(true)

    const result = await createProposalLink(
      proposalId,
      recipientEmail.trim(),
      recipientName.trim(),
      user.id,
      {
        allowDownload,
        expiresAt: expiresAt || null,
      }
    )

    if ('error' in result) {
      addToast('error', `Failed to create link: ${result.error}`)
    } else {
      setGeneratedLink(result.link)
      addToast('success', 'Tracking link created')
      fetchLinks()
    }

    setGenerating(false)
  }

  async function handleCopy() {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      addToast('success', 'Link copied to clipboard')
    } catch {
      addToast('error', 'Failed to copy link')
    }
  }

  async function handleCopyExisting(token: string) {
    try {
      await navigator.clipboard.writeText(getViewerUrl(token))
      addToast('success', 'Link copied to clipboard')
    } catch {
      addToast('error', 'Failed to copy link')
    }
  }

  async function handleRevoke(linkId: string) {
    setRevokingId(linkId)
    const result = await revokeProposalLink(linkId)
    if (result.error) {
      addToast('error', `Failed to revoke: ${result.error}`)
    } else {
      addToast('info', 'Link revoked')
      fetchLinks()
    }
    setRevokingId(null)
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-hoxton-turquoise" />
              <h3 className="font-heading font-semibold text-hoxton-deep">
                Send Proposal
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              {/* Generate new link form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Client name"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-hoxton-deep placeholder:text-gray-400 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
                  />
                </div>

                <div>
                  <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-hoxton-deep placeholder:text-gray-400 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-body text-hoxton-deep">
                    <input
                      type="checkbox"
                      checked={allowDownload}
                      onChange={(e) => setAllowDownload(e.target.checked)}
                      className="rounded border-gray-300 text-hoxton-turquoise focus:ring-hoxton-turquoise"
                    />
                    Allow PDF download
                  </label>

                  <div className="flex-1">
                    <input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
                      placeholder="Expiry date (optional)"
                    />
                  </div>
                </div>

                {!generatedLink ? (
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !recipientEmail.trim() || !recipientName.trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-hoxton-deep px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-deep/90 disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {generating ? 'Generating...' : 'Generate Tracking Link'}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg border border-hoxton-turquoise/30 bg-hoxton-turquoise/5 px-3 py-2.5">
                      <Link2 className="h-4 w-4 shrink-0 text-hoxton-turquoise" />
                      <span className="flex-1 truncate text-sm font-body text-hoxton-deep">{generatedLink}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-hoxton-turquoise px-3 py-2 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </button>
                      <button
                        onClick={() => setGeneratedLink(null)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-heading font-medium text-hoxton-deep transition-colors hover:bg-hoxton-light"
                      >
                        New Link
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Existing links table */}
              <div>
                <h3 className="mb-2 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                  Existing Links
                </h3>
                {loadingLinks ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-hoxton-slate" />
                  </div>
                ) : links.length === 0 ? (
                  <p className="py-4 text-center text-sm font-body text-gray-400">No links generated yet</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-hoxton-light text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                        <tr>
                          <th className="px-3 py-2">Recipient</th>
                          <th className="px-3 py-2">Sent</th>
                          <th className="px-3 py-2">Views</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {links.map((link) => {
                          const isExpired = link.expires_at && new Date(link.expires_at) < new Date()
                          return (
                            <tr key={link.id} className="bg-white">
                              <td className="px-3 py-2">
                                <div className="font-heading font-medium text-hoxton-deep truncate max-w-[120px]">
                                  {link.recipient_name}
                                </div>
                                <div className="text-xs font-body text-gray-400 truncate max-w-[120px]">
                                  {link.recipient_email}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs font-body text-hoxton-slate whitespace-nowrap">
                                {formatDate(link.sent_at)}
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-heading font-medium text-hoxton-deep">
                                  {link.view_count ?? 0}
                                </span>
                                {link.last_viewed_at && (
                                  <div className="text-[10px] font-body text-gray-400">
                                    Last: {formatDateTime(link.last_viewed_at)}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {!link.is_active ? (
                                  <Badge variant="error">Revoked</Badge>
                                ) : isExpired ? (
                                  <Badge variant="warning">Expired</Badge>
                                ) : (
                                  <Badge variant="success">Active</Badge>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  {link.is_active && !isExpired && (
                                    <button
                                      onClick={() => handleCopyExisting(link.token)}
                                      className="rounded p-1 text-hoxton-slate hover:bg-hoxton-grey/50 hover:text-hoxton-deep"
                                      title="Copy link"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {link.is_active && (
                                    <button
                                      onClick={() => handleRevoke(link.id)}
                                      disabled={revokingId === link.id}
                                      className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                      title="Revoke link"
                                    >
                                      {revokingId === link.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <XCircle className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
