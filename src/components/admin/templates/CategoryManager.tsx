import { useState, useRef, useEffect } from 'react'
import { Plus, Pencil, X, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { logAudit } from '../../../lib/audit'
import type { DbCategory, DbProductModule } from '../../../types'

interface CategoryManagerProps {
  categories: DbCategory[]
  productModules: DbProductModule[]
  userId: string
  onRefresh: () => Promise<void>
}

export function CategoryManager({ categories, productModules, userId, onRefresh }: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [addValue, setAddValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus()
  }, [editingId])

  useEffect(() => {
    if (adding && addRef.current) addRef.current.focus()
  }, [adding])

  function startEdit(cat: DbCategory) {
    setEditingId(cat.id)
    setEditValue(cat.name)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
    setError(null)
  }

  async function saveEdit() {
    if (!editingId || !editValue.trim()) return
    setSaving(true)
    setError(null)

    const oldCat = categories.find((c) => c.id === editingId)
    if (!oldCat) return

    const { error: err } = await supabase
      .from('categories')
      .update({ name: editValue.trim() })
      .eq('id', editingId)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    // Also update the text column on product_modules for backward compatibility
    await supabase
      .from('product_modules')
      .update({ category: editValue.trim() })
      .eq('category_id', editingId)

    await logAudit('category_updated', 'category', editingId, {
      old_name: oldCat.name,
      new_name: editValue.trim(),
    }, userId)

    setSaving(false)
    setEditingId(null)
    setEditValue('')
    await onRefresh()
  }

  async function handleDelete(cat: DbCategory) {
    setError(null)

    // Check if any modules use this category
    const modulesInCategory = productModules.filter((m) => m.category_id === cat.id)
    if (modulesInCategory.length > 0) {
      setError(`Cannot delete "${cat.name}": ${modulesInCategory.length} module${modulesInCategory.length !== 1 ? 's' : ''} assigned`)
      return
    }

    const { error: err } = await supabase
      .from('categories')
      .delete()
      .eq('id', cat.id)

    if (err) {
      setError(err.message)
      return
    }

    await logAudit('category_deleted', 'category', cat.id, {
      name: cat.name,
    }, userId)

    await onRefresh()
  }

  async function handleAdd() {
    if (!addValue.trim()) return
    setSaving(true)
    setError(null)

    const maxOrder = Math.max(...categories.map((c) => c.sort_order), 0)

    const { data, error: err } = await supabase
      .from('categories')
      .insert({ name: addValue.trim(), sort_order: maxOrder + 1 })
      .select('id')
      .single()

    if (err) {
      setError(err.message.includes('duplicate')
        ? 'A category with this name already exists'
        : err.message)
      setSaving(false)
      return
    }

    await logAudit('category_created', 'category', data.id, {
      name: addValue.trim(),
    }, userId)

    setSaving(false)
    setAdding(false)
    setAddValue('')
    await onRefresh()
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') { setAdding(false); setAddValue('') }
  }

  return (
    <div className="mb-6">
      <h4 className="mb-3 text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
        Categories
      </h4>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <div key={cat.id} className="group relative">
            {editingId === cat.id ? (
              <div className="flex items-center gap-1">
                <input
                  ref={editRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={cancelEdit}
                  disabled={saving}
                  className="w-36 rounded-lg border border-hoxton-turquoise bg-white px-3 py-1.5 text-sm font-heading font-medium text-hoxton-deep focus:outline-none focus:ring-2 focus:ring-hoxton-turquoise/20"
                />
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-heading font-medium text-hoxton-deep">
                {cat.name}
                <span className="text-xs text-gray-400">
                  ({productModules.filter((m) => m.category_id === cat.id).length})
                </span>
                <button
                  onClick={() => startEdit(cat)}
                  className="ml-0.5 rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:text-hoxton-turquoise group-hover:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        ))}

        {adding ? (
          <div className="flex items-center gap-1">
            <input
              ref={addRef}
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Category name"
              disabled={saving}
              className="w-36 rounded-lg border border-hoxton-turquoise bg-white px-3 py-1.5 text-sm font-heading font-medium text-hoxton-deep placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hoxton-turquoise/20"
            />
            {saving && <Loader2 className="h-3 w-3 animate-spin text-hoxton-turquoise" />}
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-heading font-medium text-gray-400 transition-colors hover:border-hoxton-turquoise hover:text-hoxton-turquoise"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </button>
        )}
      </div>
    </div>
  )
}
