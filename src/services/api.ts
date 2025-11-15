// API Types
export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'USER' | 'ADMIN' | 'MANAGER';
  avatar?: string;
}

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: 'OWNER' | 'MANAGER' | 'VIEWER';
  user: User;
  createdAt: string;
}

export interface ProjectWithRole extends Project {
  userRole?: 'OWNER' | 'MANAGER' | 'VIEWER';
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'on-hold' | 'planning';
  createdAt: string;
  updatedAt: string;
  lastUpdated?: string;
  modelUrl?: string;
  thumbnailUrl?: string;
  totalPanels?: number;
  completedPanels?: number;
  currentModel?: {
    id: string;
    type: string;
    status: string;
    sizeBytes: number;
    version: number;
    isActive: boolean;
  } | null;
  modelHistory?: Array<{
    id: string;
    type: string;
    status: string;
    sizeBytes: number;
    version: number;
    isActive: boolean;
    createdAt: string;
  }>;
  groups?: Array<{
    id: string;
    name: string;
    status: string;
    panelCount: number;
  }>;
  stats?: {
    totalModels?: number;
    totalGroups?: number;
    totalPanels?: number;
  };
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
  metadata?: { projectId?: string; projectName?: string; [key: string]: any };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ProjectsResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

// API Client
class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        return {} as T;
      }

      if (!response.ok) {
        const errorMessage = data.message || data.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    this.setToken(response.token);
    return response;
  }

  async register(email: string, password: string, name: string, organizationName?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, organizationName }),
    });
    
    this.setToken(response.token);
    return response;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  logout() {
    this.clearToken();
  }

  // Projects endpoints
  async getProjects(params?: any): Promise<ProjectsResponse> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<ProjectsResponse>(`/projects${queryString}`);
  }

  async getProject(id: string): Promise<{ project: Project }> {
    return this.request<{ project: Project }>(`/projects/${id}`);
  }

  async createProject(data: Partial<Project>): Promise<{ project: Project }> {
    return this.request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: Partial<Project>): Promise<{ project: Project }> {
    return this.request<{ project: Project }>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Notifications endpoints
  async getNotifications(): Promise<NotificationsResponse> {
    return this.request<NotificationsResponse>('/notifications');
  }

  async markNotificationsRead(data: { notificationIds?: string[]; markAll?: boolean }): Promise<void> {
    await this.request<void>('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Upload endpoints
  async uploadFile(file: File, projectId?: string): Promise<{ url: string; fileId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) {
      formData.append('projectId', projectId);
    }

    const headers: Record<string, string> = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
  }

  // Admin endpoints
  async getAllProjects(): Promise<{ projects: Project[] }> {
    return this.request<{ projects: Project[] }>('/admin/projects');
  }

  async getProjectMembers(projectId: string): Promise<{ members: ProjectMember[] }> {
    return this.request<{ members: ProjectMember[] }>(`/admin/projects/${projectId}/members`);
  }

  async addProjectMember(projectId: string, userId: string, role: 'OWNER' | 'MANAGER' | 'VIEWER'): Promise<{ member: ProjectMember }> {
    return this.request<{ member: ProjectMember }>(`/admin/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  async updateProjectMemberRole(projectId: string, userId: string, role: 'OWNER' | 'MANAGER' | 'VIEWER'): Promise<{ member: ProjectMember }> {
    return this.request<{ member: ProjectMember }>(`/admin/projects/${projectId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    await this.request<void>(`/admin/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async getAllUsers(): Promise<{ users: User[] }> {
    return this.request<{ users: User[] }>('/admin/users');
  }

  async getAssignableUsers(projectId: string): Promise<{ users: Array<User & { assigned: boolean }>; total: number; unassignedCount: number }> {
    return this.request<{ users: Array<User & { assigned: boolean }>; total: number; unassignedCount: number }>(`/admin/projects/${projectId}/assignable-users`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

export const api = new ApiClient();
