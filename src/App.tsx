import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LayoutDemo } from '@/pages/LayoutDemo'
import Dashboard from '@/app/dashboard/page'
import ProjectsPage from '@/app/projects/page'
import CreateProjectPage from '@/app/projects/new/page'
import ProjectDetailPage from '@/app/projects/[id]/page'
import ModelDetailPage from '@/app/models/[id]/page'
import ProfilePage from '@/app/profile/page'
import NotificationsPage from '@/app/notifications/page'
import AdminPage from '@/app/admin/page'
import ViewerPage from '@/app/projects/[id]/viewer-engine/ViewerPage'
import './App.css'



// Import UI components for testing
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Import ProfessionalGaming components
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingStat } from '@/components/gaming/ProfessionalGamingStat'

function Home() {
  return (
    <div className="min-h-screen bg-[#0F1419] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Standard UI */}
        {/* Navigation to Layout Demo */}
        <div className="text-center p-8 bg-[rgba(26,31,46,0.95)] border border-[rgba(58,123,213,0.2)] rounded-lg">
          <h2 className="text-2xl font-bold text-[#E8EAF0] mb-4">🎉 UI Components Working!</h2>
          <p className="text-[#B8BCC8] mb-6">
            Standard UI components are working perfectly. Ready to test the full layout system?
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => window.location.href = '/layout-demo'}>
              View Full Layout Demo
            </Button>
            <Button onClick={() => window.location.href = '/dashboard'}>
              View Dashboard
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/projects'}>
              View Projects
            </Button>
          </div>
        </div>

        {/* Standard UI Components Testing */}
        <Card className="bg-[rgba(26,31,46,0.95)] border-[rgba(58,123,213,0.2)]">
          <CardHeader>
            <CardTitle className="text-[#E8EAF0]">Standard UI Components</CardTitle>
            <CardDescription className="text-[#B8BCC8]">
              Testing Radix UI components with our theme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Buttons */}
            <div className="space-y-4">
              <h3 className="text-[#E8EAF0] font-semibold">Buttons:</h3>
              <div className="flex gap-4 flex-wrap">
                <Button>Default Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="outline">Outline Button</Button>
              </div>
            </div>

            {/* Badges */}
            <div className="space-y-4">
              <h3 className="text-[#E8EAF0] font-semibold">Badges:</h3>
              <div className="flex gap-4 flex-wrap">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Error</Badge>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-4">
              <h3 className="text-[#E8EAF0] font-semibold">Progress Bar:</h3>
              <Progress value={65} className="w-full" />
            </div>

            {/* Tabs */}
            <div className="space-y-4">
              <h3 className="text-[#E8EAF0] font-semibold">Tabs:</h3>
              <Tabs value="overview" onValueChange={() => {}} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="text-[#B8BCC8]">
                  Project overview content
                </TabsContent>
                <TabsContent value="details" className="text-[#B8BCC8]">
                  Project details content
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Professional Gaming Components */}
        <ProfessionalGamingCard variant="panel">
          <CardHeader>
            <CardTitle className="text-[#E8EAF0]">Professional Gaming Components</CardTitle>
            <CardDescription className="text-[#B8BCC8]">
              Testing custom gaming-themed components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ProfessionalGamingStat
                label="Active Projects"
                value="12"
                trend="up"
                icon="📊"
              />
              <ProfessionalGamingStat
                label="Total Models"
                value="48"
                trend="down"
                icon="🏗️"
              />
              <ProfessionalGamingStat
                label="System Health"
                value="98%"
                trend="up"
                icon="⚡"
              />
              <ProfessionalGamingStat
                label="Online Users"
                value="24"
                trend="up"
                icon="👥"
              />
            </div>
          </CardContent>
        </ProfessionalGamingCard>
      </div>
    </div>
  )
}



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/projects" element={<AppLayout><ProjectsPage /></AppLayout>} />
        <Route path="/projects/new" element={<AppLayout><CreateProjectPage /></AppLayout>} />
        <Route path="/projects/:id" element={<AppLayout><ProjectDetailPage /></AppLayout>} />
        <Route 
          path="/projects/:id/viewer-engine" 
          element={<ViewerPage />} 
        />
        <Route path="/models/:id" element={<AppLayout><ModelDetailPage /></AppLayout>} />
        <Route path="/profile" element={<AppLayout><ProfilePage /></AppLayout>} />
        <Route path="/notifications" element={<AppLayout><NotificationsPage /></AppLayout>} />
        <Route path="/admin" element={<AppLayout><AdminPage /></AppLayout>} />
        <Route path="/layout-demo" element={<LayoutDemo />} />
      </Routes>
    </Router>
  )
}

export default App
