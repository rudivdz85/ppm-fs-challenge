/**
 * Permission validation schemas
 * Validates permission granting, revoking, and querying
 */

import { z } from 'zod';

/**
 * UUID validation schema
 */
const uuidSchema = z
  .string()
  .uuid('Must be a valid UUID');

/**
 * Permission role validation schema
 */
const permissionRoleSchema = z.enum(['read', 'manager', 'admin'], {
  errorMap: () => ({ message: 'Role must be one of: read, manager, admin' })
});

/**
 * Metadata validation schema
 */
const metadataSchema = z
  .record(z.any())
  .optional();

/**
 * Date validation schema
 */
const dateSchema = z
  .string()
  .datetime('Must be a valid ISO datetime')
  .transform(val => new Date(val));

/**
 * Grant permission request validation schema
 */
export const grantPermissionSchema = z.object({
  user_id: uuidSchema,
  hierarchy_id: uuidSchema,
  role: permissionRoleSchema,
  inherit_to_descendants: z
    .boolean()
    .optional()
    .default(true),
  expires_at: dateSchema.optional(),
  metadata: metadataSchema
}).refine(data => {
  // If expires_at is provided, it must be in the future
  if (data.expires_at && data.expires_at <= new Date()) {
    return false;
  }
  return true;
}, {
  message: 'Expiration date must be in the future',
  path: ['expires_at']
});

/**
 * Update permission request validation schema
 */
export const updatePermissionSchema = z.object({
  role: permissionRoleSchema.optional(),
  inherit_to_descendants: z.boolean().optional(),
  expires_at: dateSchema.optional(),
  metadata: metadataSchema,
  is_active: z.boolean().optional()
}).refine(data => {
  // At least one field must be provided for update
  return Object.values(data).some(value => value !== undefined);
}, {
  message: 'At least one field must be provided for update'
}).refine(data => {
  // If expires_at is provided, it must be in the future
  if (data.expires_at && data.expires_at <= new Date()) {
    return false;
  }
  return true;
}, {
  message: 'Expiration date must be in the future',
  path: ['expires_at']
});

/**
 * Permission ID parameter validation schema
 */
export const permissionIdParamSchema = z.object({
  id: uuidSchema
});

/**
 * User ID parameter validation schema
 */
export const userIdParamSchema = z.object({
  userId: uuidSchema
});

/**
 * Check user access schema
 */
export const checkUserAccessSchema = z.object({
  user_id: uuidSchema,
  hierarchy_id: uuidSchema,
  required_role: permissionRoleSchema.optional()
});

/**
 * Check structure access schema
 */
export const checkStructureAccessSchema = z.object({
  hierarchy_id: uuidSchema,
  required_role: permissionRoleSchema.optional()
});

/**
 * User permissions query validation schema
 */
export const userPermissionsQuerySchema = z.object({
  user_id: uuidSchema,
  include_expired: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  include_inactive: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  hierarchy_id: uuidSchema.optional()
});

/**
 * Permission access check validation schema
 */
export const permissionAccessCheckSchema = z.object({
  requesting_user_id: uuidSchema,
  target_user_id: uuidSchema.optional(),
  target_hierarchy_id: uuidSchema.optional()
}).refine(data => {
  // Must specify either target_user_id or target_hierarchy_id, but not both
  const hasTargetUser = !!data.target_user_id;
  const hasTargetHierarchy = !!data.target_hierarchy_id;
  return hasTargetUser !== hasTargetHierarchy; // XOR
}, {
  message: 'Must specify either target_user_id or target_hierarchy_id, but not both'
});

/**
 * User access scope query validation schema
 */
export const userAccessScopeQuerySchema = z.object({
  user_id: uuidSchema,
  include_statistics: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false))
});

/**
 * Accessible users query validation schema
 */
export const accessibleUsersQuerySchema = z.object({
  // Core filters
  search: z
    .string()
    .max(100, 'Search term cannot exceed 100 characters')
    .transform(term => term.trim())
    .optional(),
  
  hierarchy_id: uuidSchema.optional(),
  
  role: permissionRoleSchema.optional(),
  
  is_active: z
    .string()
    .optional()
    .transform(val => {
      if (val === undefined) return undefined;
      if (val === 'true') return true;
      if (val === 'false') return false;
      throw new Error('Must be "true" or "false"');
    })
    .pipe(z.boolean().optional()),
  
  include_descendants: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  // Pagination
  page: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .pipe(z.number().int().min(1, 'Page must be at least 1')),
  
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')),
  
  // Sorting
  sort_by: z
    .enum(['name', 'email', 'hierarchy_path', 'created_at'])
    .optional()
    .default('name'),
  
  sort_order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('asc')
});

/**
 * Bulk permission operation validation schema
 */
export const bulkPermissionOperationSchema = z.object({
  user_ids: z
    .array(uuidSchema)
    .min(1, 'At least one user ID is required')
    .max(50, 'Cannot perform bulk operations on more than 50 users at once'),
  
  hierarchy_id: uuidSchema,
  
  operation: z.enum(['grant', 'revoke']),
  
  role: permissionRoleSchema.optional(),
  
  inherit_to_descendants: z.boolean().optional().default(true),
  
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason cannot exceed 500 characters')
    .optional()
}).refine(data => {
  // If operation is 'grant', role must be provided
  if (data.operation === 'grant' && !data.role) {
    return false;
  }
  return true;
}, {
  message: 'Role is required when granting permissions',
  path: ['role']
});

/**
 * Permission audit log query validation schema
 */
