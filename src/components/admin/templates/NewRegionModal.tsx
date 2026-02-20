import { useState } from 'react'
import { X, Loader2, Globe } from 'lucide-react'
import { Portal } from '../../ui/Portal'
import { supabase } from '../../../lib/supabase'
import { logAudit } from '../../../lib/audit'

interface NewRegionModalProps {
  userId: string
  onClose: () => void
  onCreated: () => Promise<void>
}

export function NewRegionModal({ userId, onClose, onCreated }: NewRegionModalProps) {
  const [regionId, setRegionId] = useState('')
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = regionId.trim() && name.trim() && displayName.trim()

  function handleIdChange(value: string) {
    // Slug format: lowercase, alphanumeric + hyphens
    setRegionId(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  async function handleCreate() {
    if (!isValid) return
    setSaving(true)
    setError(null)

    // Get max sort_order for new region
    const { data: existingRegions } = await supabase
      .from('regions')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = (existingRegions?.[0]?.sort_order ?? 0) + 1

    // Create region
    const { error: regionErr } = await supabase.from('regions').insert({
      id: regionId.trim(),
      name: name.trim(),
      display_name: displayName.trim(),
      intro_slides_count: 0,
      sort_order: nextOrder,
    })

    if (regionErr) {
      setError(regionErr.message.includes('duplicate')
        ? 'A region with this ID already exists'
        : regionErr.message)
      setSaving(false)
      return
    }

    // Create empty intro pack for the region
    await supabase.from('intro_packs').insert({
      region_id: regionId.trim(),
      name: `${displayName.trim()} Intro Pack`,
    })

    await logAudit('region_created', 'region', regionId.trim(), {
      name: name.trim(),
      display_name: displayName.trim(),
    }, userId)

    setSaving(false)
    await onCreated()
    onClose()
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
              <Globe className="h-5 w-5 text-hoxton-turquoise" />
              <h3 className="font-heading font-semibold text-hoxton-deep">
                New Region
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
          <div className="space-y-4 p-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-heading font-medium text-hoxton-deep">
                Region ID
              </label>
              <input
                value={regionId}
                onChange={(e) => handleIdChange(e.target.value)}
                placeholder="e.g. eu, mena, latam"
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-2.5 text-sm font-body text-hoxton-deep placeholder-gray-400 focus:border-hoxton-turquoise focus:outline-none focus:ring-2 focus:ring-hoxton-turquoise/20"
              />
              <p className="mt-1 text-xs font-body text-gray-400">
                Short code used in URLs and storage paths. Lowercase letters, numbers, hyphens only.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-heading font-medium text-hoxton-deep">
                Region Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Europe, MENA"
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-2.5 text-sm font-body text-hoxton-deep placeholder-gray-400 focus:border-hoxton-turquoise focus:outline-none focus:ring-2 focus:ring-hoxton-turquoise/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-heading font-medium text-hoxton-deep">
                Display Name
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. European Union, Middle East & North Africa"
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-2.5 text-sm font-body text-hoxton-deep placeholder-gray-400 focus:border-hoxton-turquoise focus:outline-none focus:ring-2 focus:ring-hoxton-turquoise/20"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-heading font-medium text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!isValid || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Region
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
