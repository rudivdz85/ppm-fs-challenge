export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: Record<string, any>;
    stack?: string;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  filters?: Record<string, any>;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export interface ListParams extends PaginationParams, FilterParams {}

export interface AuthRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponseLegacy {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface HealthCheckResponse {
  status: 'OK' | 'ERROR';
  message: string;
  timestamp: string;
  version?: string;
  uptime?: number;
  checks?: {
    database?: HealthStatus;
    redis?: HealthStatus;
    external_apis?: HealthStatus;
  };
}

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  responseTime?: number;
  message?: string;
}

export interface FileUploadResponse {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

export interface FileUploadRequest {
  file: File;
  folder?: string;
  isPublic?: boolean;
}

export interface BulkOperation<T> {
  items: T[];
  operation: 'create' | 'update' | 'delete';
}

export interface BulkOperationResponse<T> {
  successful: T[];
  failed: BulkOperationError[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface BulkOperationError {
  item: any;
  error: string;
  index: number;
}

export interface SearchRequest {
  query: string;
  filters?: Record<string, any>;
  facets?: string[];
  highlight?: boolean;
  pagination?: PaginationParams;
}

export interface SearchResponse<T> {
  results: SearchResult<T>[];
  facets?: SearchFacet[];
  pagination: PaginationMeta;
  searchTime: number;
  totalResults: number;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  highlights?: Record<string, string[]>;
}

export interface SearchFacet {
  field: string;
  values: SearchFacetValue[];
}

export interface SearchFacetValue {
  value: string;
  count: number;
  selected?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiValidationError extends ApiError {
  error: {
    message: string;
    code: 'VALIDATION_ERROR';
    details: {
      validationErrors: ValidationError[];
    };
  };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// Service DTOs for hierarchical permission system
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  timestamp: string;
}

export interface ServiceError {
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, any>;
  stack?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Authentication DTOs
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  expires_at: Date;
  refresh_token?: string;
}

export interface TokenPayload {
  user_id: string;
  email: string;
  hierarchy_id: string;
  hierarchy_path?: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: TokenPayload;
  error?: string;
}

export interface PasswordValidationRequest {
  user_id: string;
  password: string;
}

// User management DTOs
export interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  base_hierarchy_id: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface UpdateUserRequest {
  email?: string;
  full_name?: string;
  phone?: string;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface UserSearchFilters {
  search?: string;
  hierarchy_id?: string;
  is_active?: boolean;
  created_after?: Date;
  created_before?: Date;
  page?: number;
  limit?: number;
  sort_by?: 'full_name' | 'email' | 'created_at' | 'hierarchy_path';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedUserResult extends PaginatedResult<User> {
  filters_applied: UserSearchFilters;
}

// Hierarchy management DTOs
export interface CreateStructureRequest {
  name: string;
  code: string;
  parent_id?: string;
  description?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
}

export interface UpdateStructureRequest {
  name?: string;
  code?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface HierarchyTreeNode {
  id: string;
  name: string;
  code: string;
  path: string;
  level: number;
  parent_id: string | null;
  sort_order: number;
  metadata: Record<string, any>;
  children: HierarchyTreeNode[];
  userCount?: number;
  totalUserCount?: number;
  isExpanded?: boolean;
}

export interface HierarchyValidationResult {
  isValid: boolean;
  issues: Array<{
    type: 'orphaned' | 'level_mismatch' | 'path_mismatch' | 'circular_reference';
    nodeId: string;
    nodeName: string;
    description: string;
  }>;
  statistics: {
    totalNodes: number;
    maxDepth: number;
    nodesByLevel: Record<number, number>;
    rootNodes: number;
    leafNodes: number;
  };
}

// Permission management DTOs
export interface GrantPermissionRequest {
  user_id: string;
  hierarchy_id: string;
  role: PermissionRole;
  inherit_to_descendants?: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface UpdatePermissionRequest {
  role?: PermissionRole;
  inherit_to_descendants?: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
  is_active?: boolean;
}

export interface UserAccessFilters {
  search?: string;
  hierarchy_id?: string;
  role?: PermissionRole;
  is_active?: boolean;
  include_descendants?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'email' | 'hierarchy_path' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface UserWithAccessContext extends Omit<User, 'password_hash'> {
  access_level: 'direct' | 'inherited';
  permission_source: 'direct' | 'role';
  user_hierarchy_path: string;
  user_hierarchy_name: string;
  accessible_through: string[];
}

export interface UserAccessScope {
  user_id: string;
  accessible_hierarchy_ids: string[];
  accessible_hierarchy_paths: string[];
  total_accessible_users: number;
  direct_permissions: Array<{
    hierarchy_id: string;
    hierarchy_path: string;
    hierarchy_name: string;
    role: PermissionRole;
    inherit_to_descendants: boolean;
  }>;
  inherited_permissions: Array<{
    hierarchy_id: string;
    hierarchy_path: string;
    hierarchy_name: string;
    source_hierarchy: string;
    effective_role: PermissionRole;
  }>;
}

export interface PermissionValidationResult {
  isValid: boolean;
  canAccess: boolean;
  accessLevel?: 'direct' | 'inherited';
  effectiveRole?: PermissionRole;
  reason?: string;
}

// Query service DTOs
export interface QueryFilters extends UserAccessFilters {
  require_permission?: PermissionRole;
  exclude_self?: boolean;
  hierarchy_levels?: number[];
  created_after?: Date;
  created_before?: Date;
  last_login_after?: Date;
  last_login_before?: Date;
  include_inactive_hierarchies?: boolean;
}

export interface QueryResult extends PaginatedResult<UserWithAccessContext> {
  analytics: {
    total_by_hierarchy: Record<string, number>;
    total_by_role: Record<string, number>;
    total_by_access_level: Record<string, number>;
    hierarchy_coverage: Array<{
      hierarchy_id: string;
      hierarchy_name: string;
      hierarchy_path: string;
      user_count: number;
      percentage: number;
    }>;
  };
  requestor_context: {
    user_id: string;
    accessible_hierarchies: number;
    total_accessible_users: number;
    query_performance: {
      execution_time_ms: number;
      cache_hit?: boolean;
    };
  };
}

export interface StatsRequest {
  user_id: string;
  hierarchy_id?: string;
  include_descendants?: boolean;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  by_hierarchy: Array<{
    hierarchy_id: string;
    hierarchy_name: string;
    hierarchy_path: string;
    user_count: number;
    active_count: number;
    percentage_of_total: number;
  }>;
  by_role: Record<PermissionRole, number>;
  recent_activity: {
    new_users_last_30_days: number;
    logins_last_30_days: number;
    permission_changes_last_30_days: number;
  };
}

export interface BulkUserQuery {
  user_ids: string[];
  include_permissions?: boolean;
  include_hierarchy_details?: boolean;
}

// Re-export types from other modules for convenience
export type { User, UserRole, CreateUserRequest as CreateUserRequestLegacy, UpdateUserRequest as UpdateUserRequestLegacy } from './user.types';
export type { Permission, PermissionRole, HierarchyStructure, PermissionAction, PermissionScope } from './permission.types';