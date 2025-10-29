import { useState } from 'react'
import { 
  Shield, 
  Users, 
  Settings, 
  Database, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Server,
  Cpu,
  BarChart3,
  UserPlus,
  Trash2,
  Edit
} from 'lucide-react'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingStat } from '@/components/gaming/ProfessionalGamingStat'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  status: 'active' | 'inactive'
  lastLogin: string
  projects: number
}

interface SystemMetric {
  name: string
  value: string
  status: 'good' | 'warning' | 'error'
  icon: React.ComponentType<{ className?: string }>
}

const mockUsers: User[] = [
  {
    id: '1',
    name: 'Demo User',
    email: 'demo@uniqube3d.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2 minutes ago',
    projects: 4
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah@uniqube3d.com',
    role: 'manager',
    status: 'active',
    lastLogin: '1 hour ago',
    projects: 8
  },
  {
    id: '3',
    name: 'Mike Chen',
    email: 'mike@uniqube3d.com',
    role: 'user',
    status: 'active',
    lastLogin: '3 hours ago',
    projects: 2
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily@uniqube3d.com',
    role: 'user',
    status: 'inactive',
    lastLogin: '2 days ago',
    projects: 1
  }
]

const systemMetrics: SystemMetric[] = [
  { name: 'CPU Usage', value: '45%', status: 'good', icon: Cpu },
  { name: 'Memory', value: '67%', status: 'warning', icon: HardDrive },
  { name: 'Storage', value: '23%', status: 'good', icon: Database },
  { name: 'Active Users', value: '12', status: 'good', icon: Users },
  { name: 'API Response', value: '120ms', status: 'good', icon: Server },
  { name: 'Uptime', value: '99.9%', status: 'good', icon: Activity }
]

