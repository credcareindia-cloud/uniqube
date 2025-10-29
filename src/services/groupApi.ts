import { Group, GroupStatus, CreateGroupData, UpdateGroupData } from '../types/group';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class GroupApiService {
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

  // Get all groups for a project
  static async getGroups(
    projectId: number,
    filters?: {
      status?: GroupStatus;
      search?: string;
    }
  ): Promise<Group[]> {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const endpoint = `/groups/${projectId}${queryString ? `?${queryString}` : ''}`;
    
    return this.request<Group[]>(endpoint);
  }

  // Get a specific group
  static async getGroup(projectId: number, groupId: string): Promise<Group> {
    return this.request<Group>(`/groups/${projectId}/${groupId}`);
  }

  // Create a new group
  static async createGroup(projectId: number, groupData: CreateGroupData): Promise<Group> {
    return this.request<Group>(`/groups/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  // Update a group
  static async updateGroup(
    projectId: number,
    groupId: string,
    groupData: UpdateGroupData
  ): Promise<Group> {
    return this.request<Group>(`/groups/${projectId}/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(groupData),
    });
  }

  // Assign panels to a group
  static async assignPanelsToGroup(
    projectId: number,
    groupId: string,
    panelIds: string[]
  ): Promise<Group> {
    return this.request<Group>(`/groups/${projectId}/${groupId}/panels`, {
      method: 'POST',
      body: JSON.stringify({ panelIds }),
    });
  }

  // Remove panels from a group
  static async removePanelsFromGroup(
    projectId: number,
    groupId: string,
    panelIds: string[]
  ): Promise<Group> {
    return this.request<Group>(`/groups/${projectId}/${groupId}/panels`, {
      method: 'DELETE',
      body: JSON.stringify({ panelIds }),
    });
  }

  // Delete a group
  static async deleteGroup(projectId: number, groupId: string): Promise<void> {
    return this.request<void>(`/groups/${projectId}/${groupId}`, {
      method: 'DELETE',
    });
  }

  // Get group statistics
  static async getGroupStatistics(projectId: number): Promise<{
    totalGroups: number;
    statusDistribution: Record<GroupStatus, number>;
    groupsWithPanels: Array<{
      id: string;
      name: string;
      status: GroupStatus;
      panelCount: number;
    }>;
    totalPanelsInGroups: number;
  }> {
    return this.request(`/groups/${projectId}/statistics`);
  }
}