export const permissionAuditQuerySchema = z.object({
  user_id: uuidSchema.optional(),
  hierarchy_id: uuidSchema.optional(),
  permission_id: uuidSchema.optional(),
  
  action: z
    .enum(['granted', 'revoked', 'updated', 'accessed', 'denied'])
    .optional(),
  
  performed_by: uuidSchema.optional(),
  
  from_date: z
    .string()
    .datetime('Must be a valid ISO datetime')
    .transform(val => new Date(val))
    .optional(),
  
  to_date: z
    .string()
    .datetime('Must be a valid ISO datetime')
    .transform(val => new Date(val))
    .optional(),
  
  page: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .pipe(z.number().int().min(1)),
  
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .pipe(z.number().int().min(1).max(100))
}).refine(data => {
  // If both dates are provided, from_date must be before to_date
  if (data.from_date && data.to_date && data.from_date >= data.to_date) {
    return false;
  }
  return true;
}, {
  message: 'From date must be before to date'
});

/**
 * Permission validation rules schema
 */
export const permissionValidationRuleSchema = z.object({
  rule_name: z
    .string()
    .min(1, 'Rule name is required')
    .max(100, 'Rule name cannot exceed 100 characters'),
  
  rule_type: z.enum(['hierarchy_level', 'role_hierarchy', 'time_restriction', 'resource_limit']),
  
  parameters: z.record(z.any()),
  
  is_active: z.boolean().optional().default(true)
});

/**
 * TypeScript types inferred from schemas
 */
export type GrantPermissionRequest = z.infer<typeof grantPermissionSchema>;
export type UpdatePermissionRequest = z.infer<typeof updatePermissionSchema>;
export type PermissionIdParam = z.infer<typeof permissionIdParamSchema>;
export type UserPermissionsQuery = z.infer<typeof userPermissionsQuerySchema>;
export type PermissionAccessCheck = z.infer<typeof permissionAccessCheckSchema>;
export type UserAccessScopeQuery = z.infer<typeof userAccessScopeQuerySchema>;
export type AccessibleUsersQuery = z.infer<typeof accessibleUsersQuerySchema>;
export type BulkPermissionOperation = z.infer<typeof bulkPermissionOperationSchema>;
export type PermissionAuditQuery = z.infer<typeof permissionAuditQuerySchema>;
export type PermissionValidationRule = z.infer<typeof permissionValidationRuleSchema>;

/**
 * Permission validation error messages
 */
export const permissionValidationMessages = {
  userId: {
    required: 'User ID is required',
    invalid: 'User ID must be a valid UUID'
  },
  hierarchyId: {
    required: 'Hierarchy ID is required',
    invalid: 'Hierarchy ID must be a valid UUID'
  },
  role: {
    required: 'Role is required',
    invalid: 'Role must be one of: read, manager, admin'
  },
  expiresAt: {
    invalid: 'Expiration date must be a valid date',
    past: 'Expiration date must be in the future'
  },
  inheritance: {
    invalid: 'Inheritance setting must be true or false'
  },
  search: {
    tooLong: 'Search term cannot exceed 100 characters'
  },
  pagination: {
    invalidPage: 'Page must be a positive integer',
    invalidLimit: 'Limit must be between 1 and 100'
  },
  dateRange: {
    invalid: 'Date range is invalid',
    reversed: 'Start date must be before end date'
  },
  bulkOperation: {
    tooMany: 'Cannot perform bulk operations on more than 50 users',
    empty: 'At least one user must be specified',
    roleRequired: 'Role is required when granting permissions'
  }
};

/**
 * Permission validation utilities
 */
export const permissionValidationUtils = {
  /**
   * Validate permission role
   */
  isValidRole: (role: string): boolean => {
    return ['read', 'manager', 'admin'].includes(role);
  },

  /**
   * Check if role hierarchy is valid (higher roles can grant lower roles)
   */
  canGrantRole: (granterRole: string, targetRole: string): boolean => {
    const roleHierarchy = { 'read': 1, 'manager': 2, 'admin': 3 };
    const granterLevel = roleHierarchy[granterRole as keyof typeof roleHierarchy] || 0;
    const targetLevel = roleHierarchy[targetRole as keyof typeof roleHierarchy] || 0;
    
    return granterLevel >= targetLevel && granterLevel > 1; // Only manager+ can grant
  },

  /**
   * Validate expiration date
   */
  isValidExpiration: (date: Date): boolean => {
    return date > new Date();
  },

  /**
   * Check if bulk operation size is valid
   */
  isValidBulkSize: (count: number): boolean => {
    return count > 0 && count <= 50;
  },

  /**
   * Validate date range
   */
  isValidDateRange: (from: Date, to: Date): boolean => {
    return from < to;
  },

  /**
   * Get role hierarchy level
   */
  getRoleLevel: (role: string): number => {
    const levels = { 'read': 1, 'manager': 2, 'admin': 3 };
    return levels[role as keyof typeof levels] || 0;
  },

  /**
   * Check if user can access hierarchy level
   */
  canAccessHierarchyLevel: (userRole: string, targetLevel: number): boolean => {
    const userLevel = permissionValidationUtils.getRoleLevel(userRole);
    return userLevel >= 2; // Manager or Admin
  },

  /**
   * Sanitize search term for permission queries
   */
  sanitizeSearchTerm: (term: string): string => {
    return term.trim().replace(/[<>'"]/g, '');
  },

  /**
   * Validate permission metadata
   */
  isValidMetadata: (metadata: any): boolean => {
    try {
      JSON.stringify(metadata);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get default permission settings
   */
  getDefaultPermissionSettings: () => ({
    inherit_to_descendants: true,
    is_active: true,
    role: 'read' as const
  }),

  /**
   * Calculate permission effective date range
   */
  getEffectiveDateRange: (grantedAt: Date, expiresAt?: Date) => {
    const now = new Date();
    return {
      isActive: now >= grantedAt && (!expiresAt || now <= expiresAt),
      daysUntilExpiry: expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
    };
  }
};