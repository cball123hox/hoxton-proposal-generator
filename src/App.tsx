import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { NewProposalPage } from './pages/NewProposalPage'
import { MyProposalsPage } from './pages/MyProposalsPage'
import { ProposalDetailPage } from './pages/ProposalDetailPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { AdminTemplatesPage } from './pages/AdminTemplatesPage'
import { AdminAuditLogPage } from './pages/AdminAuditLogPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes with sidebar layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/proposals/new" element={<NewProposalPage />} />
            <Route path="/proposals" element={<MyProposalsPage />} />
            <Route path="/proposals/:id" element={<ProposalDetailPage />} />

            {/* Admin routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="system_admin">
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/templates"
              element={
                <ProtectedRoute requiredRole="system_admin">
                  <AdminTemplatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-log"
              element={
                <ProtectedRoute requiredRole="system_admin">
                  <AdminAuditLogPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
