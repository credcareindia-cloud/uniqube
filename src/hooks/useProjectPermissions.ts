import { useRBAC } from '@/contexts/RBACContext';

export const useProjectPermissions = (projectId?: string) => {
  const rbac = useRBAC();

  if (!projectId) {
    return {
      canView: false,
      canEdit: false,
      canManage: false,
      pages: {
        viewer: false,
        drawings: false,
        panels: false,
        logistics: false,
        production: false,
        estimate: false,
      },
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
    pages: {
      viewer: rbac.hasPermission('viewer'),
      drawings: rbac.hasPermission('drawings'),
      panels: rbac.hasPermission('panels'),
      logistics: rbac.hasPermission('logistics'),
      production: rbac.hasPermission('production'),
      estimate: rbac.hasPermission('estimate.view'),
    },
  };
};