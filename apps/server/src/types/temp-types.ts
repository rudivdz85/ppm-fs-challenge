// Temporary types to resolve @ppm/types import issues

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  phone?: string;
  base_hierarchy_id: string;
  base_hierarchy_level?: number;
  hierarchy_level?: number;
  hierarchy_path?: string;
  hierarchy_name?: string;
  is_active: boolean;
  is_verified?: boolean;
  metadata?: Record<string, any>;
  last_login_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface HierarchyStructure {
  id: string;
  name: string;
  code: string;
  description?: string;
  path: string;
  parent_id?: string;
  level: number;
  sort_order: number;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Permission {
  id: string;
  user_id: string;
  hierarchy_id: string;
  role: PermissionRole;
  inherit_to_descendants: boolean;
  granted_by: string;
  granted_at: Date;
  expires_at?: Date;
  revoked_at?: Date;
  revoked_by?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
  hierarchy_path?: string;
  hierarchy_name?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type PermissionRole = 'read' | 'manager' | 'admin';

export const PermissionRoleValues = {
  read: 'read' as const,
  manager: 'manager' as const,
  admin: 'admin' as const
} as const;

export interface TokenPayload {
  user_id: string;
  email: string;
  hierarchy_id: string;
  hierarchy_path?: string;
  iat: number;
  exp: number;
  type?: 'access' | 'refresh';
}

export interface CreateUserData {
  email: string;
  full_name: string;
  password_hash: string;
  base_hierarchy_id: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface UpdateUserData {
  email?: string;
  full_name?: string;
  phone?: string;
  base_hierarchy_id?: string;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  offset: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirm_password?: string;
}

export interface UserWithAccessContext extends User {
  access_level: 'direct' | 'inherited';
  permission_source: 'direct' | 'role';
  user_hierarchy_path: string;
  user_hierarchy_name: string;
  accessible_through: string[];
  permissions: Permission[];
  hierarchy_id: string;
  hierarchy_name?: string;
}

export interface PaginatedUserResult {
  users?: User[];
  items?: User[];
  data?: User[];
  total: number;
  page?: number;
  pages?: number;
  limit: number;
  offset: number;
  has_more?: boolean;
  filters_applied?: any;
}

export interface QueryResult {
  data: any[];
  items: any[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  offset: number;
}

// Base entity for models
export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

// Additional types for repositories
export interface UserPermission extends Permission {}
export interface UserRole {
  id: string;
  user_id: string;
  role: PermissionRole;
  hierarchy_id: string;
  granted_by: string;
  granted_at: Date;
  expires_at?: Date;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  permissions: string[];
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface RolePermission extends Permission {}

export interface HierarchyStatistics {
  total_nodes: number;
  max_depth: number;
  nodes_by_level: Record<number, number>;
  active_nodes: number;
  user_distribution: Record<string, number>;
}

export interface UserStatistics {
  total_users: number;
  active_users: number;
  users_by_hierarchy: Record<string, number>;
  users_by_role: Record<string, number>;
}

export interface PermissionAuditEntry {
  id: string;
  action: string;
  user_id: string;
  target_id: string;
  target_type: string;
  details: Record<string, any>;
  performed_by: string;
  performed_at: Date;
}

export interface HierarchyIntegrityIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  hierarchy_id: string;
  description: string;
  suggested_fix?: string;
}

export interface CreateHierarchyData {
  name: string;
  code: string;
  description?: string;
  parent_id?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
}

export interface UpdateHierarchyData {
  name?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface GrantPermissionData {
  user_id: string;
  hierarchy_id: string;
  role: PermissionRole;
  inherit_to_descendants?: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface AssignRoleData {
  user_id: string;
  role_id: string;
  hierarchy_id: string;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface UpdatePermissionData {
  role?: PermissionRole;
  inherit_to_descendants?: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface PermissionCheckRequest {
  user_id: string;
  hierarchy_id: string;
  required_role?: PermissionRole;
}

export interface BulkPermissionCheckResult {
  user_id: string;
  hierarchy_id: string;
  can_access: boolean;
  effective_role?: PermissionRole;
  access_level: 'direct' | 'inherited';
}

export interface HierarchyQueryOptions {
  include_inactive?: boolean;
  max_depth?: number;
  parent_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UserQueryOptions {
  hierarchy_ids?: string[];
  roles?: PermissionRole[];
  is_active?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PermissionQueryOptions {
  user_id?: string;
  hierarchy_id?: string;
  role?: PermissionRole;
  is_active?: boolean;
  expires_before?: Date;
  expires_after?: Date;
  page?: number;
  limit?: number;
}