import { useEffect, useState } from 'react'
import {
  Plus,
  X,
  Loader2,
  Users,
  ChevronDown,
  Shield,
  UserCog,
  UserCheck,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge } from '../components/ui/Badge'
import { REGIONS } from '../lib/constants'
import { Portal } from '../components/ui/Portal'
import type { UserRole, Profile } from '../types'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'planner', label: 'Planner' },
  { value: 'planner_admin', label: 'Planner Admin' },
  { value: 'power_planner', label: 'Paraplanner' },
  { value: 'system_admin', label: 'System Admin' },
]

const ROLE_BADGE: Record<UserRole, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  planner: { label: 'Planner', variant: 'default' },
  planner_admin: { label: 'Planner Admin', variant: 'info' },
  power_planner: { label: 'Paraplanner', variant: 'warning' },
  system_admin: { label: 'System Admin', variant: 'error' },
}

function regionLabel(id?: string): string {
  if (!id) return '—'
  return REGIONS.find((r) => r.id === id)?.display ?? id.toUpperCase()
}

export function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // Invite form
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('planner')
  const [inviteRegion, setInviteRegion] = useState('int')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  // Edit modal
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('planner')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  // Escape key to close edit modal
  useEffect(() => {
    if (!editUser) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditUser(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editUser])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setUsers(data as Profile[])
    setLoading(false)
  }

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')

    // Create auth user via signUp with a temporary password.
    // The user will receive a confirmation email from Supabase and can reset their password.
    const tempPassword = crypto.randomUUID()
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: inviteEmail.trim(),
      password: tempPassword,
      options: {
        data: { full_name: inviteName.trim() },
      },
    })

    if (authError) {
      setInviteError(authError.message)
      setInviting(false)
      return
    }

    // Update the auto-created profile with role and region
    if (authData.user) {
      await supabase
        .from('profiles')
        .update({
          role: inviteRole,
          region: inviteRegion,
          full_name: inviteName.trim(),
        })
        .eq('id', authData.user.id)
    }

    setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`)
    setInviteName('')
    setInviteEmail('')
    setInviteRole('planner')
    setInviteRegion('int')
    setInviting(false)
    fetchUsers()
  }

  async function handleEditSave() {
    if (!editUser) return
    setEditSaving(true)
    await supabase
      .from('profiles')
      .update({ role: editRole })
      .eq('id', editUser.id)
    setUsers((prev) =>
      prev.map((u) => (u.id === editUser.id ? { ...u, role: editRole } : u))
    )
    setEditUser(null)
    setEditSaving(false)
  }

  async function toggleActive(profile: Profile) {
    const newActive = !profile.is_active
    await supabase
      .from('profiles')
      .update({ is_active: newActive })
      .eq('id', profile.id)
    setUsers((prev) =>
      prev.map((u) => (u.id === profile.id ? { ...u, is_active: newActive } : u))
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-hoxton-deep">
            Manage Users
            {!loading && (
              <span className="ml-2 text-lg font-normal text-hoxton-slate">
                ({users.length})
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm font-body text-hoxton-slate">
            Invite and manage user accounts
          </p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90"
        >
          {showInvite ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          Invite User
        </button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6">
          <h3 className="mb-4 text-sm font-heading font-semibold uppercase tracking-wider text-gray-400">
            New Invitation
          </h3>

          {inviteError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-body text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {inviteError}
            </div>
          )}

          {inviteSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-body text-emerald-700">
              <UserCheck className="h-4 w-4 shrink-0" />
              {inviteSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                Full Name
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="John Smith"
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light py-2.5 px-4 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/50 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                Email
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="john@hoxtonwealth.com"
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light py-2.5 px-4 text-sm font-body text-hoxton-deep placeholder:text-hoxton-slate/50 focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light py-2.5 px-4 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                Region
              </label>
              <select
                value={inviteRegion}
                onChange={(e) => setInviteRegion(e.target.value)}
                className="w-full rounded-xl border border-hoxton-grey bg-hoxton-light py-2.5 px-4 text-sm font-body text-hoxton-deep focus:border-hoxton-turquoise focus:outline-none focus:ring-1 focus:ring-hoxton-turquoise"
              >
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.display}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-50"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              {inviting ? 'Sending...' : 'Send Invitation'}
            </button>
            <button
              onClick={() => {
                setShowInvite(false)
                setInviteError('')
                setInviteSuccess('')
              }}
              className="rounded-lg px-4 py-2.5 text-sm font-heading font-medium text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User Table */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-gray-100" />
                <div className="h-4 w-32 rounded bg-gray-100" />
                <div className="h-4 w-40 rounded bg-gray-100" />
                <div className="h-5 w-20 rounded-full bg-gray-100" />
                <div className="h-4 w-24 rounded bg-gray-100" />
                <div className="h-4 w-16 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-heading font-medium text-hoxton-deep">No users yet</p>
            <p className="mt-1 text-sm font-body text-gray-400">
              Invite your first team member to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Name
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Email
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Role
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Region
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const roleBadge = ROLE_BADGE[u.role]
                  const isCurrentUser = u.id === user?.id
                  const active = u.is_active !== false

                  return (
                    <tr key={u.id} className={`transition-colors ${active ? '' : 'opacity-50'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hoxton-turquoise/10 text-sm font-heading font-semibold text-hoxton-turquoise">
                            {u.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm font-heading font-medium text-hoxton-deep">
                            {u.full_name}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-xs font-normal text-hoxton-slate">(you)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-body text-hoxton-slate">
                        {regionLabel(u.region)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          <span className="text-xs font-heading font-medium text-hoxton-slate">
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditUser(u)
                              setEditRole(u.role)
                            }}
                            disabled={isCurrentUser}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-heading font-medium text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <UserCog className="h-3 w-3" />
                            Edit Role
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={isCurrentUser}
                            className={`rounded-md px-2 py-1 text-xs font-heading font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                              active
                                ? 'text-red-500 hover:bg-red-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {active ? 'Deactivate' : 'Activate'}
                          </button>
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

      {/* Edit Role Modal */}
      {editUser && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setEditUser(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="font-heading font-semibold text-hoxton-deep">
                  Edit Role
                </h3>
                <p className="text-sm font-body text-gray-400">
                  {editUser.full_name}
                </p>
              </div>
              <button
                onClick={() => setEditUser(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-hoxton-deep"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="mb-2 block text-xs font-heading font-semibold uppercase tracking-wider text-hoxton-slate">
                Role
              </label>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setEditRole(r.value)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      editRole === r.value
                        ? 'border-hoxton-turquoise bg-hoxton-turquoise/5'
                        : 'border-gray-100 hover:border-hoxton-slate/30'
                    }`}
                  >
                    <Shield className={`h-4 w-4 ${editRole === r.value ? 'text-hoxton-turquoise' : 'text-gray-400'}`} />
                    <span className="text-sm font-heading font-medium text-hoxton-deep">
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setEditUser(null)}
                className="rounded-lg px-4 py-2.5 text-sm font-heading font-medium text-hoxton-slate hover:bg-hoxton-light hover:text-hoxton-deep"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving || editRole === editUser.role}
                className="inline-flex items-center gap-2 rounded-lg bg-hoxton-turquoise px-4 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-hoxton-turquoise/90 disabled:opacity-50"
              >
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
