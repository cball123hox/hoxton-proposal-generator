import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Users,
  Layers,
  ClipboardList,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/proposals/new', label: 'New Proposal', icon: FilePlus },
  { to: '/proposals', label: 'My Proposals', icon: FileText },
]

const ROLE_LABELS: Record<string, string> = {
  planner: 'Planner',
  planner_admin: 'Planner Admin',
  power_planner: 'Paraplanner',
  system_admin: 'System Admin',
}

const adminItems = [
  { to: '/admin/users', label: 'Manage Users', icon: Users },
  { to: '/admin/templates', label: 'Template Library', icon: Layers },
  { to: '/admin/audit-log', label: 'Audit Log', icon: ClipboardList },
]

export function Sidebar() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const isAdmin = profile?.role === 'system_admin'

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-hoxton-deep text-white">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-heading font-semibold tracking-tight">
          Hoxton<span className="font-normal text-hoxton-mint">Wealth</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-heading font-medium transition-colors ${
                isActive
                  ? 'bg-hoxton-turquoise/20 text-hoxton-mint'
                  : 'text-hoxton-grey hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div className="my-4 border-t border-white/10" />
            {adminItems.map((item) => {
              const isActive = pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-heading font-medium transition-colors ${
                    isActive
                      ? 'bg-hoxton-turquoise/20 text-hoxton-mint'
                      : 'text-hoxton-grey hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-hoxton-turquoise/20 text-sm font-heading font-semibold text-hoxton-mint">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-heading font-medium text-white">
              {profile?.full_name ?? 'User'}
            </p>
            <p className="truncate text-xs text-hoxton-slate">
              {(profile?.role && ROLE_LABELS[profile.role]) ?? 'Planner'}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-heading text-hoxton-grey transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
