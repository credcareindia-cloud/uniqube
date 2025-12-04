import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/services/api';
import type { ProjectWithRole } from '@/services/api';

interface RBACContextType {
  userProjects: ProjectWithRole[];
  isAdmin: boolean;
  isGlobalManager: boolean;
  canCreateProjects: () => boolean;
  canViewProject: (projectId: string) => boolean;
  canEditProject: (projectId: string) => boolean;
  canManageProject: (projectId: string) => boolean;
  getUserProjectRole: (projectId: string) => 'OWNER' | 'MANAGER' | 'VIEWER' | null;
  refreshUserProjects: () => Promise<void>;
  isLoading: boolean;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

export const useRBAC = () => {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
};

interface RBACProviderProps {
  children: ReactNode;
}

export const RBACProvider: React.FC<RBACProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [userProjects, setUserProjects] = useState<ProjectWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isGlobalManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const refreshUserProjects = React.useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUserProjects([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.getProjects({ limit: 10000 });
      setUserProjects(response.projects as ProjectWithRole[]);
    } catch (error) {
      console.error('Failed to fetch user projects:', error);
      setUserProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    refreshUserProjects();
  }, [isAuthenticated, user]);

  const canCreateProjects = (): boolean => {
    return isAdmin;
  };

  const getUserProjectRole = (projectId: string): 'OWNER' | 'MANAGER' | 'VIEWER' | null => {
    const project = userProjects.find(p => p.id === projectId);
    return project?.userRole || null;
  };

  const canViewProject = (projectId: string): boolean => {
    if (isAdmin) return true;
    const role = getUserProjectRole(projectId);
    return role !== null;
  };

  const canEditProject = (projectId: string): boolean => {
    if (isAdmin) return true;
    const role = getUserProjectRole(projectId);
    return role === 'OWNER' || role === 'MANAGER';
  };

  const canManageProject = (projectId: string): boolean => {
    if (isAdmin) return true;
    const role = getUserProjectRole(projectId);
    return role === 'OWNER' || role === 'MANAGER';
  };

  const value: RBACContextType = {
    userProjects,
    isAdmin,
    isGlobalManager,
    canCreateProjects,
    canViewProject,
    canEditProject,
    canManageProject,
    getUserProjectRole,
    refreshUserProjects,
    isLoading,
  };

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
};