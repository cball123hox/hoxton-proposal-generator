import { useState } from 'react'
import { X, Loader2, Package } from 'lucide-react'
import { Portal } from '../../ui/Portal'
import { supabase } from '../../../lib/supabase'
import { logAudit } from '../../../lib/audit'
import type { DbCategory, DbRegion, DbProductModule } from '../../../types'

interface NewProductModuleModalProps {
  categories: DbCategory[]
  regions: DbRegion[]
  userId: string
  onClose: () => void
  onCreated: (module: DbProductModule) => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function NewProductModuleModal({
  categories,
  regions,
  userId,
  onClose,
  onCreated,
}: NewProductModuleModalProps) {
  const [name, setName] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [layout, setLayout] = useState<'new' | 'old'>('new')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idManuallyEdited, setIdManuallyEdited] = useState(false)

  function handleNameChange(value: string) {
    setName(value)
    if (!idManuallyEdited) {
      setModuleId(slugify(value))
    }
  }

  function handleIdChange(value: string) {
    setModuleId(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    setIdManuallyEdited(true)
  }

  function toggleRegion(regionId: string) {
    setSelectedRegions((prev) =>
      prev.includes(regionId)
        ? prev.filter((r) => r !== regionId)
        : [...prev, regionId]
    )
  }

  const isValid = name.trim() && moduleId.trim() && categoryId && selectedRegions.length > 0

  async function handleCreate() {
    if (!isValid) return
    setSaving(true)
    setError(null)

    const selectedCategory = categories.find((c) => c.id === categoryId)

    // Get next sort_order
    const { data: existingModules } = await supabase
      .from('product_modules')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = (existingModules?.[0]?.sort_order ?? 0) + 1

    const { data, error: err } = await supabase
      .from('product_modules')
      .insert({
        id: moduleId.trim(),
        name: name.trim(),
        category: selectedCategory?.name ?? '',
        category_id: categoryId,
        regions: selectedRegions,
        slides_count: 0,
        layout,
        sort_order: nextOrder,
      })
      .select('*')
      .single()

    if (err) {
      setError(
        err.message.includes('duplicate')
          ? 'A module with this ID already exists'
          : err.message
      )
      setSaving(false)
      return
    }

    await logAudit('module_created', 'product_module', moduleId.trim(), {
      name: name.trim(),
      category: selectedCategory?.name,
      regions: selectedRegions,
      layout,
    }, userId)

    setSaving(false)
    onCreated(data as DbProductModule)
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
              <Package className="h-5 w-5 text-hoxton-turquoise" />
              <h3 className="font-heading font-semibold text-hoxton-deep">
                New Product Module
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
                Module Name
              </label>
              <input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. UK Pension Transfer"
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-2.5 text-sm font-body text-hoxton-deep placeholder-gray-400 focus:border-hoxton-turquoise focus:outline-none focus:ring-2 focus:ring-hoxton-turquoise/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-heading font-medium text-hoxton-deep">
                Module ID
              </label>
              <input
                value={moduleId}
                onChange={(e) => handleIdChange(e.target.value)}
                placeholder="auto-generated-from-name"
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-2.5 text-sm font-body text-hoxton-deep placeholder-gray-400 focus:border-hoxton-turquoise focus:outline-none focus:ring-2 focus:ring-hoxton-turquoise/20"
              />
              <p className="mt-1 text-xs font-body text-gray-400">
                Used in storage paths. Lowercase, hyphens, no spaces.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-heading font-medium text-hoxton-deep">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light px-4 py-2.5 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-2 focus:ring-hoxton-turquoise/20"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-heading font-medium text-hoxton-deep">
                Regions
              </label>
              <div className="flex flex-wrap gap-2">
                {regions.map((region) => {
                  const selected = selectedRegions.includes(region.id)
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => toggleRegion(region.id)}
                      className={`rounded-lg border-2 px-3 py-1.5 text-sm font-heading font-medium transition-all ${
                        selected
                          ? 'border-hoxton-turquoise bg-hoxton-turquoise/5 text-hoxton-deep'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {region.name}
                    </button>
                  )
                })}
              </div>
              {selectedRegions.length === 0 && (
                <p className="mt-1 text-xs text-red-500">Select at least one region</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-heading font-medium text-hoxton-deep">
                Layout
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLayout('new')}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-heading font-medium transition-all ${
                    layout === 'new'
                      ? 'border-hoxton-turquoise bg-hoxton-turquoise/5 text-hoxton-deep'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  New Layout
                </button>
                <button
                  type="button"
                  onClick={() => setLayout('old')}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-heading font-medium transition-all ${
                    layout === 'old'
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  Legacy Layout
                </button>
              </div>
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
              Create Module
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
