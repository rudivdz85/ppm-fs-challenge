/**
 * Database entity types that match the PostgreSQL schema
 * These types represent the actual database structure
 */

// Base database entity
export interface DatabaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

// Hierarchy Structure (matches hierarchy_structures table)
export interface HierarchyStructure extends DatabaseEntity {
  name: string;
  code: string;
  path: string; // ltree path
  parent_id: string | null;
  level: number;
  sort_order: number;
  metadata: Record<string, any>;
}

// User (matches users table)
export interface User extends DatabaseEntity {
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  base_hierarchy_id: string;
  is_verified: boolean;
  timezone: string;
  profile_data: Record<string, any>;
  
  // Joined fields (when queried with hierarchy)
  hierarchy_name?: string;
  hierarchy_code?: string;
  hierarchy_path?: string;
  hierarchy_level?: number;
}

// Permission actions enum (matches database enum)
export type PermissionAction = 
  | 'create'
  | 'read' 
  | 'update'
  | 'delete'
  | 'manage'
  | 'execute'
  | 'approve'
  | 'list';

// Permission scope enum (matches database enum)
export type PermissionScope = 
  | 'own'
  | 'team'
  | 'region'
  | 'organization'
  | 'system'
  | 'global';

// Permission (matches permissions table)
export interface Permission extends DatabaseEntity {
  name: string;
  code: string;
  resource: string;
  action: PermissionAction;
  scope: PermissionScope;
  conditions: Record<string, any>; // JSONB field
}

// Role (matches roles table)
export interface Role extends DatabaseEntity {
  name: string;
  code: string;
  level: number;
  description?: string;
}

// User Permission (matches user_permissions table)
export interface UserPermission extends DatabaseEntity {
  user_id: string;
  permission_id: string;
  hierarchy_id: string;
  inherit_to_descendants: boolean;
  valid_from: Date;
  valid_until: Date | null;
  granted_by: string;
  revoked_at?: Date;
  revoked_by?: string;
  context_data: Record<string, any>;
}

// User Role (matches user_roles table)
export interface UserRole extends DatabaseEntity {
  user_id: string;
  role_id: string;
  hierarchy_id: string;
  inherit_to_descendants: boolean;
  valid_from: Date;
  valid_until: Date | null;
  assigned_by: string;
  revoked_at?: Date;
  revoked_by?: string;
}

// Role Permission (matches role_permissions table)
export interface RolePermission extends DatabaseEntity {
  role_id: string;
  permission_id: string;
  inherit_to_descendants: boolean;
}

// Repository method return types
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface HierarchyStatistics {
  totalNodes: number;
  rootNodes: number;
  leafNodes: number;
  maxDepth: number;
  avgDepth: number;
}

export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  usersByLevel: Array<{
    level: number;
    count: number;
  }>;
}

export interface PermissionAuditEntry {
  action: 'granted' | 'revoked' | 'updated';
  permission_name: string;
  hierarchy_name: string;
  source: 'direct' | 'role';
  performed_by: string;
  performed_at: Date;
  details: Record<string, any>;
}

export interface HierarchyIntegrityIssue {
  issueType: 'orphaned_node' | 'level_inconsistency' | 'path_inconsistency' | 'duplicate_code';
  nodeId: string;
  nodeName: string;
  description: string;
}

// Extended types for repository operations
export interface UserWithPermissions extends User {
  permissions: Array<{
    permission: Permission;
    hierarchy: HierarchyStructure;
    source: 'direct' | 'role';
    source_name?: string;
    inherit_to_descendants: boolean;
    valid_from: Date;
    valid_until: Date | null;
    context_data: Record<string, any>;
  }>;
}

export interface StructureWithPermissions extends HierarchyStructure {
  permissions: Array<{
    user: User;
    permission: Permission;
    source: 'direct' | 'role';
    source_name?: string;
    inherit_to_descendants: boolean;
    valid_until: Date | null;
  }>;
}

// Query parameter types
export interface HierarchyQueryOptions {
  includeInactive?: boolean;
  orderBy?: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;
  limit?: number;
  offset?: number;
}

export interface UserQueryOptions extends HierarchyQueryOptions {
  hierarchyPath?: string;
  searchTerm?: string;
}

export interface PermissionQueryOptions {
  includeExpired?: boolean;
  resource?: string;
  action?: PermissionAction;
  scope?: PermissionScope;
}

// Repository method parameters
export interface CreateHierarchyData {
  name: string;
  code: string;
  parent_id?: string | null;
  sort_order?: number;
  metadata?: Record<string, any>;
}

export interface UpdateHierarchyData {
  name?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
}

export interface CreateUserData {
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  base_hierarchy_id: string;
  timezone?: string;
  profile_data?: Record<string, any>;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  base_hierarchy_id?: string;
  timezone?: string;
  profile_data?: Record<string, any>;
  is_verified?: boolean;
}

export interface GrantPermissionData {
  user_id: string;
  permission_id: string;
  hierarchy_id: string;
  inherit_to_descendants?: boolean;
  valid_from?: Date;
  valid_until?: Date;
  granted_by: string;
  context_data?: Record<string, any>;
}

export interface AssignRoleData {
  user_id: string;
  role_id: string;
  hierarchy_id: string;
  inherit_to_descendants?: boolean;
  valid_from?: Date;
  valid_until?: Date;
  assigned_by: string;
}

export interface UpdatePermissionData {
  inherit_to_descendants?: boolean;
  valid_until?: Date | null;
  context_data?: Record<string, any>;
}

// Permission checking types
export interface PermissionCheckRequest {
  resource: string;
  action: PermissionAction;
  hierarchy_id?: string;
}

export interface BulkPermissionCheckResult {
  [key: string]: boolean; // Format: "resource:action" -> boolean
}

// Search and filter types
export interface SearchUsersOptions {
  hierarchyPath?: string;
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface AccessibleStructuresOptions {
  minPermissionLevel?: 'read' | 'write' | 'manage';
}

export interface AccessibleUsersOptions {
  permissionType?: 'view' | 'manage';
}

// Transaction and error types
export interface DatabaseTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  query(sql: string, params?: any[]): Promise<any>;
}

export interface DatabaseError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

// Export all from existing permission types for compatibility
export * from './permission.types';