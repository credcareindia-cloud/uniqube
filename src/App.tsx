import type { ReactNode } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { RBACProvider } from '@/contexts/RBACContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { AppLayout } from '@/components/layout/AppLayout'
import { OpsPlaceholderPage } from '@/components/layout/OpsPlaceholderPage'
import LoginPage from '@/app/auth/login/page'
import SignupPage from '@/app/auth/signup/page'
import ProjectsPage from '@/app/projects/page'
import ProjectEstimatePage from '@/app/projects/[id]/estimate/page'
import ProjectDetailPage from '@/app/projects/[id]/page'
import ModelDetailPage from '@/app/models/[id]/page'
import ProfilePage from '@/app/profile/page'
import NotificationsPage from '@/app/notifications/page'
import AdminPage from '@/app/admin/page'
import ViewerPage from '@/app/projects/[id]/viewer-engine/ViewerPage'
import ElementReportPage from '@/app/projects/[id]/element-report/page'
import NotFoundPage from '@/app/not-found/page'
import LandingPage from '@/app/site/LandingPage'
import QuotePage from '@/app/site/QuotePage'
import RequestsPage from '@/app/requests/page'
import './App.css'

function withLayout(page: ReactNode) {
  return (
    <ProtectedRoute>
      <AppLayout>{page}</AppLayout>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <AuthProvider>
      <RBACProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            <Route path="/" element={<LandingPage />} />
            <Route path="/quote" element={<QuotePage />} />
            <Route path="/dashboard" element={<Navigate to="/projects" replace />} />
            <Route path="/requests" element={withLayout(<PermissionGate permission="estimate.view"><RequestsPage /></PermissionGate>)} />
            <Route path="/projects" element={withLayout(<PermissionGate permission="projects.view"><ProjectsPage /></PermissionGate>)} />
            <Route path="/projects/:id" element={withLayout(<PermissionGate permission="projects.view"><ProjectDetailPage /></PermissionGate>)} />
            <Route
              path="/projects/:id/estimate/*"
              element={
                <ProtectedRoute>
                  <PermissionGate permission="estimate.view">
                    <ProjectEstimatePage />
                  </PermissionGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/viewer-engine"
              element={withLayout(<PermissionGate permission="viewer"><ViewerPage /></PermissionGate>)}
            />
            <Route path="/projects/:id/element-report" element={<ElementReportPage />} />
            <Route
              path="/projects/:id/manufacturing"
              element={withLayout(
                <OpsPlaceholderPage
                  title="Manufacturing"
                  description="Track factory production status, pod batches, and QA gates for this project."
                />
              )}
            />
            <Route
              path="/projects/:id/shipments"
              element={withLayout(
                <OpsPlaceholderPage
                  title="Shipments"
                  description="Vessel, container, and ETA tracking for outbound pods on this project."
                />
              )}
            />
            <Route
              path="/projects/:id/site-progress"
              element={withLayout(
                <OpsPlaceholderPage
                  title="Site Progress"
                  description="Installation rates, received-vs-installed panels, and forecast completion for this site."
                />
              )}
            />
            <Route
              path="/projects/:id/documents"
              element={withLayout(
                <OpsPlaceholderPage
                  title="Documents"
                  description="Drawings, logistics packs, and site reports for this project."
                />
              )}
            />
            <Route
              path="/projects/:id/quality"
              element={withLayout(
                <OpsPlaceholderPage
                  title="Quality Control"
                  description="QC checklists and non-conformance tracking for this project."
                />
              )}
            />
            <Route
              path="/projects/:id/reports"
              element={withLayout(
                <OpsPlaceholderPage
                  title="Reports"
                  description="Progress, logistics, and installation forecast reports for this project."
                />
              )}
            />
            <Route path="/models/:id" element={withLayout(<ModelDetailPage />)} />
            <Route path="/profile" element={withLayout(<ProfilePage />)} />
            <Route path="/notifications" element={withLayout(<PermissionGate permission="alerts"><NotificationsPage /></PermissionGate>)} />
            <Route path="/admin" element={withLayout(<PermissionGate permission="admin"><AdminPage /></PermissionGate>)} />

            {/* Legacy global ops URLs → projects list */}
            <Route path="/manufacturing" element={<Navigate to="/projects" replace />} />
            <Route path="/shipments" element={<Navigate to="/projects" replace />} />
            <Route path="/site-progress" element={<Navigate to="/projects" replace />} />
            <Route path="/digital-twin" element={<Navigate to="/projects" replace />} />
            <Route path="/documents" element={<Navigate to="/projects" replace />} />
            <Route path="/quality" element={<Navigate to="/projects" replace />} />
            <Route path="/reports" element={<Navigate to="/projects" replace />} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </RBACProvider>
    </AuthProvider>
  )
}

export default App