export default function AdminPage() {
  const [users] = useState(mockUsers)
  const [activeTab, setActiveTab] = useState('overview')

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-[rgba(239,68,68,0.2)] border-[#EF4444] text-[#EF4444]'
      case 'manager':
        return 'bg-[rgba(58,123,213,0.2)] border-[#3A7BD5] text-[#3A7BD5]'
      default:
        return 'bg-[rgba(107,114,128,0.2)] border-[#6B7280] text-[#6B7280]'
    }
  }

  const getStatusBadge = (status: string) => {
    return status === 'active' 
      ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' 
      : 'bg-[rgba(107,114,128,0.2)] border-[#6B7280] text-[#6B7280]'
  }

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-[#4A9B6B]'
      case 'warning':
        return 'text-[#F59E0B]'
      case 'error':
        return 'text-[#EF4444]'
      default:
        return 'text-[#6B7280]'
    }
  }

  return (
    <div className="w-full h-full space-y-6">
      {/* Professional Header with Enhanced Styling */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#3A7BD5]/20 via-[#00D2FF]/10 to-[#3A7BD5]/20 rounded-xl blur-xl"></div>
        <ProfessionalGamingCard variant="panel" className="relative p-6 border-2 border-[rgba(58,123,213,0.3)] bg-gradient-to-r from-[rgba(26,31,46,0.9)] to-[rgba(37,42,58,0.9)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] rounded-xl blur-md opacity-60"></div>
                <div className="relative p-4 rounded-xl bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] shadow-2xl">
                  <Shield className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#E8EAF0] to-[#3A7BD5] uppercase tracking-wider">
                  ADMIN DASHBOARD
                </h1>
                <p className="text-[#B8BCC8] text-base mt-1">Advanced system administration and user management</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <div className="px-4 py-2 rounded-lg bg-[rgba(74,155,107,0.2)] border border-[#4A9B6B]">
                <span className="text-[#4A9B6B] font-bold text-sm uppercase tracking-wider">SYSTEM ONLINE</span>
              </div>
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <ProfessionalGamingCard variant="panel" className="p-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <TabsTrigger 
              value="overview" 
              className={`relative rounded-lg px-4 py-3 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all duration-200 ${
                activeTab === 'overview' 
                  ? 'bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white shadow-lg shadow-[rgba(58,123,213,0.3)]' 
                  : 'bg-[rgba(37,42,58,0.6)] text-[#B8BCC8] hover:bg-[rgba(58,123,213,0.1)] hover:text-[#E8EAF0] border border-[rgba(58,123,213,0.2)]'
              }`}
            >
              OVERVIEW
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className={`relative rounded-lg px-4 py-3 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all duration-200 ${
                activeTab === 'users' 
                  ? 'bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white shadow-lg shadow-[rgba(58,123,213,0.3)]' 
                  : 'bg-[rgba(37,42,58,0.6)] text-[#B8BCC8] hover:bg-[rgba(58,123,213,0.1)] hover:text-[#E8EAF0] border border-[rgba(58,123,213,0.2)]'
              }`}
            >
              USERS
            </TabsTrigger>
            <TabsTrigger 
              value="system" 
              className={`relative rounded-lg px-4 py-3 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all duration-200 ${
                activeTab === 'system' 
                  ? 'bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white shadow-lg shadow-[rgba(58,123,213,0.3)]' 
                  : 'bg-[rgba(37,42,58,0.6)] text-[#B8BCC8] hover:bg-[rgba(58,123,213,0.1)] hover:text-[#E8EAF0] border border-[rgba(58,123,213,0.2)]'
              }`}
            >
              SYSTEM
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className={`relative rounded-lg px-4 py-3 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all duration-200 ${
                activeTab === 'settings' 
                  ? 'bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white shadow-lg shadow-[rgba(58,123,213,0.3)]' 
                  : 'bg-[rgba(37,42,58,0.6)] text-[#B8BCC8] hover:bg-[rgba(58,123,213,0.1)] hover:text-[#E8EAF0] border border-[rgba(58,123,213,0.2)]'
              }`}
            >
              SETTINGS
            </TabsTrigger>
          </div>
        </ProfessionalGamingCard>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-6">
          {/* Professional System Health */}
          <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-[#3A7BD5]" />
                <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">SYSTEM HEALTH</h3>
              </div>
              <p className="text-[#B8BCC8] text-sm">Real-time system performance metrics</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {systemMetrics.map((metric) => {
                  const Icon = metric.icon
                  return (
                    <div key={metric.name} className="bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.1)] rounded-lg p-3 sm:p-4 text-center hover:border-[rgba(58,123,213,0.2)] transition-colors">
                      <Icon className={`h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 ${getMetricStatusColor(metric.status)}`} />
                      <div className="text-lg sm:text-2xl font-bold text-[#E8EAF0] mb-1">{metric.value}</div>
                      <div className="text-xs sm:text-sm text-[#B8BCC8] uppercase tracking-wider">{metric.name}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </ProfessionalGamingCard>

          {/* Professional Quick Stats */}
          <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">SYSTEM OVERVIEW</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <ProfessionalGamingStat
                  value={24}
                  label="TOTAL PROJECTS"
                  variant="default"
                  icon={<BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />}
                />
                <ProfessionalGamingStat
                  value={4}
                  label="ACTIVE USERS"
                  variant="success"
                  icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
                />
                <ProfessionalGamingStat
                  value="1.2TB"
                  label="STORAGE USED"
                  variant="default"
                  icon={<HardDrive className="h-4 w-4 sm:h-5 sm:w-5" />}
                />
                <ProfessionalGamingStat
                  value="99.9%"
                  label="UPTIME"
                  variant="success"
                  icon={<CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
                  trend="up"
                />
              </div>
            </div>
          </ProfessionalGamingCard>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 sm:space-y-6 mt-6">
          <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-[#3A7BD5]" />
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">USER MANAGEMENT</h3>
                    <p className="text-[#B8BCC8] text-sm">Manage user accounts and permissions</p>
                  </div>
                </div>
                <ProfessionalGamingButton variant="primary" className="w-full sm:w-auto">
                  <UserPlus className="h-4 w-4 mr-2" />
                  ADD USER
                </ProfessionalGamingButton>
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                {users.map((user) => (
                  <ProfessionalGamingCard key={user.id} variant="monitor" className="p-4 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-[rgba(58,123,213,0.3)]">
                          <AvatarImage src={`/avatars/${user.name.toLowerCase().replace(' ', '-')}.png`} />
                          <AvatarFallback className="bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] text-white font-bold">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <div className="font-bold text-[#E8EAF0] text-sm sm:text-base uppercase tracking-wider">{user.name}</div>
                          <div className="text-[#B8BCC8] text-xs sm:text-sm">{user.email}</div>
                          <div className="text-[#6B7280] text-xs">Last login: {user.lastLogin}</div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                        <div className="flex flex-wrap gap-2">
                          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getRoleBadge(user.role)}`}>
                            {user.role}
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadge(user.status)}`}>
                            {user.status}
                          </div>
                        </div>
                        <div className="text-[#B8BCC8] text-xs sm:text-sm font-medium">
                          {user.projects} PROJECTS
                        </div>
                        <div className="flex gap-2">
                          <ProfessionalGamingButton variant="secondary" size="sm" className="h-8 w-8 p-0">
                            <Edit className="h-3 w-3" />
                          </ProfessionalGamingButton>
                          <ProfessionalGamingButton variant="secondary" size="sm" className="h-8 w-8 p-0">
                            <Trash2 className="h-3 w-3" />
                          </ProfessionalGamingButton>
                        </div>
                      </div>
                    </div>
                  </ProfessionalGamingCard>
                ))}
              </div>
            </div>
          </ProfessionalGamingCard>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4 sm:space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-[#3A7BD5]" />
                  <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">SYSTEM STATUS</h3>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                    <span className="text-[#E8EAF0] font-medium">Database</span>
                    <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]">
                      CONNECTED
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                    <span className="text-[#E8EAF0] font-medium">File Storage</span>
                    <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]">
                      HEALTHY
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                    <span className="text-[#E8EAF0] font-medium">API Gateway</span>
                    <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]">
                      ONLINE
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                    <span className="text-[#E8EAF0] font-medium">Background Jobs</span>
                    <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-[rgba(245,158,11,0.2)] border-[#F59E0B] text-[#F59E0B]">
                      3 PENDING
                    </div>
                  </div>
                </div>
              </div>
            </ProfessionalGamingCard>

            <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
                  <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">RECENT ALERTS</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                    <Clock className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
                    <span className="text-[#B8BCC8] text-sm">High memory usage detected - 2 hours ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                    <CheckCircle className="h-4 w-4 text-[#4A9B6B] flex-shrink-0" />
                    <span className="text-[#B8BCC8] text-sm">Backup completed successfully - 6 hours ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                    <AlertTriangle className="h-4 w-4 text-[#EF4444] flex-shrink-0" />
                    <span className="text-[#B8BCC8] text-sm">Failed login attempts detected - 1 day ago</span>
                  </div>
                </div>
              </div>
            </ProfessionalGamingCard>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4 sm:space-y-6 mt-6">
          <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-[#3A7BD5]" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">SYSTEM CONFIGURATION</h3>
                  <p className="text-[#B8BCC8] text-sm">Configure system-wide settings and preferences</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-file-size" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">MAXIMUM FILE SIZE (GB)</Label>
                    <Input 
                      id="max-file-size" 
                      defaultValue="5" 
                      className="bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">SESSION TIMEOUT (HOURS)</Label>
                    <Input 
                      id="session-timeout" 
                      defaultValue="24" 
                      className="bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-frequency" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">BACKUP FREQUENCY</Label>
                    <Input 
                      id="backup-frequency" 
                      defaultValue="Daily" 
                      className="bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5]"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-rate-limit" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">API RATE LIMIT (REQUESTS/MIN)</Label>
                    <Input 
                      id="api-rate-limit" 
                      defaultValue="1000" 
                      className="bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storage-path" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">STORAGE PATH</Label>
                    <Input 
                      id="storage-path" 
                      defaultValue="/var/lib/uniqube3d/storage" 
                      className="bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="log-level" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">LOG LEVEL</Label>
                    <Input 
                      id="log-level" 
                      defaultValue="INFO" 
                      className="bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5]"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <ProfessionalGamingButton variant="primary" className="flex-1 sm:flex-none">
                  SAVE CHANGES
                </ProfessionalGamingButton>
                <ProfessionalGamingButton variant="secondary" className="flex-1 sm:flex-none">
                  RESET TO DEFAULTS
                </ProfessionalGamingButton>
              </div>
            </div>
          </ProfessionalGamingCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
