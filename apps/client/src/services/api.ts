/**
 * API service for the hierarchical permission management system
 * Handles all HTTP requests to the backend API
 */

import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios';

// Types for API requests and responses
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  base_hierarchy_id: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  base_hierarchy_id: string;
  hierarchy_path?: string;
  hierarchy_name?: string;
  is_active: boolean;
  phone?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  user_id: string;
  hierarchy_id: string;
  hierarchy_name?: string;
  hierarchy_path?: string;
  role: 'read' | 'manager' | 'admin';
  inherit_to_descendants: boolean;
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
}

export interface HierarchyStructure {
  id: string;
  name: string;
  description?: string;
  path: string;
  parent_id?: string;
  depth: number;
  is_active: boolean;
  user_count?: number;
  child_count?: number;
  children?: HierarchyStructure[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AccessScope {
  user_id: string;
  accessible_hierarchy_ids: string[];
  total_accessible_users: number;
  effective_roles: Record<string, string>;
  hierarchy_details: Array<{
    id: string;
    name: string;
    path: string;
    user_count: number;
    role: string;
    granted_at: string;
  }>;
  capabilities?: {
    can_grant_permissions: boolean;
    can_create_users: boolean;
    can_modify_hierarchy: boolean;
    max_accessible_depth: number;
  };
}

export interface QueryUsersRequest {
  hierarchy_filters?: {
    include_paths?: string[];
    exclude_paths?: string[];
    depth_range?: { min: number; max: number };
    specific_ids?: string[];
  };
  user_filters?: {
    is_active?: boolean;
    search?: string;
    email_domain?: string;
    created_after?: string;
    created_before?: string;
    has_phone?: boolean;
    metadata_filters?: Record<string, any>;
  };
  permission_filters?: {
    has_permissions?: boolean;
    roles?: string[];
    granted_by?: string;
    granted_after?: string;
    expires_before?: string;
    include_inherited?: boolean;
  };
  output_options?: {
    include_hierarchy_info?: boolean;
    include_permission_summary?: boolean;
    include_metadata?: boolean;
    include_analytics?: boolean;
    exclude_fields?: string[];
  };
  pagination?: {
    page?: number;
    limit?: number;
  };
  sorting?: {
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  meta?: any;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
}

class ApiService {
  private axios: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.axios = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.axios.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        const apiError: ApiError = {
          message: 'An error occurred',
          code: 'UNKNOWN_ERROR',
          statusCode: 500,
        };

        if (error.response?.data) {
          const errorData = error.response.data as any;
          apiError.message = errorData.error?.message || errorData.message || 'An error occurred';
          apiError.code = errorData.error?.code || 'API_ERROR';
          apiError.statusCode = error.response.status;
          apiError.details = errorData.error?.details;
        } else if (error.request) {
          apiError.message = 'Network error - please check your connection';
          apiError.code = 'NETWORK_ERROR';
        } else {
          apiError.message = error.message;
        }

        // If 401, clear token and redirect to login
        if (apiError.statusCode === 401) {
          this.clearToken();
          window.location.href = '/login';
        }

        return Promise.reject(apiError);
      }
    );
  }

  // Token management
  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  getToken(): string | null {
    return this.token;
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.axios.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
    const authData = response.data.data;
    this.setToken(authData.token);
    return authData;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await this.axios.post<ApiResponse<AuthResponse>>('/auth/register', userData);
    const authData = response.data.data;
    this.setToken(authData.token);
    return authData;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.axios.get<ApiResponse<User>>('/auth/me');
    return response.data.data;
  }

  async logout(): Promise<void> {
    try {
      await this.axios.post('/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await this.axios.post<ApiResponse<AuthResponse>>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    const authData = response.data.data;
    this.setToken(authData.token);
    return authData;
  }

  // User endpoints
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    hierarchy_id?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<PaginatedResponse<User>> {
    const response = await this.axios.get<PaginatedResponse<User>>('/users', { params });
    return response.data;
  }

  async getUser(id: string): Promise<User> {
    const response = await this.axios.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  }

  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'> & { password: string }): Promise<User> {
    const response = await this.axios.post<ApiResponse<User>>('/users', userData);
    return response.data.data;
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const response = await this.axios.put<ApiResponse<User>>(`/users/${id}`, userData);
    return response.data.data;
  }

  async deleteUser(id: string): Promise<void> {
    await this.axios.delete(`/users/${id}`);
  }

  // Permission endpoints
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const response = await this.axios.get<ApiResponse<Permission[]>>(`/permissions/user/${userId}`);
    return response.data.data;
  }

