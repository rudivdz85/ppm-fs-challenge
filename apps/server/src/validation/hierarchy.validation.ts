/**
 * Hierarchy validation schemas
 * Validates hierarchy structure creation, updates, and queries
 */

import { z } from 'zod';

/**
 * UUID validation schema
 */
const uuidSchema = z
  .string()
  .uuid('Must be a valid UUID');

/**
 * Hierarchy name validation schema
 * Supports letters, numbers, spaces, hyphens, and underscores
 */
const hierarchyNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters long')
  .max(100, 'Name cannot exceed 100 characters')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores')
  .transform(name => name.trim());

/**
 * Hierarchy code validation schema
 * Must be ltree compatible: letters, numbers, underscores only
 */
const hierarchyCodeSchema = z
  .string()
  .min(1, 'Code is required')
  .max(50, 'Code cannot exceed 50 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Code can only contain letters, numbers, and underscores')
  .transform(code => code.toLowerCase());

/**
 * Description validation schema
 */
const descriptionSchema = z
  .string()
  .max(500, 'Description cannot exceed 500 characters')
  .optional();

/**
 * Sort order validation schema
 */
const sortOrderSchema = z
  .number()
  .int('Sort order must be an integer')
  .min(0, 'Sort order must be non-negative')
  .max(9999, 'Sort order cannot exceed 9999')
  .optional()
  .default(0);

/**
 * Metadata validation schema
 */
const metadataSchema = z
  .record(z.any())
  .optional();

/**
 * Create hierarchy structure validation schema
 */
export const createStructureSchema = z.object({
  name: hierarchyNameSchema,
  code: hierarchyCodeSchema,
  description: descriptionSchema,
  parent_id: uuidSchema.optional(),
  sort_order: sortOrderSchema,
  metadata: metadataSchema
}).refine(data => {
  // Code should not contain reserved words
  const reservedWords = ['admin', 'root', 'system', 'api', 'null', 'undefined'];
  return !reservedWords.includes(data.code.toLowerCase());
}, {
  message: 'Code cannot be a reserved word',
  path: ['code']
});

/**
 * Update hierarchy structure validation schema
 */
export const updateStructureSchema = z.object({
  name: hierarchyNameSchema.optional(),
  description: descriptionSchema,
  sort_order: sortOrderSchema.optional(),
  is_active: z.boolean().optional(),
  metadata: metadataSchema
}).refine(data => {
  // At least one field must be provided for update
  return Object.values(data).some(value => value !== undefined);
}, {
  message: 'At least one field must be provided for update'
});

/**
 * Structure ID parameter validation schema
 */
export const structureIdParamSchema = z.object({
  id: uuidSchema
});

/**
 * Move structure validation schema
 */
export const moveStructureSchema = z.object({
  new_parent_id: uuidSchema.optional(), // null for moving to root level
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason cannot exceed 500 characters')
    .optional()
});

/**
 * Hierarchy tree query validation schema
 */
export const hierarchyTreeQuerySchema = z.object({
  root_id: uuidSchema.optional(),
  
  max_depth: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .pipe(z.number().int().min(1, 'Max depth must be at least 1').max(10, 'Max depth cannot exceed 10').optional()),
  
  include_user_counts: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  include_inactive: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  expand_all: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false))
});

/**
 * Hierarchy path validation schema
 */
export const hierarchyPathSchema = z
  .string()
  .min(1, 'Path cannot be empty')
  .max(1000, 'Path is too long')
  .regex(/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/, 'Path format is invalid');

/**
 * Hierarchy search query validation schema
 */
export const hierarchySearchQuerySchema = z.object({
  search: z
    .string()
    .max(100, 'Search term cannot exceed 100 characters')
    .transform(term => term.trim())
    .optional(),
  
  level: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .pipe(z.number().int().min(0, 'Level must be non-negative').max(20, 'Level cannot exceed 20').optional()),
  
  parent_id: uuidSchema.optional(),
  
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
  
  has_children: z
    .string()
    .optional()
    .transform(val => {
      if (val === undefined) return undefined;
      if (val === 'true') return true;
      if (val === 'false') return false;
      throw new Error('Must be "true" or "false"');
    })
    .pipe(z.boolean().optional()),
  
  min_user_count: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .pipe(z.number().int().min(0).optional()),
  
  max_user_count: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .pipe(z.number().int().min(0).optional()),
  
  page: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .pipe(z.number().int().min(1)),
  
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .pipe(z.number().int().min(1).max(100)),
  
  sort_by: z
    .enum(['name', 'code', 'level', 'created_at', 'sort_order', 'user_count'])
    .optional()
    .default('sort_order'),
  
  sort_order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('asc')
});

/**
 * Hierarchy statistics query validation schema
 */
export const hierarchyStatsQuerySchema = z.object({
  include_user_distribution: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(true)),
  
  include_depth_analysis: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(true)),
  
  include_integrity_check: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false))
});

/**
 * Hierarchy validation request schema
 */
export const hierarchyValidationSchema = z.object({
  fix_issues: z
    .boolean()
    .optional()
    .default(false),
  
  detailed_report: z
    .boolean()
    .optional()
    .default(true)
});

/**
 * Bulk hierarchy operation validation schema
 */
export const bulkHierarchyOperationSchema = z.object({
  structure_ids: z
    .array(uuidSchema)
    .min(1, 'At least one structure ID is required')
    .max(20, 'Cannot perform bulk operations on more than 20 structures at once'),
  
  operation: z.enum(['activate', 'deactivate', 'delete']),
  
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason cannot exceed 500 characters')
    .optional(),
  
  cascade: z
    .boolean()
    .optional()
    .default(false)
});

/**
 * Hierarchy path query validation schema
 */
