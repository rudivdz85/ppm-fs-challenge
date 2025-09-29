export interface Permission {
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