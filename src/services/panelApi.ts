import { Panel, PanelStatus, CreatePanelData, UpdatePanelData } from '../types/panel';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class PanelApiService {
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Get all panels for a project
  static async getPanels(
    projectId: number,
    filters?: {
      status?: PanelStatus;
      groupId?: string;
      search?: string;
    }
  ): Promise<Panel[]> {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.groupId) params.append('groupId', filters.groupId);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = `/panels/${projectId}${queryString ? `?${queryString}` : ''}`;
    
    return this.request<Panel[]>(endpoint);
  }

  // Get a specific panel
  static async getPanel(projectId: number, panelId: string): Promise<Panel> {
    return this.request<Panel>(`/panels/${projectId}/${panelId}`);
  }

  // Create a new panel
  static async createPanel(projectId: number, panelData: CreatePanelData): Promise<Panel> {
    return this.request<Panel>(`/panels/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(panelData),
    });
  }

  // Update a panel
  static async updatePanel(
    projectId: number,
    panelId: string,
    panelData: UpdatePanelData
  ): Promise<Panel> {
    return this.request<Panel>(`/panels/${projectId}/${panelId}`, {
      method: 'PUT',
      body: JSON.stringify(panelData),
    });
  }

  // Update panel status
  static async updatePanelStatus(
    projectId: number,
    panelId: string,
    status: PanelStatus,
    notes?: string
  ): Promise<Panel> {
    return this.request<Panel>(`/panels/${projectId}/${panelId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  // Delete a panel
  static async deletePanel(projectId: number, panelId: string): Promise<void> {
    return this.request<void>(`/panels/${projectId}/${panelId}`, {
      method: 'DELETE',
    });
  }

  // Get panel statistics
  static async getPanelStatistics(projectId: number): Promise<{
    totalPanels: number;
    statusDistribution: Record<PanelStatus, number>;
    groupDistribution: Array<{ groupId: string; count: number }>;
  }> {
    return this.request(`/panels/${projectId}/statistics`);
  }

  // Bulk operations
  static async bulkUpdatePanelStatus(
    projectId: number,
    panelIds: string[],
    status: PanelStatus,
    notes?: string
  ): Promise<Panel[]> {
    const promises = panelIds.map(panelId =>
      this.updatePanelStatus(projectId, panelId, status, notes)
    );
    return Promise.all(promises);
  }

  static async bulkDeletePanels(projectId: number, panelIds: string[]): Promise<void> {
    const promises = panelIds.map(panelId =>
      this.deletePanel(projectId, panelId)
    );
    await Promise.all(promises);
  }
}
