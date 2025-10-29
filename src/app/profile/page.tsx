import { useState } from 'react'
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
  TrendingUp 
} from 'lucide-react'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingStat } from '@/components/gaming/ProfessionalGamingStat'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: 'Demo User',
    email: 'demo@uniqube3d.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    company: 'UniQube Construction',
    role: 'Project Manager',
    joinDate: 'January 2024'
  })

  const handleSave = () => {
    setIsEditing(false)
    // TODO: Save profile data to backend
    console.log('Saving profile data:', formData)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="w-full h-full space-y-4 sm:space-y-6">
      {/* Professional Header */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] shadow-lg">
            <User className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">USER PROFILE</h1>
            <p className="text-[#B8BCC8] text-sm">Manage your account settings and digital twin preferences</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <ProfessionalGamingButton variant="secondary" size="sm" className="flex-1 sm:flex-none">
              <Settings className="h-4 w-4 mr-2" />
              SETTINGS
            </ProfessionalGamingButton>
          </div>
        </div>
      </ProfessionalGamingCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Professional Profile Card */}
        <ProfessionalGamingCard variant="monitor" className="lg:col-span-1 p-4 sm:p-6">
          <div className="text-center space-y-4 sm:space-y-6">
            <div className="relative mx-auto w-fit">
              <div className="relative">
                <Avatar className="h-24 w-24 sm:h-32 sm:w-32 mx-auto border-4 border-[rgba(58,123,213,0.3)] shadow-2xl">
                  <AvatarImage src="/avatars/demo-user.png" />
                  <AvatarFallback className="bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] text-white text-2xl sm:text-4xl font-bold">
                    {formData.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <ProfessionalGamingButton
                  variant="secondary"
                  size="sm"
                  className="absolute -bottom-2 -right-2 h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0"
                >
                  <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
                </ProfessionalGamingButton>
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-[#E8EAF0] uppercase tracking-wider">{formData.name}</h2>
              <p className="text-[#B8BCC8] text-sm sm:text-base">{formData.role}</p>
              <div className="px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs font-bold uppercase tracking-wider border bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B] inline-block">
                ACTIVE USER
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4 text-left">
              <div className="flex items-center gap-3 p-2 sm:p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-[#3A7BD5] flex-shrink-0" />
                <span className="text-[#B8BCC8] text-xs sm:text-sm truncate">{formData.email}</span>
              </div>
              <div className="flex items-center gap-3 p-2 sm:p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-[#3A7BD5] flex-shrink-0" />
                <span className="text-[#B8BCC8] text-xs sm:text-sm">{formData.phone}</span>
              </div>
              <div className="flex items-center gap-3 p-2 sm:p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-[#3A7BD5] flex-shrink-0" />
                <span className="text-[#B8BCC8] text-xs sm:text-sm">{formData.location}</span>
              </div>
              <div className="flex items-center gap-3 p-2 sm:p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <Building className="h-4 w-4 sm:h-5 sm:w-5 text-[#3A7BD5] flex-shrink-0" />
                <span className="text-[#B8BCC8] text-xs sm:text-sm">{formData.company}</span>
              </div>
              <div className="flex items-center gap-3 p-2 sm:p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-[#3A7BD5] flex-shrink-0" />
                <span className="text-[#B8BCC8] text-xs sm:text-sm">Joined {formData.joinDate}</span>
              </div>
            </div>
          </div>
        </ProfessionalGamingCard>

        {/* Professional Profile Form */}
        <ProfessionalGamingCard variant="panel" className="lg:col-span-2 p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">PERSONAL INFORMATION</h3>
                <p className="text-[#B8BCC8] text-xs sm:text-sm">Update your personal details and contact information</p>
              </div>
              {!isEditing ? (
                <ProfessionalGamingButton variant="primary" onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
                  EDIT PROFILE
                </ProfessionalGamingButton>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <ProfessionalGamingButton variant="secondary" onClick={() => setIsEditing(false)} className="flex-1 sm:flex-none">
                    CANCEL
                  </ProfessionalGamingButton>
                  <ProfessionalGamingButton variant="primary" onClick={handleSave} className="flex-1 sm:flex-none">
                    <Save className="h-4 w-4 mr-2" />
                    SAVE CHANGES
                  </ProfessionalGamingButton>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">FULL NAME</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={!isEditing}
                  className={`bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5] ${!isEditing ? 'opacity-60' : ''}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">EMAIL ADDRESS</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={!isEditing}
                  className={`bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5] ${!isEditing ? 'opacity-60' : ''}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">PHONE NUMBER</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={!isEditing}
                  className={`bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5] ${!isEditing ? 'opacity-60' : ''}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">LOCATION</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  disabled={!isEditing}
                  className={`bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5] ${!isEditing ? 'opacity-60' : ''}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">COMPANY</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  disabled={!isEditing}
                  className={`bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5] ${!isEditing ? 'opacity-60' : ''}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-[#E8EAF0] font-medium uppercase tracking-wider text-xs sm:text-sm">ROLE</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  disabled={!isEditing}
                  className={`bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5] ${!isEditing ? 'opacity-60' : ''}`}
                />
              </div>
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>

      {/* Professional Activity Stats */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
        <div className="space-y-4 sm:space-y-6">
          <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">ACTIVITY OVERVIEW</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <ProfessionalGamingStat
              value={4}
              label="ACTIVE PROJECTS"
              variant="default"
              icon={<Activity className="h-4 w-4 sm:h-5 sm:w-5" />}
            />
            <ProfessionalGamingStat
              value={12}
              label="GROUPS MANAGED"
              variant="success"
              icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
            />
            <ProfessionalGamingStat
              value={870}
              label="PANELS TRACKED"
              variant="default"
              icon={<Package className="h-4 w-4 sm:h-5 sm:w-5" />}
            />
            <ProfessionalGamingStat
              value="95%"
              label="COMPLETION RATE"
              variant="success"
              icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
              trend="up"
            />
          </div>
        </div>
      </ProfessionalGamingCard>
    </div>
  )
}
