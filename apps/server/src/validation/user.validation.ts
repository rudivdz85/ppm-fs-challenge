/**
 * User validation schemas
 * Validates user creation, updates, and queries
 */

import { z } from 'zod';

/**
 * Email validation schema with normalization
 */
const emailSchema = z
  .string()
  .email('Must be a valid email address')
  .max(254, 'Email cannot exceed 254 characters')
  .transform(email => email.toLowerCase().trim());

/**
 * Full name validation schema
 */
const fullNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters long')
  .max(100, 'Name cannot exceed 100 characters')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .transform(name => name.trim().replace(/\s+/g, ' '));

/**
 * Phone number validation schema (flexible format)
 */
const phoneSchema = z
  .string()
  .min(1, 'Phone number cannot be empty')
  .max(20, 'Phone number cannot exceed 20 characters')
  .optional();

/**
 * UUID validation schema
 */
const uuidSchema = z
  .string()
  .uuid('Must be a valid UUID');

/**
 * Password validation schema (simplified)
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(72, 'Password cannot exceed 72 characters');

/**
 * Metadata validation schema
 */
const metadataSchema = z
  .record(z.any())
  .optional();

/**
 * Search term validation schema
 */
const searchSchema = z
  .string()
  .max(100, 'Search term cannot exceed 100 characters')
  .transform(term => term.trim())
  .optional();

/**
 * Create user request validation schema
 */
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: fullNameSchema,
  base_hierarchy_id: uuidSchema,
  phone: phoneSchema,
  metadata: metadataSchema
});

/**
 * Update user request validation schema
 */
export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  full_name: fullNameSchema.optional(),
  phone: phoneSchema,
  is_active: z.boolean().optional(),
  metadata: metadataSchema
}).refine(data => {
  // At least one field must be provided for update
  return Object.values(data).some(value => value !== undefined);
}, {
  message: 'At least one field must be provided for update'
});

/**
 * User ID parameter validation schema
 */
export const userIdParamSchema = z.object({
  id: uuidSchema
});

/**
 * Multiple user IDs validation schema
 */
export const userIdsSchema = z.object({
  user_ids: z
    .array(uuidSchema)
    .min(1, 'At least one user ID is required')
    .max(100, 'Cannot query more than 100 users at once')
});

/**
 * User search query parameters validation schema
 */
export const queryUsersSchema = z.object({
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
  
  // Search and filtering
  search: searchSchema,
  
  hierarchy_id: z
    .string()
    .uuid('Hierarchy ID must be a valid UUID')
    .optional(),
  
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
  
  // Date filtering
  created_after: z
    .string()
    .datetime('Must be a valid ISO datetime')
    .transform(val => new Date(val))
    .optional(),
  
  created_before: z
    .string()
    .datetime('Must be a valid ISO datetime')
    .transform(val => new Date(val))
    .optional(),
  
  // Sorting
  sort_by: z
    .enum(['full_name', 'email', 'created_at', 'hierarchy_path', 'is_active'])
    .optional()
    .default('full_name'),
  
  sort_order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('asc'),
  
  // Inclusion options
  include_hierarchy: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional()),
  
  include_permissions: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional())
});

/**
 * Change password request validation schema
 */
export const changePasswordSchema = z.object({
  current_password: z
    .string()
    .min(1, 'Current password is required'),
  new_password: passwordSchema,
  confirm_password: z
    .string()
    .min(1, 'Password confirmation is required')
}).refine(data => data.new_password === data.confirm_password, {
  message: 'New password and confirmation do not match',
  path: ['confirm_password']
});

/**
 * Change user hierarchy request validation schema
 */
export const changeUserHierarchySchema = z.object({
  new_hierarchy_id: uuidSchema
});

/**
 * Bulk user operation validation schema
 */
export const bulkUserOperationSchema = z.object({
  user_ids: z
    .array(uuidSchema)
    .min(1, 'At least one user ID is required')
    .max(50, 'Cannot perform bulk operations on more than 50 users at once'),
  
  operation: z.enum(['activate', 'deactivate', 'delete']),
  
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason cannot exceed 500 characters')
    .optional()
});

/**
 * User activity query validation schema
 */
