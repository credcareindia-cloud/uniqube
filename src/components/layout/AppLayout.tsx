import React from 'react'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
// import { useAuth } from '@/hooks/useAuth'
import { GamingBackground } from '@/components/gaming/GamingBackground'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = {
    user: {
      name: 'John Doe',
      email: 'john.doe@example.com',
    },
    loading: false,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1419] relative overflow-hidden">
        <GamingBackground />
        
        {/* Professional Loading Card */}
        <div className="bg-[rgba(26,31,46,0.95)] border border-[rgba(58,123,213,0.2)] rounded-xl p-8 text-center backdrop-blur-sm shadow-2xl max-w-md w-full mx-4">
          {/* Professional Logo/Icon */}
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#3A7BD5] to-[#2E5F9F] rounded-lg flex items-center justify-center shadow-lg">
              <div className="text-2xl font-bold text-[#E8EAF0]">3D</div>
            </div>
            <div className="absolute inset-0 w-16 h-16 mx-auto rounded-lg bg-gradient-to-br from-[#3A7BD5] to-[#2E5F9F] opacity-20 animate-pulse"></div>
          </div>
          
          {/* Professional Title */}
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">UniQube 3D</h1>
            <p className="text-[#B8BCC8] text-sm uppercase tracking-wider font-medium mt-1">IFC PROJECT CONTROL</p>
          </div>
          
          {/* Professional Status */}
          <div className="mb-6">
            <p className="text-[#6B7BD5] text-sm uppercase tracking-wider font-medium">INITIALIZING SYSTEM...</p>
          </div>
          
          {/* Professional Progress Bar */}
          <div className="relative">
            <div className="w-full bg-[#252A3A] rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#3A7BD5] to-[#2E5F9F] rounded-full animate-pulse shadow-[0_0_8px_rgba(58,123,213,0.4)]" style={{ width: '75%' }}></div>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs">
              <span className="text-[#B8BCC8]">Loading...</span>
              <span className="text-[#3A7BD5] font-medium">75%</span>
            </div>
          </div>
          
          {/* Professional Corner Accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#3A7BD5] rounded-tl-xl opacity-60"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#3A7BD5] rounded-tr-xl opacity-60"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#3A7BD5] rounded-bl-xl opacity-60"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#3A7BD5] rounded-br-xl opacity-60"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <GamingBackground />
        {children}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] overflow-hidden">
      <GamingBackground />
      
      {/* Fixed Top Navigation - Full width */}
      <header className="absolute top-0 left-0 right-0 z-50 h-16 bg-[rgba(15,20,25,0.95)] backdrop-blur-xl border-b border-[rgba(184,188,200,0.1)]">
        <Navbar />
      </header>
      
      {/* Fixed Sidebar - Desktop */}
      <aside className="absolute top-16 left-0 bottom-0 w-64 z-40 hidden lg:block bg-[rgba(15,20,25,0.95)] backdrop-blur-xl border-r border-[rgba(184,188,200,0.1)]">
        <Sidebar />
      </aside>
      
      {/* Mobile Sidebar Overlay */}
      <div className="absolute inset-0 z-30 lg:hidden" id="mobile-sidebar-overlay" style={{ display: 'none' }}>
        <div className="absolute inset-0 bg-black/50" id="mobile-sidebar-backdrop"></div>
        <aside className="absolute top-16 left-0 bottom-0 w-64 bg-[rgba(15,20,25,0.95)] backdrop-blur-xl border-r border-[rgba(184,188,200,0.1)]">
          <Sidebar />
        </aside>
      </div>
      
      {/* Main Content Area - Full coverage */}
      <main className="absolute top-16 right-0 bottom-0 left-0 lg:left-64 overflow-auto bg-[#0a0a0f]">
        <div className="min-h-full p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
