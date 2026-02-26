import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './components/ui/Toast'
import { OfflineBanner } from './components/ui/OfflineBanner'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const NewProposalPage = lazy(() => import('./pages/NewProposalPage').then((m) => ({ default: m.NewProposalPage })))
const MyProposalsPage = lazy(() => import('./pages/MyProposalsPage').then((m) => ({ default: m.MyProposalsPage })))
const ProposalDetailPage = lazy(() => import('./pages/ProposalDetailPage').then((m) => ({ default: m.ProposalDetailPage })))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })))
const AdminTemplatesPage = lazy(() => import('./pages/AdminTemplatesPage').then((m) => ({ default: m.AdminTemplatesPage })))
const ClientProposalsPage = lazy(() => import('./pages/ClientProposalsPage').then((m) => ({ default: m.ClientProposalsPage })))
const AdminAuditLogPage = lazy(() => import('./pages/AdminAuditLogPage').then((m) => ({ default: m.AdminAuditLogPage })))
const ProposalViewerPage = lazy(() => import('./pages/ProposalViewerPage').then((m) => ({ default: m.ProposalViewerPage })))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <OfflineBanner />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/view/:token" element={<ProposalViewerPage />} />

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
              <Route path="/clients/:clientName" element={<ClientProposalsPage />} />

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
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
