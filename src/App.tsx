import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import LoginPage from '@/app/auth/login/page'
import SignupPage from '@/app/auth/signup/page'
import Dashboard from '@/app/dashboard/page'
import ProjectsPage from '@/app/projects/page'
// import CreateProjectPage from '@/app/projects/new/page'
import ProjectDetailPage from '@/app/projects/[id]/page'
import ModelDetailPage from '@/app/models/[id]/page'
import ProfilePage from '@/app/profile/page'
import NotificationsPage from '@/app/notifications/page'
import AdminPage from '@/app/admin/page'
import ViewerPage from '@/app/projects/[id]/viewer-engine/ViewerPage'
import ElementReportPage from '@/app/projects/[id]/element-report/[elementId]/page'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><AppLayout><ProjectsPage /></AppLayout></ProtectedRoute>} />
          {/* <Route path="/projects/new" element={<ProtectedRoute><AppLayout><CreateProjectPage /></AppLayout></ProtectedRoute>} /> */}
          <Route path="/projects/:id" element={<ProtectedRoute><AppLayout><ProjectDetailPage /></AppLayout></ProtectedRoute>} />
          <Route 
            path="/projects/:id/viewer-engine" 
            element={<ProtectedRoute><ViewerPage /></ProtectedRoute>} 
          />
          <Route 
            path="/projects/:id/element-report/:elementId" 
            element={<ElementReportPage />} 
          />
          <Route path="/models/:id" element={<ProtectedRoute><AppLayout><ModelDetailPage /></AppLayout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><AppLayout><NotificationsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AppLayout><AdminPage /></AppLayout></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App    
