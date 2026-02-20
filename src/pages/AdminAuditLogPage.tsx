import { useEffect, useState } from 'react'
import { ClipboardList, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  changes: Record<string, unknown>
  performed_by: string | null
  created_at: string
  profiles?: { full_name: string } | null
}

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'slide_added', label: 'Slide Added' },
  { value: 'slide_removed', label: 'Slide Removed' },
  { value: 'slide_reordered', label: 'Slide Reordered' },
  { value: 'slide_replaced', label: 'Slide Replaced' },
  { value: 'module_created', label: 'Module Created' },
  { value: 'module_updated', label: 'Module Updated' },
  { value: 'module_disabled', label: 'Module Disabled' },
]

const ACTION_LABELS: Record<string, string> = {
  slide_added: 'Slide Added',
  slide_removed: 'Slide Removed',
  slide_reordered: 'Slides Reordered',
  slide_replaced: 'Slide Replaced',
  module_created: 'Module Created',
  module_updated: 'Module Updated',
  module_disabled: 'Module Disabled',
}

const ACTION_COLORS: Record<string, string> = {
  slide_added: 'bg-emerald-100 text-emerald-800',
  slide_removed: 'bg-red-100 text-red-800',
  slide_reordered: 'bg-hoxton-mint/40 text-hoxton-deep',
  slide_replaced: 'bg-amber-100 text-amber-800',
  module_created: 'bg-emerald-100 text-emerald-800',
  module_updated: 'bg-hoxton-mint/40 text-hoxton-deep',
  module_disabled: 'bg-red-100 text-red-800',
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

export function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetchLog()
  }, [filter])

  async function fetchLog() {
    setLoading(true)

    let query = supabase
      .from('template_audit_log')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filter) {
      query = query.eq('action', filter)
    }

    const { data } = await query
    if (data) setEntries(data as AuditEntry[])
    setLoading(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-hoxton-deep">
            Audit Log
          </h1>
          <p className="mt-1 text-sm font-body text-hoxton-slate">
            Track all template and module changes
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-hoxton-slate" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border border-hoxton-grey bg-white py-2 pl-3 pr-8 text-sm font-heading font-medium text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4 animate-pulse">
                <div className="h-4 w-28 rounded bg-gray-100" />
                <div className="h-5 w-24 rounded-full bg-gray-100" />
                <div className="h-4 w-32 rounded bg-gray-100" />
                <div className="h-4 w-24 rounded bg-gray-100" />
                <div className="h-4 w-40 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-heading font-medium text-hoxton-deep">
              {filter ? 'No matching entries' : 'No audit log entries yet'}
            </p>
            <p className="mt-1 text-sm font-body text-gray-400">
              {filter
                ? 'Try a different filter or clear the filter'
                : 'Changes to templates and modules will appear here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Date / Time
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Action
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Changed By
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => {
                  const actionLabel = ACTION_LABELS[entry.action] ?? entry.action
                  const actionColor = ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-600'

                  return (
                    <tr key={entry.id} className="transition-colors hover:bg-hoxton-light/30">
                      <td className="px-6 py-4 text-sm font-body text-gray-400 whitespace-nowrap">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-heading font-medium ${actionColor}`}>
                          {actionLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-heading font-medium text-hoxton-deep">
                            {entry.entity_id}
                          </p>
                          <p className="text-xs font-body text-gray-400">
                            {entry.entity_type}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                        {entry.profiles?.full_name ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        {entry.changes && Object.keys(entry.changes).length > 0 ? (
                          <details className="group">
                            <summary className="cursor-pointer text-xs font-heading font-medium text-hoxton-turquoise hover:text-hoxton-turquoise/80">
                              View details
                            </summary>
                            <pre className="mt-2 max-w-xs overflow-auto rounded-lg bg-hoxton-light p-3 text-[11px] font-body leading-relaxed text-hoxton-deep">
                              {JSON.stringify(entry.changes, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-gray-300">&mdash;</span>
                        )}
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
  )
}