export const userActivityQuerySchema = z.object({
  user_id: uuidSchema.optional(),
  
  action: z
    .enum(['login', 'logout', 'password_change', 'profile_update', 'permission_granted', 'permission_revoked'])
    .optional(),
  
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
});

/**
 * User profile update validation schema
 */
export const updateUserProfileSchema = z.object({
  full_name: fullNameSchema.optional(),
  phone: phoneSchema,
  metadata: z.object({
    bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional(),
    department: z.string().max(100, 'Department cannot exceed 100 characters').optional(),
    position: z.string().max(100, 'Position cannot exceed 100 characters').optional(),
    timezone: z.string().max(50, 'Timezone cannot exceed 50 characters').optional(),
    preferences: z.record(z.any()).optional()
  }).optional()
});

/**
 * TypeScript types inferred from schemas
 */
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type UserIdsRequest = z.infer<typeof userIdsSchema>;
export type QueryUsersRequest = z.infer<typeof queryUsersSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type ChangeUserHierarchyRequest = z.infer<typeof changeUserHierarchySchema>;
export type BulkUserOperationRequest = z.infer<typeof bulkUserOperationSchema>;
export type UserActivityQueryRequest = z.infer<typeof userActivityQuerySchema>;
export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileSchema>;

/**
 * User validation error messages
 */
export const userValidationMessages = {
  email: {
    required: 'Email address is required',
    invalid: 'Please enter a valid email address',
    duplicate: 'This email address is already registered',
    maxLength: 'Email address is too long'
  },
  fullName: {
    required: 'Full name is required',
    minLength: 'Name must be at least 2 characters long',
    maxLength: 'Name is too long',
    format: 'Name contains invalid characters'
  },
  password: {
    required: 'Password is required',
    minLength: 'Password is too short',
    maxLength: 'Password is too long',
    complexity: 'Password does not meet complexity requirements'
  },
  phone: {
    invalid: 'Please enter a valid phone number',
    format: 'Phone number must be in international format'
  },
  hierarchyId: {
    required: 'Hierarchy ID is required',
    invalid: 'Invalid hierarchy ID format',
    notFound: 'Hierarchy not found'
  },
  search: {
    tooLong: 'Search term is too long'
  },
  pagination: {
    invalidPage: 'Page number must be a positive integer',
    invalidLimit: 'Limit must be between 1 and 100'
  },
  date: {
    invalid: 'Invalid date format',
    range: 'Start date must be before end date'
  }
};

/**
 * User autocomplete search validation schema
 */
export const userAutocompleteSchema = z.object({
  search: z
    .string()
    .min(2, 'Search term must be at least 2 characters')
    .max(100, 'Search term cannot exceed 100 characters')
    .transform(term => term.trim()),
  
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 10)
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(20, 'Limit cannot exceed 20')),
  
  hierarchy_id: z
    .string()
    .uuid('Hierarchy ID must be a valid UUID')
    .optional(),
  
  exclude_inactive: z
    .string()
    .optional()
    .transform(val => val !== 'false')
    .pipe(z.boolean().optional())
});

/**
 * Export aliases for backward compatibility
 */
export const updateProfileSchema = updateUserProfileSchema;

/**
 * User validation utilities
 */
export const userValidationUtils = {
  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    try {
      emailSchema.parse(email);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate UUID format
   */
  isValidUUID: (id: string): boolean => {
    try {
      uuidSchema.parse(id);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Sanitize search term
   */
  sanitizeSearchTerm: (term: string): string => {
    return term.trim().replace(/[<>]/g, '');
  },

  /**
   * Validate phone number
   */
  isValidPhone: (phone: string): boolean => {
    try {
      phoneSchema.parse(phone);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Normalize full name
   */
  normalizeFullName: (name: string): string => {
    return name.trim()
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  },

  /**
   * Validate date range
   */
  isValidDateRange: (startDate: Date, endDate: Date): boolean => {
    return startDate <= endDate;
  },

  /**
   * Get pagination defaults
   */
  getPaginationDefaults: () => ({
    page: 1,
    limit: 20,
    maxLimit: 100
  }),

  /**
   * Validate bulk operation size
   */
  isValidBulkSize: (count: number, maxSize: number = 50): boolean => {
    return count > 0 && count <= maxSize;
  }
};