/**
 * Validation schemas and types for the hierarchical permission system
 * Shared between frontend and backend for consistency
 */

// Re-export all validation types from server validation schemas
// These types are automatically inferred from Zod schemas

// Authentication validation types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  base_hierarchy_id: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
  confirm_password: string;
}

export interface VerifyPasswordRequest {
  password: string;
}

export interface UserIdParam {
  userId: string;
}

export interface TokenRequest {
  token: string;
}

// User validation types
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

export interface UserIdsRequest {
  user_ids: string[];
}

export interface QueryUsersRequest {
  page?: number;
  limit?: number;
  search?: string;
  hierarchy_id?: string;
  is_active?: boolean;
  created_after?: Date;
  created_before?: Date;
  sort_by?: 'full_name' | 'email' | 'created_at' | 'hierarchy_path';
  sort_order?: 'asc' | 'desc';
  include_hierarchy?: boolean;
  include_permissions?: boolean;
}

export interface ChangeUserHierarchyRequest {
  new_hierarchy_id: string;
}

export interface BulkUserOperationRequest {
  user_ids: string[];
  operation: 'activate' | 'deactivate' | 'delete';
  reason?: string;
}

export interface UserActivityQueryRequest {
  user_id?: string;
  action?: 'login' | 'logout' | 'password_change' | 'profile_update' | 'permission_granted' | 'permission_revoked';
  from_date?: Date;
  to_date?: Date;
  page?: number;
  limit?: number;
}

export interface UpdateUserProfileRequest {
  full_name?: string;
  phone?: string;
  metadata?: {
    bio?: string;
    department?: string;
    position?: string;
    timezone?: string;
    preferences?: Record<string, any>;
  };
}

