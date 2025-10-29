import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingStat } from '@/components/gaming/ProfessionalGamingStat'

export function LayoutDemo() {
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[#E8EAF0] mb-2">Layout Components Demo</h1>
          <p className="text-[#B8BCC8]">Showcasing the migrated layout system with Navbar, Sidebar, and AppLayout</p>
        </div>

        {/* Layout Features */}
        <ProfessionalGamingCard variant="panel">
          <CardHeader>
            <CardTitle className="text-[#E8EAF0]">Layout Features</CardTitle>
            <CardDescription className="text-[#B8BCC8]">
              Professional gaming-themed layout with responsive design
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.1)] rounded-lg p-4">
                <h3 className="text-[#E8EAF0] font-semibold mb-2">🧭 Navigation Bar</h3>
                <p className="text-[#B8BCC8] text-sm">Professional navbar with search, notifications, and user profile</p>
              </div>
              <div className="bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.1)] rounded-lg p-4">
                <h3 className="text-[#E8EAF0] font-semibold mb-2">📋 Sidebar Menu</h3>
                <p className="text-[#B8BCC8] text-sm">Responsive sidebar with active states and professional styling</p>
              </div>
              <div className="bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.1)] rounded-lg p-4">
                <h3 className="text-[#E8EAF0] font-semibold mb-2">📱 Responsive Design</h3>
                <p className="text-[#B8BCC8] text-sm">Mobile-friendly layout with collapsible sidebar</p>
              </div>
            </div>
          </CardContent>
        </ProfessionalGamingCard>

        {/* Standard UI Components */}
        <Card className="bg-[rgba(26,31,46,0.95)] border-[rgba(58,123,213,0.2)]">
          <CardHeader>
            <CardTitle className="text-[#E8EAF0]">Standard UI Components</CardTitle>
            <CardDescription className="text-[#B8BCC8]">
              All components working within the layout system
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
              <Progress value={75} className="w-full" />
            </div>

            {/* Tabs */}
            <div className="space-y-4">
              <h3 className="text-[#E8EAF0] font-semibold">Tabs:</h3>
              <Tabs value="layout" onValueChange={() => {}} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="layout">Layout</TabsTrigger>
                  <TabsTrigger value="components">Components</TabsTrigger>
                  <TabsTrigger value="features">Features</TabsTrigger>
                </TabsList>
                <TabsContent value="layout" className="text-[#B8BCC8]">
                  Layout system with AppLayout, Navbar, and Sidebar components
                </TabsContent>
                <TabsContent value="components" className="text-[#B8BCC8]">
                  All UI components working perfectly within the layout
                </TabsContent>
                <TabsContent value="features" className="text-[#B8BCC8]">
                  Professional gaming theme with responsive design
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Professional Gaming Stats */}
        <ProfessionalGamingCard variant="panel">
          <CardHeader>
            <CardTitle className="text-[#E8EAF0]">System Dashboard</CardTitle>
            <CardDescription className="text-[#B8BCC8]">
              Professional gaming components within the layout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ProfessionalGamingStat
                label="Layout Components"
                value="3"
                trend="up"
                icon="🏗️"
              />
              <ProfessionalGamingStat
                label="UI Components"
                value="12"
                trend="up"
                icon="🎨"
              />
              <ProfessionalGamingStat
                label="Migration Progress"
                value="85%"
                trend="up"
                icon="⚡"
              />
              <ProfessionalGamingStat
                label="System Status"
                value="Online"
                trend="up"
                icon="✅"
              />
            </div>
          </CardContent>
        </ProfessionalGamingCard>

        {/* Migration Success */}
        <div className="text-center p-8 bg-[rgba(26,31,46,0.95)] border border-[rgba(58,123,213,0.2)] rounded-lg">
          <h2 className="text-2xl font-bold text-[#E8EAF0] mb-4">🎉 Layout Migration Complete!</h2>
          <p className="text-[#B8BCC8] mb-6">
            Successfully migrated AppLayout, Navbar, and Sidebar components from Next.js to Vite React
          </p>
          <div className="flex justify-center gap-4">
            <Button>Explore Dashboard</Button>
            <Button variant="outline">View Projects</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
