import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function LayoutDemo() {
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Layout Components Demo</h1>
          <p className="text-slate-600">Showcasing the White & Slate theme with Navbar, Sidebar, and AppLayout</p>
        </div>

        {/* Layout Features */}
        <Card>
          <CardHeader>
            <CardTitle>Layout Features</CardTitle>
            <CardDescription>
              Clean, professional layout with responsive design
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="text-slate-900 font-semibold mb-2">Navigation Bar</h3>
                <p className="text-slate-600 text-sm">Clean navbar with search, notifications, and user profile</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="text-slate-900 font-semibold mb-2">Sidebar Menu</h3>
                <p className="text-slate-600 text-sm">Responsive sidebar with active states and clean styling</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="text-slate-900 font-semibold mb-2">Responsive Design</h3>
                <p className="text-slate-600 text-sm">Mobile-friendly layout with collapsible sidebar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Standard UI Components */}
        <Card>
          <CardHeader>
            <CardTitle>UI Components</CardTitle>
            <CardDescription>
              All components working within the layout system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Buttons */}
            <div className="space-y-4">
              <h3 className="text-neutral-900 font-semibold">Buttons:</h3>
              <div className="flex gap-4 flex-wrap">
                <Button>Default Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="ghost">Ghost Button</Button>
              </div>
            </div>

            {/* Badges */}
            <div className="space-y-4">
              <h3 className="text-slate-900 font-semibold">Badges:</h3>
              <div className="flex gap-4 flex-wrap">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="destructive">Error</Badge>
                <Badge variant="info">Info</Badge>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-4">
              <h3 className="text-slate-900 font-semibold">Progress Bar:</h3>
              <Progress value={75} className="w-full" />
            </div>

            {/* Tabs */}
            <div className="space-y-4">
              <h3 className="text-slate-900 font-semibold">Tabs:</h3>
              <Tabs value="layout" onValueChange={() => {}} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="layout">Layout</TabsTrigger>
                  <TabsTrigger value="components">Components</TabsTrigger>
                  <TabsTrigger value="features">Features</TabsTrigger>
                </TabsList>
                <TabsContent value="layout" className="text-slate-600">
                  Layout system with AppLayout, Navbar, and Sidebar components
                </TabsContent>
                <TabsContent value="components" className="text-slate-600">
                  All UI components working perfectly within the layout
                </TabsContent>
                <TabsContent value="features" className="text-slate-600">
                  Clean, professional White & Slate theme with responsive design
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-900">3</div>
                <div className="text-sm text-slate-600 mt-1">Layout Components</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-900">12</div>
                <div className="text-sm text-slate-600 mt-1">UI Components</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">100%</div>
                <div className="text-sm text-slate-600 mt-1">Theme Complete</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">✓</div>
                <div className="text-sm text-slate-600 mt-1">System Ready</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Success Message */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">White & Slate Theme Complete!</h2>
              <p className="text-slate-600 mb-6">
                Successfully implemented clean, professional design with AppLayout, Navbar, and Sidebar
              </p>
              <div className="flex justify-center gap-4">
                <Button>Explore Dashboard</Button>
                <Button variant="outline">View Projects</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
