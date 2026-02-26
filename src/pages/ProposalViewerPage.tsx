import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface LinkData {
  id: string
  proposal_id: string
  is_active: boolean
  expires_at: string | null
  allow_download: boolean
  recipient_name: string
  proposals: {
    client_name: string
    status: string
  }
}

export function ProposalViewerPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [link, setLink] = useState<LinkData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('No token provided')
      setLoading(false)
      return
    }

    async function validateLink() {
      const { data, error: fetchError } = await supabase
        .from('proposal_links')
        .select('id, proposal_id, is_active, expires_at, allow_download, recipient_name, proposals(client_name, status)')
        .eq('token', token!)
        .single()

      if (fetchError || !data) {
        setError('This link is invalid or has expired')
        setLoading(false)
        return
      }

      const linkData = data as unknown as LinkData

      if (!linkData.is_active) {
        setError('This link has been revoked')
        setLoading(false)
        return
      }

      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        setError('This link has expired')
        setLoading(false)
        return
      }

      setLink(linkData)
      setLoading(false)
    }

    validateLink()
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-hoxton-turquoise" />
          <p className="text-sm font-body text-gray-500">Loading proposal...</p>
        </div>
      </div>
    )
  }

  if (error || !link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-4 max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-400" />
          <h1 className="text-lg font-heading font-semibold text-hoxton-deep">
            {error || 'This link is invalid or has expired'}
          </h1>
          <p className="mt-2 text-sm font-body text-gray-500">
            Please contact your adviser for a new link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="mx-4 max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-hoxton-turquoise/10">
          <FileText className="h-7 w-7 text-hoxton-turquoise" />
        </div>
        <h1 className="text-xl font-heading font-semibold text-hoxton-deep">
          {link.proposals.client_name}
        </h1>
        <p className="mt-2 text-sm font-body text-gray-500">
          Proposal for {link.recipient_name}
        </p>
        <div className="mt-6 rounded-xl bg-hoxton-light p-4">
          <p className="text-sm font-heading font-medium text-hoxton-deep">
            Interactive viewer coming soon
          </p>
          <p className="mt-1 text-xs font-body text-hoxton-slate">
            The full proposal viewer with slide navigation and analytics tracking will be available in the next update.
          </p>
        </div>
      </div>
    </div>
  )
}
