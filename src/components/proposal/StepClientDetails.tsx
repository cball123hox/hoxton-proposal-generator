import { useEffect, useState } from 'react'
import { Search, Loader2, CheckCircle, AlertCircle, X, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { lookupClient } from '../../lib/client-lookup'
import type { ProposalDraft, Profile } from '../../types'

interface StepClientDetailsProps {
  draft: ProposalDraft
  updateDraft: (updates: Partial<ProposalDraft>) => void
  locked?: boolean
}

export function StepClientDetails({ draft, updateDraft, locked }: StepClientDetailsProps) {
  const { profile } = useAuth()
  const [advisors, setAdvisors] = useState<Pick<Profile, 'id' | 'full_name' | 'email'>[]>([])
  const [hxtInput, setHxtInput] = useState(draft.hxtNumber)
  const [looking, setLooking] = useState(false)
  const [found, setFound] = useState(draft.clientName !== '')
  const [notFound, setNotFound] = useState(false)

  const canDelegate = profile?.role === 'planner_admin' || profile?.role === 'power_planner'

  useEffect(() => {
    if (!canDelegate || !profile?.assigned_advisors?.length) return

    async function fetchAdvisors() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profile!.assigned_advisors!)
      if (data) setAdvisors(data)
    }

    fetchAdvisors()
  }, [canDelegate, profile])

  async function handleLookup() {
    if (!hxtInput.trim()) return
    setLooking(true)
    setNotFound(false)

    const client = await lookupClient(hxtInput)

    if (client) {
      updateDraft({
        hxtNumber: client.hxtNumber,
        clientName: client.name,
        clientEmail: client.email,
      })
      setHxtInput(client.hxtNumber)
      setFound(true)
    } else {
      setNotFound(true)
      setFound(false)
    }

    setLooking(false)
  }

  function handleClear() {
    setFound(false)
    setNotFound(false)
    setHxtInput('')
    updateDraft({ hxtNumber: '', clientName: '', clientEmail: '' })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleLookup()
    }
  }

  if (locked) {
    return (
      <div className="mx-auto max-w-lg">
        <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
          Client Details
        </h2>
        <p className="mt-1 mb-6 text-sm font-body text-hoxton-slate">
          Client details are locked for this proposal
        </p>

        <div className="rounded-2xl border border-hoxton-grey bg-hoxton-light p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-5 w-5 text-hoxton-turquoise" />
            <span className="text-sm font-heading font-semibold text-hoxton-deep">
              Locked
            </span>
          </div>

          <div className="space-y-2.5">
            {draft.hxtNumber && (
              <div>
                <span className="text-xs font-heading font-medium text-hoxton-slate">
                  HXT Reference
                </span>
                <p className="text-sm font-heading font-semibold text-hoxton-deep">
                  {draft.hxtNumber}
                </p>
              </div>
            )}
            <div>
              <span className="text-xs font-heading font-medium text-hoxton-slate">
                Client Name
              </span>
              <p className="text-sm font-heading font-semibold text-hoxton-deep">
                {draft.clientName}
              </p>
            </div>
            <div>
              <span className="text-xs font-heading font-medium text-hoxton-slate">
                Email
              </span>
              <p className="text-sm font-body text-hoxton-deep">
                {draft.clientEmail}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-xl font-heading font-semibold text-hoxton-deep">
        Client Details
      </h2>
      <p className="mt-1 mb-6 text-sm font-body text-hoxton-slate">
        Look up the client by their HXT reference number
      </p>

      <div className="space-y-5">
        {/* HXT Lookup */}
        {!found ? (
          <div className="space-y-1.5">
            <label
              htmlFor="hxtNumber"
              className="block text-sm font-heading font-medium text-hoxton-deep"
            >
              HXT Reference <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="hxtNumber"
                type="text"
                value={hxtInput}
                onChange={(e) => {
                  setHxtInput(e.target.value)
                  setNotFound(false)
                }}
                onKeyDown={handleKeyDown}
                placeholder="e.g. HXT-10472"
                className="flex-1 rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-3 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/50 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              />
              <button
                onClick={handleLookup}
                disabled={!hxtInput.trim() || looking}
                className="inline-flex items-center gap-2 rounded-xl bg-hoxton-turquoise px-5 py-3 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {looking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Look up
              </button>
            </div>

            {notFound && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span className="text-sm font-body text-red-700">
                  Client not found — check the HXT reference number
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Found client card */
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-heading font-semibold text-emerald-800">
                  Client found
                </span>
              </div>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-heading font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <X className="h-3.5 w-3.5" />
                Change
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <span className="text-xs font-heading font-medium text-emerald-700/70">
                  HXT Reference
                </span>
                <p className="text-sm font-heading font-semibold text-hoxton-deep">
                  {draft.hxtNumber}
                </p>
              </div>
              <div>
                <span className="text-xs font-heading font-medium text-emerald-700/70">
                  Client Name
                </span>
                <p className="text-sm font-heading font-semibold text-hoxton-deep">
                  {draft.clientName}
                </p>
              </div>
              <div>
                <span className="text-xs font-heading font-medium text-emerald-700/70">
                  Email
                </span>
                <p className="text-sm font-body text-hoxton-deep">
                  {draft.clientEmail}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Creating on behalf of */}
        {canDelegate && advisors.length > 0 && (
          <div className="space-y-1.5">
            <label
              htmlFor="advisorId"
              className="block text-sm font-heading font-medium text-hoxton-deep"
            >
              Creating on behalf of
            </label>
            <select
              id="advisorId"
              value={draft.advisorId ?? ''}
              onChange={(e) =>
                updateDraft({ advisorId: e.target.value || null })
              }
              className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-3 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
            >
              <option value="">Myself</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name} ({a.email})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
