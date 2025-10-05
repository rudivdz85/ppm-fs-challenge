import type { BaseEntity } from '../types/temp-types';
import type { User } from './User';
import type { HierarchyStructure } from './HierarchyStructure';

/**
 * Permission action types
 */
export type PermissionAction = 
  | 'create' | 'read' | 'update' | 'delete' | 'list'
  | 'execute' | 'manage' | 'approve' | 'reject' | 'export' | 'import';

/**
 * Permission scope types
 */
export type PermissionScope = 
  | 'own'           // Own records only
  | 'team'          // Team/department level
  | 'branch'        // Branch/location level  
  | 'region'        // Regional level
  | 'organization'  // Organization-wide
  | 'system';       // System-wide (super admin)

/**
 * Permission Model
 * Represents a system permission with resource-action-scope model
 */
export interface Permission extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  
  // Permission definition
  resource: string;
  action: PermissionAction;
  scope: PermissionScope;
  
  // Permission metadata
  isActive: boolean;
  isSystemPermission: boolean;
  
  // Dynamic permission conditions
  conditions: Record<string, any>;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
}

/**
 * User Permission Model
 * Links users to permissions with hierarchical context
 */
export interface UserPermission extends BaseEntity {
  userId: string;
  permissionId: string;
  hierarchyId: string;
  
  // Permission inheritance settings
  inheritToDescendants: boolean;
  inheritFromAncestors: boolean;
  
  // Permission metadata
  isActive: boolean;
  isExplicit: boolean; // false for inherited permissions
  
  // Validity period
  validFrom: Date;
  validUntil?: Date;
  
  // Grant/revoke audit
  grantedAt: Date;
  grantedBy: string;
  revokedAt?: Date;
  revokedBy?: string;
  
  // Additional context
  contextData: Record<string, any>;
  
  // Populated relations
  user?: User;
  permission?: Permission;
  hierarchy?: HierarchyStructure;
  grantedByUser?: User;
  revokedByUser?: User;
}

/**
 * Role Model
 * Role-based access control with hierarchical levels
 */
export interface Role extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  level: number; // Hierarchy level for role comparison
  isActive: boolean;
  isSystemRole: boolean;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Role Permission Model
 * Links roles to permissions
 */
export interface RolePermission extends BaseEntity {
  roleId: string;
  permissionId: string;
  isActive: boolean;
  inheritToDescendants: boolean;
  
  // Populated relations
  role?: Role;
  permission?: Permission;
  
  // Audit fields
  createdBy?: string;
}

/**
 * User Role Model
 * Links users to roles with hierarchical context
 */
export interface UserRole extends BaseEntity {
  userId: string;
  roleId: string;
  hierarchyId: string;
  
  isActive: boolean;
  inheritToDescendants: boolean;
  
  // Validity period
  validFrom: Date;
  validUntil?: Date;
  
  // Assignment audit
  assignedAt: Date;
  assignedBy: string;
  revokedAt?: Date;
  revokedBy?: string;
  
  // Populated relations
  user?: User;
  role?: Role;
  hierarchy?: HierarchyStructure;
  assignedByUser?: User;
  revokedByUser?: User;
}

/**
 * Input models for creating permissions
 */
export interface CreatePermissionInput {
  name: string;
  code: string;
  description?: string;
  resource: string;
  action: PermissionAction;
  scope: PermissionScope;
  conditions?: Record<string, any>;
}

export interface CreateRoleInput {
  name: string;
  code: string;
  description?: string;
  level?: number;
  permissions?: string[]; // Permission IDs
}

export interface GrantUserPermissionInput {
  userId: string;
  permissionId: string;
  hierarchyId: string;
  inheritToDescendants?: boolean;
  validFrom?: Date;
  validUntil?: Date;
  contextData?: Record<string, any>;
}

export interface AssignUserRoleInput {
  userId: string;
  roleId: string;
  hierarchyId: string;
  inheritToDescendants?: boolean;
  validFrom?: Date;
  validUntil?: Date;
}

/**
 * Permission check request
 */
export interface PermissionCheckRequest {
  userId: string;
  resource: string;
  action: PermissionAction;
  hierarchyId?: string;
  scope?: PermissionScope;
  contextData?: Record<string, any>;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  matchedPermissions: Permission[];
  effectiveScope: PermissionScope;
  hierarchyPath?: string[];
  source: 'direct' | 'role' | 'inherited';
}

/**
 * User permissions summary
 */
export interface UserPermissionsSummary {
  userId: string;
  directPermissions: UserPermission[];
  rolePermissions: Array<{
    role: Role;
    permissions: Permission[];
    hierarchy: HierarchyStructure;
  }>;
  inheritedPermissions: Array<{
    permission: Permission;
    sourceHierarchy: HierarchyStructure;
    inheritancePath: string[];
  }>;
  effectivePermissions: Array<{
    permission: Permission;
    scope: PermissionScope;
    hierarchies: HierarchyStructure[];
    source: 'direct' | 'role' | 'inherited';
  }>;
}

/**
 * Permission query options
 */
export interface PermissionQueryOptions {
  searchTerm?: string;
  resource?: string;
  action?: PermissionAction;
  scope?: PermissionScope;
  isActive?: boolean;
  isSystemPermission?: boolean;
  sortBy?: 'name' | 'resource' | 'action' | 'scope' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  offset?: number;
  limit?: number;
}

/**
 * Hierarchy permission matrix
 */
export interface HierarchyPermissionMatrix {
  hierarchyId: string;
  hierarchy: HierarchyStructure;
  users: Array<{
    user: User;
    directPermissions: Permission[];
    rolePermissions: Array<{
      role: Role;
      permissions: Permission[];
    }>;
    inheritedPermissions: Permission[];
    effectivePermissions: Permission[];
  }>;
}

/**
 * Permission audit log entry
 */
export interface PermissionAuditLog {
  id: string;
  action: 'grant' | 'revoke' | 'modify' | 'check';
  userId: string;
  permissionId?: string;
  roleId?: string;
  hierarchyId?: string;
  performedBy: string;
  performedAt: Date;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}