  async grantPermission(permissionData: {
    user_id: string;
    hierarchy_id: string;
    role: 'read' | 'manager' | 'admin';
    inherit_to_descendants?: boolean;
    expires_at?: string;
    metadata?: Record<string, any>;
  }): Promise<Permission> {
    const response = await this.axios.post<ApiResponse<Permission>>('/permissions', permissionData);
    return response.data.data;
  }

  async updatePermission(id: string, permissionData: {
    role?: 'read' | 'manager' | 'admin';
    inherit_to_descendants?: boolean;
    expires_at?: string;
    metadata?: Record<string, any>;
  }): Promise<Permission> {
    const response = await this.axios.put<ApiResponse<Permission>>(`/permissions/${id}`, permissionData);
    return response.data.data;
  }

  async revokePermission(id: string): Promise<void> {
    await this.axios.delete(`/permissions/${id}`);
  }

  async getUserAccessScope(userId: string): Promise<AccessScope> {
    const response = await this.axios.get<ApiResponse<AccessScope>>(`/permissions/scope/${userId}`);
    return response.data.data;
  }

  async getMyAccessScope(): Promise<AccessScope> {
    const response = await this.axios.get<ApiResponse<AccessScope>>('/permissions/my-scope');
    return response.data.data;
  }

  async checkUserAccess(targetUserId: string): Promise<{
    canAccess: boolean;
    accessLevel: string;
    effectiveRole: string;
    reason: string;
    hierarchy_path?: string;
  }> {
    const response = await this.axios.post<ApiResponse<any>>('/permissions/check/user-access', {
      target_user_id: targetUserId,
    });
    return response.data.data;
  }

  // Hierarchy endpoints
  async getHierarchies(params: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    parent_id?: string;
    depth?: number;
  } = {}): Promise<PaginatedResponse<HierarchyStructure>> {
    const response = await this.axios.get<PaginatedResponse<HierarchyStructure>>('/hierarchy', { params });
    return response.data;
  }

  async getHierarchyTree(params: {
    root_id?: string;
    max_depth?: number;
    include_inactive?: boolean;
    include_user_counts?: boolean;
  } = {}): Promise<HierarchyStructure> {
    const response = await this.axios.get<ApiResponse<HierarchyStructure>>('/hierarchy/tree', { params });
    return response.data.data;
  }

  async getHierarchy(id: string): Promise<HierarchyStructure> {
    const response = await this.axios.get<ApiResponse<HierarchyStructure>>(`/hierarchy/${id}`);
    return response.data.data;
  }

  async createHierarchy(hierarchyData: {
    name: string;
    description?: string;
    parent_id?: string;
    metadata?: Record<string, any>;
  }): Promise<HierarchyStructure> {
    const response = await this.axios.post<ApiResponse<HierarchyStructure>>('/hierarchy', hierarchyData);
    return response.data.data;
  }

  async updateHierarchy(id: string, hierarchyData: {
    name?: string;
    description?: string;
    is_active?: boolean;
    metadata?: Record<string, any>;
  }): Promise<HierarchyStructure> {
    const response = await this.axios.put<ApiResponse<HierarchyStructure>>(`/hierarchy/${id}`, hierarchyData);
    return response.data.data;
  }

  async deleteHierarchy(id: string): Promise<void> {
    await this.axios.delete(`/hierarchy/${id}`);
  }

  // Query endpoints (core feature)
  async queryUsers(queryData: QueryUsersRequest): Promise<PaginatedResponse<User> & { meta: any }> {
    const response = await this.axios.post<PaginatedResponse<User> & { meta: any }>('/query/users', queryData);
    return response.data;
  }

  async getAnalytics(params: {
    hierarchy_id?: string;
    include_trends?: boolean;
    period?: string;
    breakdown_by?: string;
  } = {}): Promise<any> {
    const response = await this.axios.get<ApiResponse<any>>('/query/analytics', { params });
    return response.data.data;
  }

  // Utility methods
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.axios.get<ApiResponse<any>>('/health');
    return response.data.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;

// Re-export types to ensure they're available
export type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  Permission,
  HierarchyStructure,
  AccessScope,
  QueryUsersRequest,
  PaginatedResponse,
  ApiResponse,
  ApiError
};