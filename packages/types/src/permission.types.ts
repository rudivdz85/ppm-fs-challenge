// Database entity for permissions (hierarchical permission system)
export interface Permission {
  id: string;
  user_id: string;
  hierarchy_id: string;
  role: PermissionRole;
  inherit_to_descendants: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
  granted_by: string;
  granted_at: Date;
  revoked_by?: string;
  revoked_at?: Date;
  updated_by?: string;
  updated_at?: Date;
  is_active: boolean;
  // Joined fields from hierarchy
  hierarchy_name?: string;
  hierarchy_path?: string;
  hierarchy_level?: number;
}

// Legacy permission interface for backward compatibility
export interface PermissionLegacy {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: PermissionAction;
  scope: PermissionScope;
  conditions?: PermissionCondition[];
  createdAt: Date;
  updatedAt: Date;
}

// Role-based permission system
export enum PermissionRole {
  READ = 'read',
  MANAGER = 'manager', 
  ADMIN = 'admin'
}

// Legacy action types for backward compatibility
export type PermissionAction = 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete' 
  | 'list' 
  | 'execute' 
  | 'manage'
  | 'approve'
  | 'reject'
  | '*';

export type PermissionScope = 
  | 'own' 
  | 'team' 
  | 'department' 
  | 'organization' 
  | 'global'
  | 'none';

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with';
  value: string | string[] | number | boolean;
}

export interface PermissionGroup {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

// Database entity for hierarchy structures
export interface HierarchyStructure {
  id: string;
  name: string;
  code: string;
  description?: string;
  parent_id?: string;
  path: string;
  level: number;
  sort_order: number;
  metadata?: Record<string, any>;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at?: Date;
  is_active: boolean;
  // Calculated fields
  user_count?: number;
  child_count?: number;
}

// Legacy hierarchy interface for backward compatibility
export interface Hierarchy {
  id: string;
  name: string;
  description?: string;
  levels: HierarchyLevel[];
  type: HierarchyType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type HierarchyType = 
  | 'organizational' 
  | 'functional' 
  | 'project' 
  | 'geographic'
  | 'custom';

// Validation and business rule types
export interface PermissionBusinessRule {
  id: string;
  name: string;
  description: string;
  validator: (context: PermissionRuleContext) => Promise<boolean>;
  errorMessage: string;
}

export interface PermissionRuleContext {
  requestingUserId: string;
  targetUserId?: string;
  hierarchyId?: string;
  role?: PermissionRole;
  action: 'grant' | 'revoke' | 'update' | 'access';
  currentPermissions: Permission[];
  hierarchyStructure: HierarchyStructure;
}

// Audit and logging types
export interface PermissionAuditLog {
  id: string;
  permission_id?: string;
  user_id: string;
  hierarchy_id?: string;
  action: 'granted' | 'revoked' | 'updated' | 'accessed' | 'denied';
  details: Record<string, any>;
  performed_by: string;
  performed_at: Date;
  ip_address?: string;
  user_agent?: string;
}

export interface HierarchyLevel {
  id: string;
  hierarchyId: string;
  name: string;
  level: number;
  parentId?: string;
  children: HierarchyLevel[];
  users: User[];
  permissions: Permission[];
  metadata?: Record<string, any>;
}

export interface HierarchyNode {
  id: string;
  name: string;
  level: number;
  parentId?: string;
  children: HierarchyNode[];
  userCount: number;
  permissionCount: number;
  isExpanded?: boolean;
}

export interface PermissionCheck {
  userId: string;
  resource: string;
  action: PermissionAction;
  scope?: PermissionScope;
  context?: Record<string, any>;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  matchedPermissions: Permission[];
  hierarchyPath?: HierarchyLevel[];
}

// Enhanced permission result for new system
export interface PermissionCheckResult {
  isValid: boolean;
  canAccess: boolean;
  accessLevel?: 'direct' | 'inherited';
  effectiveRole?: PermissionRole;
  reason?: string;
  hierarchy?: HierarchyStructure;
  permissions?: Permission[];
}

export interface CreatePermissionRequest {
  name: string;
  description?: string;
  resource: string;
  action: PermissionAction;
  scope: PermissionScope;
  conditions?: PermissionCondition[];
}

export interface UpdatePermissionRequest {
  name?: string;
  description?: string;
  resource?: string;
  action?: PermissionAction;
  scope?: PermissionScope;
  conditions?: PermissionCondition[];
}

export interface CreateHierarchyRequest {
  name: string;
  description?: string;
  type: HierarchyType;
  levels: Omit<HierarchyLevel, 'id' | 'hierarchyId' | 'children' | 'users' | 'permissions'>[];
}

export interface UpdateHierarchyRequest {
  name?: string;
  description?: string;
  type?: HierarchyType;
  isActive?: boolean;
}

// Access scope calculation utilities
export interface AccessScope {
  hierarchyId: string;
  hierarchyPath: string;
  hierarchyName: string;
  accessLevel: 'direct' | 'inherited';
  permissionSource: 'direct' | 'role';
  inheritToDescendants: boolean;
  descendantPaths: string[];
}

export interface PathAncestry {
  nodeId: string;
  path: string;
  ancestors: Array<{
    id: string;
    name: string;
    path: string;
    level: number;
  }>;
  descendants: Array<{
    id: string;
    name: string;
    path: string;
    level: number;
  }>;
}