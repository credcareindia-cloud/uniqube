import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, User } from 'lucide-react';

interface RoleBadgeProps {
  role: 'OWNER' | 'MANAGER' | 'VIEWER' | 'ADMIN' | 'USER';
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'sm', showIcon = false }) => {
  const getRoleConfig = (role: string) => {
    switch (role) {
      case 'OWNER':
        return {
          variant: 'destructive' as const,
          label: 'Owner',
          icon: Shield,
          color: 'text-red-600',
        };
      case 'MANAGER':
        return {
          variant: 'default' as const,
          label: 'Manager',
          icon: Users,
          color: 'text-blue-600',
        };
      case 'VIEWER':
        return {
          variant: 'secondary' as const,
          label: 'Viewer',
          icon: User,
          color: 'text-gray-600',
        };
      case 'ADMIN':
        return {
          variant: 'destructive' as const,
          label: 'Admin',
          icon: Shield,
          color: 'text-red-600',
        };
      case 'USER':
        return {
          variant: 'secondary' as const,
          label: 'User',
          icon: User,
          color: 'text-gray-600',
        };
      default:
        return {
          variant: 'secondary' as const,
          label: role,
          icon: User,
          color: 'text-gray-600',
        };
    }
  };

  const config = getRoleConfig(role);
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={size === 'sm' ? 'text-xs' : 'text-sm'}>
      {showIcon && <Icon className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />}
      {config.label}
    </Badge>
  );
};