export const hierarchyPathQuerySchema = z.object({
  path: hierarchyPathSchema,
  
  include_ancestors: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  include_descendants: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  max_depth: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .pipe(z.number().int().min(1).max(10).optional())
});

/**
 * TypeScript types inferred from schemas
 */
export type CreateStructureRequest = z.infer<typeof createStructureSchema>;
export type UpdateStructureRequest = z.infer<typeof updateStructureSchema>;
export type StructureIdParam = z.infer<typeof structureIdParamSchema>;
export type MoveStructureRequest = z.infer<typeof moveStructureSchema>;
export type HierarchyTreeQuery = z.infer<typeof hierarchyTreeQuerySchema>;
export type HierarchySearchQuery = z.infer<typeof hierarchySearchQuerySchema>;
export type HierarchyStatsQuery = z.infer<typeof hierarchyStatsQuerySchema>;
export type HierarchyValidationRequest = z.infer<typeof hierarchyValidationSchema>;
export type BulkHierarchyOperation = z.infer<typeof bulkHierarchyOperationSchema>;
export type HierarchyPathQuery = z.infer<typeof hierarchyPathQuerySchema>;

/**
 * Hierarchy validation error messages
 */
export const hierarchyValidationMessages = {
  name: {
    required: 'Hierarchy name is required',
    minLength: 'Name must be at least 2 characters long',
    maxLength: 'Name cannot exceed 100 characters',
    format: 'Name contains invalid characters'
  },
  code: {
    required: 'Hierarchy code is required',
    minLength: 'Code must be at least 1 character',
    maxLength: 'Code cannot exceed 50 characters',
    format: 'Code can only contain letters, numbers, and underscores',
    reserved: 'Code cannot be a reserved word',
    duplicate: 'Code already exists at this level'
  },
  description: {
    maxLength: 'Description cannot exceed 500 characters'
  },
  parentId: {
    invalid: 'Parent ID must be a valid UUID',
    notFound: 'Parent hierarchy not found',
    circular: 'Cannot create circular reference',
    inactive: 'Cannot use inactive hierarchy as parent'
  },
  sortOrder: {
    invalid: 'Sort order must be a non-negative integer',
    range: 'Sort order must be between 0 and 9999'
  },
  path: {
    invalid: 'Hierarchy path format is invalid',
    tooLong: 'Hierarchy path is too long',
    circular: 'Circular reference detected in path'
  },
  level: {
    invalid: 'Level must be a non-negative integer',
    tooDeep: 'Hierarchy is too deep (maximum 20 levels)'
  },
  search: {
    tooLong: 'Search term is too long'
  },
  bulkOperation: {
    tooMany: 'Cannot perform bulk operations on more than 20 structures',
    empty: 'At least one structure must be specified',
    reasonRequired: 'Reason is required for bulk operations'
  }
};

/**
 * Hierarchy validation utilities
 */
export const hierarchyValidationUtils = {
  /**
   * Validate hierarchy code format
   */
  isValidCode: (code: string): boolean => {
    return /^[a-zA-Z0-9_]+$/.test(code) && code.length <= 50;
  },

  /**
   * Check if code is reserved
   */
  isReservedCode: (code: string): boolean => {
    const reservedWords = ['admin', 'root', 'system', 'api', 'null', 'undefined'];
    return reservedWords.includes(code.toLowerCase());
  },

  /**
   * Validate hierarchy path format
   */
  isValidPath: (path: string): boolean => {
    return /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(path);
  },

  /**
   * Calculate hierarchy level from path
   */
  getHierarchyLevel: (path: string): number => {
    return path.split('.').length - 1;
  },

  /**
   * Check if path is valid ltree format
   */
  isValidLtreePath: (path: string): boolean => {
    const segments = path.split('.');
    return segments.every(segment => 
      segment.length > 0 && 
      segment.length <= 50 && 
      /^[a-zA-Z0-9_]+$/.test(segment)
    );
  },

  /**
   * Generate hierarchy code from name
   */
  generateCodeFromName: (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  },

  /**
   * Check if hierarchy can be moved
   */
  canMoveHierarchy: (currentPath: string, newParentPath?: string): boolean => {
    // Cannot move to itself or its descendants
    if (newParentPath && (
      newParentPath === currentPath || 
      newParentPath.startsWith(currentPath + '.')
    )) {
      return false;
    }
    return true;
  },

  /**
   * Validate sort order
   */
  isValidSortOrder: (sortOrder: number): boolean => {
    return Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder <= 9999;
  },

  /**
   * Get hierarchy depth limit
   */
  getMaxDepth: (): number => {
    return 20;
  },

  /**
   * Check if hierarchy is at maximum depth
   */
  isAtMaxDepth: (path: string): boolean => {
    return hierarchyValidationUtils.getHierarchyLevel(path) >= hierarchyValidationUtils.getMaxDepth();
  },

  /**
   * Validate metadata structure
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
   * Sanitize hierarchy name
   */
  sanitizeName: (name: string): string => {
    return name.trim().replace(/\s+/g, ' ');
  },

  /**
   * Sanitize hierarchy code
   */
  sanitizeCode: (code: string): string => {
    return code.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
  },

  /**
   * Get default hierarchy settings
   */
  getDefaultSettings: () => ({
    sort_order: 0,
    is_active: true,
    level: 0
  }),

  /**
   * Validate bulk operation size
   */
  isValidBulkSize: (count: number): boolean => {
    return count > 0 && count <= 20;
  },

  /**
   * Check if hierarchy name is unique at level
   */
  isUniqueNameAtLevel: (name: string, level: number, existingNames: string[]): boolean => {
    const normalizedName = name.toLowerCase().trim();
    return !existingNames.some(existing => existing.toLowerCase() === normalizedName);
  }
};