// Permission validation types
export interface GrantPermissionRequest {
  user_id: string;
  hierarchy_id: string;
  role: 'read' | 'manager' | 'admin';
  inherit_to_descendants?: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

export interface UpdatePermissionRequest {
  role?: 'read' | 'manager' | 'admin';
  inherit_to_descendants?: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
  is_active?: boolean;
}

export interface PermissionIdParam {
  id: string;
}

export interface UserPermissionsQuery {
  user_id: string;
  include_expired?: boolean;
  include_inactive?: boolean;
  hierarchy_id?: string;
}

export interface PermissionAccessCheck {
  requesting_user_id: string;
  target_user_id?: string;
  target_hierarchy_id?: string;
}

export interface UserAccessScopeQuery {
  user_id: string;
  include_statistics?: boolean;
}

export interface AccessibleUsersQuery {
  search?: string;
  hierarchy_id?: string;
  role?: 'read' | 'manager' | 'admin';
  is_active?: boolean;
  include_descendants?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'email' | 'hierarchy_path' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface BulkPermissionOperation {
  user_ids: string[];
  hierarchy_id: string;
  operation: 'grant' | 'revoke';
  role?: 'read' | 'manager' | 'admin';
  inherit_to_descendants?: boolean;
  reason?: string;
}

export interface PermissionAuditQuery {
  user_id?: string;
  hierarchy_id?: string;
  permission_id?: string;
  action?: 'granted' | 'revoked' | 'updated' | 'accessed' | 'denied';
  performed_by?: string;
  from_date?: Date;
  to_date?: Date;
  page?: number;
  limit?: number;
}

export interface PermissionValidationRule {
  rule_name: string;
  rule_type: 'hierarchy_level' | 'role_hierarchy' | 'time_restriction' | 'resource_limit';
  parameters: Record<string, any>;
  is_active?: boolean;
}

// Hierarchy validation types
export interface CreateStructureRequest {
  name: string;
  code: string;
  description?: string;
  parent_id?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
}

export interface UpdateStructureRequest {
  name?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface StructureIdParam {
  id: string;
}

export interface MoveStructureRequest {
  new_parent_id?: string;
  reason?: string;
}

export interface HierarchyTreeQuery {
  root_id?: string;
  max_depth?: number;
  include_user_counts?: boolean;
  include_inactive?: boolean;
  expand_all?: boolean;
}

export interface HierarchySearchQuery {
  search?: string;
  level?: number;
  parent_id?: string;
  is_active?: boolean;
  has_children?: boolean;
  min_user_count?: number;
  max_user_count?: number;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'code' | 'level' | 'created_at' | 'sort_order' | 'user_count';
  sort_order?: 'asc' | 'desc';
}

export interface HierarchyStatsQuery {
  include_user_distribution?: boolean;
  include_depth_analysis?: boolean;
  include_integrity_check?: boolean;
}

export interface HierarchyValidationRequest {
  fix_issues?: boolean;
  detailed_report?: boolean;
}

export interface BulkHierarchyOperation {
  structure_ids: string[];
  operation: 'activate' | 'deactivate' | 'delete';
  reason?: string;
  cascade?: boolean;
}

export interface HierarchyPathQuery {
  path: string;
  include_ancestors?: boolean;
  include_descendants?: boolean;
  max_depth?: number;
}

// Query validation types
export interface QueryAccessibleUsersRequest {
  search?: string;
  hierarchy_id?: string;
  role?: 'read' | 'manager' | 'admin';
  is_active?: boolean;
  include_descendants?: boolean;
  require_permission?: 'read' | 'manager' | 'admin';
  exclude_self?: boolean;
  hierarchy_levels?: number[];
  created_after?: Date;
  created_before?: Date;
  last_login_after?: Date;
  last_login_before?: Date;
  include_inactive_hierarchies?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'email' | 'hierarchy_path' | 'created_at' | 'last_login_at';
  sort_order?: 'asc' | 'desc';
}

export interface UserStatsQuery {
  hierarchy_id?: string;
  include_descendants?: boolean;
  include_hierarchy_breakdown?: boolean;
  include_role_distribution?: boolean;
  include_activity_metrics?: boolean;
  date_range_days?: number;
}

export interface BulkUserQuery {
  user_ids: string[];
  include_permissions?: boolean;
  include_hierarchy_details?: boolean;
  include_activity?: boolean;
}

export interface UserAutocompleteQuery {
  search: string;
  limit?: number;
  hierarchy_id?: string;
  exclude_inactive?: boolean;
}

export interface AnalyticsQuery {
  metric_type: 'user_distribution' | 'permission_usage' | 'hierarchy_coverage' | 'activity_trends' | 'access_patterns';
  time_period?: '24h' | '7d' | '30d' | '90d' | '1y';
  hierarchy_id?: string;
  group_by?: 'hierarchy' | 'role' | 'date' | 'hour';
  include_comparisons?: boolean;
}

export interface ExportQuery {
  format?: 'csv' | 'json' | 'xlsx';
  include_headers?: boolean;
  fields?: string[];
  max_records?: number;
  search?: string;
  hierarchy_id?: string;
  role?: 'read' | 'manager' | 'admin';
  is_active?: boolean;
  include_descendants?: boolean;
  require_permission?: 'read' | 'manager' | 'admin';
  exclude_self?: boolean;
  hierarchy_levels?: number[];
  created_after?: Date;
  created_before?: Date;
  last_login_after?: Date;
  last_login_before?: Date;
  include_inactive_hierarchies?: boolean;
  sort_by?: 'name' | 'email' | 'hierarchy_path' | 'created_at' | 'last_login_at';
  sort_order?: 'asc' | 'desc';
}

export interface AdvancedSearch {
  query: string;
  search_fields?: ('name' | 'email' | 'hierarchy_name' | 'metadata')[];
  filters?: {
    hierarchy_ids?: string[];
    roles?: ('read' | 'manager' | 'admin')[];
    is_active?: boolean;
    date_ranges?: {
      created?: {
        from?: Date;
        to?: Date;
      };
      last_login?: {
        from?: Date;
        to?: Date;
      };
    };
  };
  boost_fields?: Record<string, number>;
  fuzzy_search?: boolean;
  highlight?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'email' | 'hierarchy_path' | 'created_at' | 'last_login_at';
  sort_order?: 'asc' | 'desc';
}

export interface QueryPerformance {
  query_id?: string;
  track_performance?: boolean;
  explain?: boolean;
}

// Validation error types
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: string;
}

export interface ValidationError {
  message: string;
  code: string;
  statusCode: number;
  details?: {
    target?: string;
    errors?: ValidationErrorDetail[];
    errorCount?: number;
  };
}

// Password requirements
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfoInPassword: boolean;
}

// Validation utilities types
export interface ValidationUtils {
  isValidEmail: (email: string) => boolean;
  isValidUUID: (id: string) => boolean;
  isValidPassword: (password: string) => boolean;
  sanitizeSearchTerm: (term: string) => string;
  normalizeEmail: (email: string) => string;
  getPasswordStrength: (password: string) => number;
  validateDateRange: (start: Date, end: Date) => boolean;
}

// Form validation states
export type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

export interface FieldValidation {
  state: ValidationState;
  message?: string;
  code?: string;
}

export interface FormValidation {
  isValid: boolean;
  isValidating: boolean;
  fields: Record<string, FieldValidation>;
  errors: ValidationErrorDetail[];
}

// API validation response
export interface ValidationResponse {
  success: boolean;
  errors?: ValidationErrorDetail[];
  warnings?: ValidationErrorDetail[];
  data?: any;
}

// Client-side validation configuration
export interface ClientValidationConfig {
  realTimeValidation: boolean;
  debounceMs: number;
  showErrorsOnSubmit: boolean;
  showWarnings: boolean;
  validateOnBlur: boolean;
  validateOnChange: boolean;
}

// Validation schema metadata
export interface ValidationSchema {
  name: string;
  version: string;
  description?: string;
  fields: Record<string, {
    type: string;
    required: boolean;
    constraints?: Record<string, any>;
    description?: string;
  }>;
}

// Export validation constants
export const ValidationConstants = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 72,
  EMAIL_MAX_LENGTH: 254,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  SEARCH_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  CODE_MAX_LENGTH: 50,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  LTREE_CODE_REGEX: /^[a-zA-Z0-9_]+$/,
  LTREE_PATH_REGEX: /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/,
  MAX_HIERARCHY_DEPTH: 20,
  MAX_BULK_OPERATIONS: 50,
  MAX_QUERY_LIMIT: 100,
  MAX_EXPORT_RECORDS: 50000,
  PAGINATION_DEFAULTS: {
    page: 1,
    limit: 20,
    maxLimit: 100
  },
  RESERVED_CODES: ['admin', 'root', 'system', 'api', 'null', 'undefined'],
  PERMISSION_ROLES: ['read', 'manager', 'admin'] as const,
  SORT_ORDERS: ['asc', 'desc'] as const
} as const;

// Type guards for runtime validation
export const ValidationTypeGuards = {
  isValidEmail: (value: unknown): value is string => {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },

  isValidUUID: (value: unknown): value is string => {
    return typeof value === 'string' && ValidationConstants.UUID_REGEX.test(value);
  },

  isPermissionRole: (value: unknown): value is 'read' | 'manager' | 'admin' => {
    return typeof value === 'string' && ValidationConstants.PERMISSION_ROLES.includes(value as any);
  },

  isSortOrder: (value: unknown): value is 'asc' | 'desc' => {
    return typeof value === 'string' && ValidationConstants.SORT_ORDERS.includes(value as any);
  },

  isValidDate: (value: unknown): value is Date => {
    return value instanceof Date && !isNaN(value.getTime());
  },

  isValidDateString: (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  isPositiveInteger: (value: unknown): value is number => {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  },

  isNonNegativeInteger: (value: unknown): value is number => {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }
};