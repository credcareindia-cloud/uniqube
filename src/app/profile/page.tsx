import { useState, useEffect } from 'react'
import { 
  Camera, 
  Save, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Calendar, 
  User, 
  Settings, 
  Activity, 
  Users, 
  Package, 
  TrendingUp,
  Loader
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { useAuth } from '@/contexts/AuthContext'
import { getApiUrl } from '@/config/api'

export default function ProfilePage() {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({
    activeProjects: 0,
    totalGroups: 0,
    totalPanels: 0,
    completionRate: 0
  })
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    location: '',
    company: '',
    role: '',
    joinDate: ''
  })

  useEffect(() => {
    loadUserProfile()
    loadUserStats()
  }, [user])

  const loadUserProfile = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch(getApiUrl('user/profile'))
      
      if (response.ok) {
        const data = await response.json()
        console.log('Profile data received:', data)
        setFormData({
          name: data.name || user?.name || '',
          email: data.email || user?.email || '',
          phone: data.phone || '',
          location: data.location || '',
          company: data.company || '',
          role: data.userRole || data.role || '',
          joinDate: data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''
        })
      }
    } catch (error) {
      console.error('Failed to load user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserStats = async () => {
    try {
      // Fetch user's projects - corrected endpoint under /api/projects
      const projectsResponse = await authenticatedFetch(getApiUrl('projects'))
      if (projectsResponse.ok) {
        const projects = await projectsResponse.json()
        
        // Calculate stats from projects
        let totalGroups = 0
        let totalPanels = 0
        let completedPanels = 0
        
        for (const project of projects) {
          // Fetch groups for each project
          try {
            const groupsResponse = await authenticatedFetch(getApiUrl(`groups/${project.id}`))
            if (groupsResponse.ok) {
              const groups = await groupsResponse.json()
              totalGroups += groups.length
            }
          } catch (error) {
            console.error(`Failed to fetch groups for project ${project.id}:`, error)
          }
          
          // Fetch panels statistics
          try {
            const panelsResponse = await authenticatedFetch(getApiUrl(`panels/${project.id}/statistics`))
            if (panelsResponse.ok) {
              const panelStats = await panelsResponse.json()
              totalPanels += panelStats.total || 0
              completedPanels += panelStats.completed || 0
            }
          } catch (error) {
            console.error(`Failed to fetch panel stats for project ${project.id}:`, error)
          }
        }
        
        const completionRate = totalPanels > 0 ? Math.round((completedPanels / totalPanels) * 100) : 0
        
        setStats({
          activeProjects: projects.length,
          totalGroups,
          totalPanels,
          completionRate
        })
      }
    } catch (error) {
      console.error('Failed to load user stats:', error)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await authenticatedFetch(getApiUrl('user/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          location: formData.location,
          company: formData.company
        })
      })
      
      if (response.ok) {
        setIsEditing(false)
        console.log('✅ Profile updated successfully')
      } else {
        console.error('Failed to update profile')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="w-full h-full space-y-3 sm:space-y-4">
      {/* Header */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700">
              <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">User Profile</h1>
              <p className="text-slate-600 text-xs">Manage your account settings and preferences</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              {/* <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button> */}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Profile Card */}
        <Card className="lg:col-span-1 border-slate-200">
          <CardContent className="p-4">
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-fit">
                <div className="relative">
                  <Avatar className="h-24 w-24 mx-auto border-2 border-slate-200 shadow-lg">
                    <AvatarImage src="/avatars/demo-user.png" />
                    <AvatarFallback className="bg-slate-700 text-white text-2xl font-bold">
                      {formData.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full p-0"
                  >
                    <Camera className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-900">{formData.name}</h2>
                <p className="text-slate-600 text-xs">{formData.role}</p>
                <Badge variant="success" className="text-xs">
                  Active User
                </Badge>
              </div>

              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <Mail className="h-4 w-4 text-slate-600 flex-shrink-0" />
                  <span className="text-slate-700 text-xs truncate">{formData.email}</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <Phone className="h-4 w-4 text-slate-600 flex-shrink-0" />
                  <span className="text-slate-700 text-xs">{formData.phone}</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <MapPin className="h-4 w-4 text-slate-600 flex-shrink-0" />
                  <span className="text-slate-700 text-xs">{formData.location}</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <Building className="h-4 w-4 text-slate-600 flex-shrink-0" />
                  <span className="text-slate-700 text-xs">{formData.company}</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <Calendar className="h-4 w-4 text-slate-600 flex-shrink-0" />
                  <span className="text-slate-700 text-xs">Joined {formData.joinDate}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Form */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Personal Information</h3>
                  <p className="text-slate-600 text-xs">Update your personal details and contact information</p>
                </div>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto" disabled={loading}>
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1 sm:flex-none" disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} className="flex-1 sm:flex-none" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700 font-medium text-sm">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium text-sm">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={true}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-700 font-medium text-sm">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-slate-700 font-medium text-sm">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-slate-700 font-medium text-sm">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-slate-700 font-medium text-sm">Role</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    disabled={true}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Stats */}
      {/* <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Activity Overview</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Activity className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{stats.activeProjects}</div>
                  <div className="text-sm text-slate-600">Active Projects</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Users className="h-5 w-5 text-green-700" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{stats.totalGroups}</div>
                  <div className="text-sm text-slate-600">Groups Managed</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Package className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{stats.totalPanels}</div>
                  <div className="text-sm text-slate-600">Panels Tracked</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-700" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{stats.completionRate}%</div>
                  <div className="text-sm text-slate-600">Completion Rate</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card> */}
    </div>
  )
}
