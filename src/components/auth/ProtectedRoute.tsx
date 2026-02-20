import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Spinner } from '../ui/Spinner'
import type { UserRole } from '../../types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hoxton-light">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If a role is required, wait for profile to load before deciding
  if (requiredRole) {
    if (!profile) {
      // Profile hasn't loaded yet or failed — show inline spinner, not fullscreen
      return (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )
    }
    if (profile.role !== requiredRole) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}
