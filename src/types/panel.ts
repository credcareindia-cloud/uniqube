export enum PanelStatus {
  READY_FOR_PRODUCTION = 'READY_FOR_PRODUCTION',
  PRODUCED = 'PRODUCED',
  PRE_FABRICATED = 'PRE_FABRICATED',
  READY_FOR_TRUCK_LOAD = 'READY_FOR_TRUCK_LOAD',
  SHIPPED = 'SHIPPED',
  EDIT = 'EDIT',
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
  [PanelStatus.READY_FOR_PRODUCTION]: {
    label: 'Ready For Production',
    color: '#10B981',
    bgColor: '#ECFDF5',
    description: 'Panel is ready for production',
  },
  [PanelStatus.PRODUCED]: {
    label: 'Produced',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    description: 'Panel has been produced',
  },
  [PanelStatus.PRE_FABRICATED]: {
    label: 'Pre Fabricated',
    color: '#3B82F6',
    bgColor: '#EBF8FF',
    description: 'Panel has been pre-fabricated',
  },
  [PanelStatus.READY_FOR_TRUCK_LOAD]: {
    label: 'Ready For Truck Load',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    description: 'Panel is ready for truck loading',
  },
  [PanelStatus.SHIPPED]: {
    label: 'Shipped',
    color: '#84CC16',
    bgColor: '#F7FEE7',
    description: 'Panel has been shipped',
  },
  [PanelStatus.EDIT]: {
    label: 'Edit',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    description: 'Panel needs editing or revision',
  },
} as const;
