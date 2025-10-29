export enum PanelStatus {
  PLANNING = 'PLANNING',
  DESIGNED = 'DESIGNED',
  APPROVED = 'APPROVED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  MANUFACTURED = 'MANUFACTURED',
  QUALITY_CHECK = 'QUALITY_CHECK',
  SHIPPED = 'SHIPPED',
  ON_SITE = 'ON_SITE',
  INSTALLED = 'INSTALLED',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  REJECTED = 'REJECTED',
}

export interface PanelStatusHistory {
  id: string;
  panelId: string;
  status: PanelStatus;
  notes?: string;
  changedBy?: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
  };
}

export interface Panel {
  id: string;
  projectId: number;
  modelId?: string;
  elementId?: string;
  
  // Panel identification
  name: string;
  tag?: string;
  objectType?: string;
  
  // Panel properties
  dimensions?: string;
  location?: string;
  material?: string;
  weight?: number;
  area?: number;
  
  // Status and group assignment
  status: PanelStatus;
  groupId?: string;
  
  // Manufacturing and logistics
  productionDate?: string;
  shippingDate?: string;
  installationDate?: string;
  
  // Additional metadata
  notes?: string;
  metadata?: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;

  // Relations
  group?: {
    id: string;
    name: string;
  };
  model?: {
    id: string;
    name: string;
  };
  element?: {
    id: string;
    ifcType: string;
    name?: string;
  };
  statusHistory?: PanelStatusHistory[];
}

export interface CreatePanelData {
  name: string;
  tag?: string;
  objectType?: string;
  dimensions?: string;
  location?: string;
  material?: string;
  weight?: number;
  area?: number;
  modelId?: string;
  elementId?: string;
  groupId?: string;
  status?: PanelStatus;
  productionDate?: string;
  shippingDate?: string;
  installationDate?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdatePanelData extends Partial<CreatePanelData> {}

export interface PanelFilters {
  status?: PanelStatus;
  groupId?: string;
  search?: string;
  objectType?: string;
  location?: string;
  material?: string;
}

export interface PanelStatistics {
  totalPanels: number;
  statusDistribution: Record<PanelStatus, number>;
  groupDistribution: Array<{
    groupId: string;
    count: number;
  }>;
}

// Status configuration for UI
export const PANEL_STATUS_CONFIG = {
  [PanelStatus.PLANNING]: {
    label: 'Planning',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    description: 'Panel is in planning phase',
  },
  [PanelStatus.DESIGNED]: {
    label: 'Designed',
    color: '#3B82F6',
    bgColor: '#EBF8FF',
    description: 'Panel design is complete',
  },
  [PanelStatus.APPROVED]: {
    label: 'Approved',
    color: '#10B981',
    bgColor: '#ECFDF5',
    description: 'Panel design is approved',
  },
  [PanelStatus.IN_PRODUCTION]: {
    label: 'In Production',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    description: 'Panel is being manufactured',
  },
  [PanelStatus.MANUFACTURED]: {
    label: 'Manufactured',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    description: 'Panel manufacturing is complete',
  },
  [PanelStatus.QUALITY_CHECK]: {
    label: 'Quality Check',
    color: '#06B6D4',
    bgColor: '#CFFAFE',
    description: 'Panel is undergoing quality inspection',
  },
  [PanelStatus.SHIPPED]: {
    label: 'Shipped',
    color: '#84CC16',
    bgColor: '#F7FEE7',
    description: 'Panel has been shipped',
  },
  [PanelStatus.ON_SITE]: {
    label: 'On Site',
    color: '#EAB308',
    bgColor: '#FEFCE8',
    description: 'Panel has arrived on site',
  },
  [PanelStatus.INSTALLED]: {
    label: 'Installed',
    color: '#22C55E',
    bgColor: '#F0FDF4',
    description: 'Panel has been installed',
  },
  [PanelStatus.COMPLETED]: {
    label: 'Completed',
    color: '#059669',
    bgColor: '#ECFDF5',
    description: 'Panel installation is complete',
  },
  [PanelStatus.ON_HOLD]: {
    label: 'On Hold',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    description: 'Panel work is on hold',
  },
  [PanelStatus.REJECTED]: {
    label: 'Rejected',
    color: '#991B1B',
    bgColor: '#FEF2F2',
    description: 'Panel has been rejected',
  },
} as const;
