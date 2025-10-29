export enum GroupStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
}

export interface Group {
  id: string;
  projectId: number;
  name: string;
  description?: string;
  status: GroupStatus;
  
  // Group metadata
  elementIds?: string[];
  metadata?: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;

  // Relations
  panels?: Array<{
    id: string;
    name: string;
    tag?: string;
    status: string;
    objectType?: string;
  }>;
  project?: {
    id: number;
    name: string;
  };
  _count?: {
    panels: number;
  };
}

export interface CreateGroupData {
  name: string;
  description?: string;
  status?: GroupStatus;
  elementIds?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateGroupData extends Partial<CreateGroupData> {}

export interface GroupFilters {
  status?: GroupStatus;
  search?: string;
}

export interface GroupStatistics {
  totalGroups: number;
  statusDistribution: Record<GroupStatus, number>;
  groupsWithPanels: Array<{
    id: string;
    name: string;
    status: GroupStatus;
    panelCount: number;
  }>;
  totalPanelsInGroups: number;
}

// Status configuration for UI
export const GROUP_STATUS_CONFIG = {
  [GroupStatus.PENDING]: {
    label: 'Pending',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    description: 'Group is pending',
  },
  [GroupStatus.IN_PROGRESS]: {
    label: 'In Progress',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    description: 'Group work is in progress',
  },
  [GroupStatus.COMPLETED]: {
    label: 'Completed',
    color: '#059669',
    bgColor: '#ECFDF5',
    description: 'Group work is completed',
  },
  [GroupStatus.ON_HOLD]: {
    label: 'On Hold',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    description: 'Group work is on hold',
  },
} as const;
