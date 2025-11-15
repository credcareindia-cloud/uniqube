import { useRBAC } from '@/contexts/RBACContext';

export const useProjectPermissions = (projectId?: string) => {
  const rbac = useRBAC();

  if (!projectId) {
    return {
      canView: false,
      canEdit: false,
      canManage: false,
      userRole: null,
      isOwner: false,
      isManager: false,
      isViewer: false,
    };
  }

  const userRole = rbac.getUserProjectRole(projectId);
  const canView = rbac.canViewProject(projectId);
  const canEdit = rbac.canEditProject(projectId);
  const canManage = rbac.canManageProject(projectId);

  return {
    canView,
    canEdit,
    canManage,
    userRole,
    isOwner: userRole === 'OWNER',
    isManager: userRole === 'MANAGER',
    isViewer: userRole === 'VIEWER',
  };
};