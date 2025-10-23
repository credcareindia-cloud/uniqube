'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Building2, Box, Users, Zap, Eye, Upload, BarChart3 } from "lucide-react"

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  const handleGetStarted = () => {
    router.push('/auth')
  }

  const handleLearnMore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Box className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900">
              UniQube 3D
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Professional 3D IFC project management platform for construction and manufacturing. 
            Visualize, manage, and track your building projects with powerful 3D modeling capabilities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-3" onClick={handleGetStarted}>
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-3" onClick={handleLearnMore}>
              Learn More
            </Button>
          </div>
        </div>

        <div id="features" className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center mb-2">
                <Eye className="h-8 w-8 text-primary mr-3" />
                <CardTitle>3D IFC Viewer</CardTitle>
              </div>
              <CardDescription>
                Load and visualize large IFC files (1GB-5GB+) with our optimized 3D viewer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Progressive loading, web-based rendering, and interactive navigation for complex building models. 
                Support for industry-standard IFC formats with real-time performance.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center mb-2">
                <Building2 className="h-8 w-8 text-primary mr-3" />
                <CardTitle>Project Management</CardTitle>
              </div>
              <CardDescription>
                Organize and track construction projects with group and panel management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Comprehensive project dashboard with status tracking, progress monitoring, and team collaboration tools. 
                Perfect for construction and manufacturing workflows.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center mb-2">
                <BarChart3 className="h-8 w-8 text-primary mr-3" />
                <CardTitle>Status Tracking</CardTitle>
              </div>
              <CardDescription>
                Real-time status updates for panels, groups, and project milestones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Track progress from planning to completion with visual status indicators. 
                Monitor fabrication, shipping, and installation phases with detailed analytics.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Why Choose UniQube 3D?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex items-start">
              <Upload className="h-6 w-6 text-primary mr-4 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Handle Large Files</h3>
                <p className="text-gray-600">
                  Optimized for large IFC files up to 5GB+ with progressive loading and efficient memory management.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Users className="h-6 w-6 text-primary mr-4 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Team Collaboration</h3>
                <p className="text-gray-600">
                  Share projects with team members, track changes, and collaborate in real-time on complex builds.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Zap className="h-6 w-6 text-primary mr-4 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Fast Performance</h3>
                <p className="text-gray-600">
                  Web-based platform with desktop-class performance. No software installation required.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Building2 className="h-6 w-6 text-primary mr-4 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Industry Standard</h3>
                <p className="text-gray-600">
                  Built for construction and manufacturing professionals with industry-specific workflows.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Projects?
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Join construction and manufacturing teams already using UniQube 3D to streamline their project management.
          </p>
          <Button size="lg" className="text-lg px-8 py-3" onClick={handleGetStarted}>
            Start Your Free Trial
          </Button>
        </div>
      </div>
    </main>
  )
}
