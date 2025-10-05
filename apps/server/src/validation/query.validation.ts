/**
 * Query validation schemas
 * Validates complex user queries and analytics requests
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
 * Search term validation schema
 */
const searchSchema = z
  .string()
  .max(100, 'Search term cannot exceed 100 characters')
  .transform(term => term.trim())
  .optional();

/**
 * Date validation schema
 */
const dateSchema = z
  .string()
  .datetime('Must be a valid ISO datetime')
  .transform(val => new Date(val));

/**
 * Pagination validation schema
 */
const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .pipe(z.number().int().min(1, 'Page must be at least 1')),
  
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100'))
});

/**
 * Sort validation schema
 */
const sortSchema = z.object({
  sort_by: z
    .enum(['name', 'email', 'hierarchy_path', 'created_at', 'last_login_at'])
    .optional()
    .default('name'),
  
  sort_order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('asc')
});

/**
 * Base query filters schema (without pagination)
 */
const baseQueryFiltersSchema = z.object({
  // Basic filters
  search: searchSchema,
  
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
  
  // Advanced filters
  require_permission: permissionRoleSchema.optional(),
  
  exclude_self: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  hierarchy_levels: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      return val.split(',').map(level => {
        const num = parseInt(level.trim(), 10);
        if (isNaN(num) || num < 0 || num > 20) {
          throw new Error('Invalid hierarchy level');
        }
        return num;
      });
    })
    .pipe(z.array(z.number().int().min(0).max(20)).optional()),
  
  // Date filters
  created_after: dateSchema.optional(),
  
  created_before: dateSchema.optional(),
  
  last_login_after: dateSchema.optional(),
  
  last_login_before: dateSchema.optional(),
  
  // Hierarchy inclusion
  include_inactive_hierarchies: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false))
});

/**
 * Query accessible users validation schema (THE CORE FEATURE)
 */
export const queryAccessibleUsersSchema = baseQueryFiltersSchema.merge(paginationSchema).merge(sortSchema).refine(data => {
  // created_before must be after created_after
  if (data.created_after && data.created_before && data.created_after >= data.created_before) {
    return false;
  }
  return true;
}, {
  message: 'created_before must be after created_after',
  path: ['created_before']
}).refine(data => {
  // last_login_before must be after last_login_after
  if (data.last_login_after && data.last_login_before && data.last_login_after >= data.last_login_before) {
    return false;
  }
  return true;
}, {
  message: 'last_login_before must be after last_login_after',
  path: ['last_login_before']
});

/**
 * User statistics request validation schema
 */
export const userStatsQuerySchema = z.object({
  hierarchy_id: uuidSchema.optional(),
  
  include_descendants: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  include_hierarchy_breakdown: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(true)),
  
  include_role_distribution: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(true)),
  
  include_activity_metrics: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  date_range_days: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 30)
    .pipe(z.number().int().min(1).max(365).optional())
});

/**
 * Bulk user query validation schema
 */
export const bulkUserQuerySchema = z.object({
  user_ids: z
    .array(uuidSchema)
    .min(1, 'At least one user ID is required')
    .max(100, 'Cannot query more than 100 users at once'),
  
  include_permissions: z
    .boolean()
    .optional()
    .default(false),
  
  include_hierarchy_details: z
    .boolean()
    .optional()
    .default(false),
  
  include_activity: z
    .boolean()
    .optional()
    .default(false)
});

/**
 * User autocomplete search validation schema
 */
export const userAutocompleteQuerySchema = z.object({
  search: z
    .string()
    .min(2, 'Search term must be at least 2 characters')
    .max(50, 'Search term cannot exceed 50 characters')
    .transform(term => term.trim()),
  
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 10)
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(20, 'Limit cannot exceed 20')),
  
  hierarchy_id: uuidSchema.optional(),
  
  exclude_inactive: z
    .string()
    .optional()
    .transform(val => val !== 'false')
    .pipe(z.boolean().optional().default(true))
});

/**
 * Analytics query validation schema
 */
export const analyticsQuerySchema = z.object({
  metric_type: z.enum([
    'user_distribution',
    'permission_usage',
    'hierarchy_coverage',
    'activity_trends',
    'access_patterns'
  ]),
  
  time_period: z.enum(['24h', '7d', '30d', '90d', '1y']).optional().default('30d'),
  
  hierarchy_id: uuidSchema.optional(),
  
  group_by: z.enum(['hierarchy', 'role', 'date', 'hour']).optional(),
  
  include_comparisons: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false))
});

/**
 * Export query validation schema
 */
export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx']).optional().default('csv'),
  
  include_headers: z
    .string()
    .optional()
    .transform(val => val !== 'false')
    .pipe(z.boolean().optional().default(true)),
  
  fields: z
    .string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      return val.split(',').map(field => field.trim());
    })
    .pipe(z.array(z.string()).optional()),
  
  max_records: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 10000)
    .pipe(z.number().int().min(1).max(50000).optional())
}).merge(baseQueryFiltersSchema);

/**
 * Advanced search validation schema
 */
export const advancedSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Query is required')
    .max(500, 'Query cannot exceed 500 characters'),
  
  search_fields: z
    .array(z.enum(['name', 'email', 'hierarchy_name', 'metadata']))
    .optional()
    .default(['name', 'email']),
  
  filters: z.object({
    hierarchy_ids: z.array(uuidSchema).optional(),
    roles: z.array(permissionRoleSchema).optional(),
    is_active: z.boolean().optional(),
    date_ranges: z.object({
      created: z.object({
        from: dateSchema.optional(),
        to: dateSchema.optional()
      }).optional(),
      last_login: z.object({
        from: dateSchema.optional(),
        to: dateSchema.optional()
      }).optional()
    }).optional()
  }).optional(),
  
  boost_fields: z.record(z.number().min(0).max(10)).optional(),
  
  fuzzy_search: z
    .boolean()
    .optional()
    .default(false),
  
  highlight: z
    .boolean()
    .optional()
    .default(false)
}).merge(paginationSchema).merge(sortSchema);

/**
 * Query performance monitoring schema
 */
export const queryPerformanceSchema = z.object({
  query_id: z.string().optional(),
  
  track_performance: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false)),
  
  explain: z
    .string()
    .optional()
    .transform(val => val === 'true')
    .pipe(z.boolean().optional().default(false))
});

/**
 * Additional schemas for routes
 */
export const queryUsersSchema = queryAccessibleUsersSchema;
export const queryAnalyticsSchema = analyticsQuerySchema;
export const queryHierarchyStatsSchema = userStatsQuerySchema;
export const queryPermissionInsightsSchema = analyticsQuerySchema;
export const queryScopeComparisonSchema = z.object({
  user_id: z.string().uuid().optional(),
  hierarchy_ids: z.array(z.string().uuid()).optional(),
  compare_with: z.array(z.string().uuid()).optional()
});

/**
 * TypeScript types inferred from schemas
 */
export type QueryAccessibleUsersRequest = z.infer<typeof queryAccessibleUsersSchema>;
export type UserStatsQuery = z.infer<typeof userStatsQuerySchema>;
export type BulkUserQuery = z.infer<typeof bulkUserQuerySchema>;
export type UserAutocompleteQuery = z.infer<typeof userAutocompleteQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type AdvancedSearch = z.infer<typeof advancedSearchSchema>;
export type QueryPerformance = z.infer<typeof queryPerformanceSchema>;

/**
 * Query validation error messages
 */
export const queryValidationMessages = {
  search: {
    required: 'Search term is required',
    minLength: 'Search term must be at least 2 characters',
    maxLength: 'Search term is too long'
  },
  pagination: {
    invalidPage: 'Page must be a positive integer',
    invalidLimit: 'Limit must be between 1 and 100'
  },
  dateRange: {
    invalid: 'Invalid date format',
    reversed: 'End date must be after start date'
  },
  hierarchyLevels: {
    invalid: 'Hierarchy levels must be integers between 0 and 20',
    format: 'Hierarchy levels must be comma-separated numbers'
  },
  bulkQuery: {
    tooMany: 'Cannot query more than 100 users at once',
    empty: 'At least one user ID is required'
  },
  export: {
    tooManyRecords: 'Cannot export more than 50,000 records',
    invalidFormat: 'Export format must be csv, json, or xlsx'
  },
  analytics: {
    invalidMetric: 'Invalid metric type',
    invalidPeriod: 'Invalid time period'
  }
};

/**
 * Query validation utilities
 */
export const queryValidationUtils = {
  /**
   * Validate search term format
   */
  isValidSearchTerm: (term: string): boolean => {
    return term.length >= 2 && term.length <= 100;
  },

  /**
   * Sanitize search term
   */
  sanitizeSearchTerm: (term: string): string => {
    return term.trim().replace(/[<>'"]/g, '');
  },

  /**
   * Validate date range
   */
  isValidDateRange: (start: Date, end: Date): boolean => {
    return start <= end;
  },

  /**
   * Parse hierarchy levels from string
   */
  parseHierarchyLevels: (levelsStr: string): number[] => {
    return levelsStr.split(',').map(level => {
      const num = parseInt(level.trim(), 10);
      if (isNaN(num) || num < 0 || num > 20) {
        throw new Error('Invalid hierarchy level');
      }
      return num;
    });
  },

  /**
   * Get pagination limits
   */
  getPaginationLimits: () => ({
    minPage: 1,
    maxPage: 1000,
    minLimit: 1,
    maxLimit: 100,
    defaultLimit: 20
  }),

  /**
   * Validate bulk query size
   */
  isValidBulkSize: (count: number): boolean => {
    return count > 0 && count <= 100;
  },

  /**
   * Get export limits
   */
  getExportLimits: () => ({
    maxRecords: 50000,
    supportedFormats: ['csv', 'json', 'xlsx']
  }),

  /**
   * Validate sort parameters
   */
  isValidSort: (sortBy: string, sortOrder: string): boolean => {
    const validSortFields = ['name', 'email', 'hierarchy_path', 'created_at', 'last_login_at'];
    const validSortOrders = ['asc', 'desc'];
    return validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder);
  },

  /**
   * Get analytics time periods
   */
  getAnalyticsTimePeriods: () => ({
    '24h': { hours: 24 },
    '7d': { days: 7 },
    '30d': { days: 30 },
    '90d': { days: 90 },
    '1y': { days: 365 }
  }),

  /**
   * Validate field selections
   */
  isValidFieldSelection: (fields: string[]): boolean => {
    const validFields = [
      'id', 'email', 'full_name', 'phone', 'is_active',
      'hierarchy_name', 'hierarchy_path', 'created_at', 'last_login_at'
    ];
    return fields.every(field => validFields.includes(field));
  },

  /**
   * Get default query settings
   */
  getDefaultQuerySettings: () => ({
    page: 1,
    limit: 20,
    sort_by: 'name',
    sort_order: 'asc',
    exclude_self: false,
    include_descendants: false,
    include_inactive_hierarchies: false
  }),

  /**
   * Estimate query complexity
   */
  estimateQueryComplexity: (query: any): 'low' | 'medium' | 'high' => {
    let complexity = 0;
    
    if (query.search) complexity += 2;
    if (query.hierarchy_levels && query.hierarchy_levels.length > 1) complexity += 1;
    if (query.created_after || query.created_before) complexity += 1;
    if (query.last_login_after || query.last_login_before) complexity += 1;
    if (query.include_descendants) complexity += 2;
    if (query.limit && query.limit > 50) complexity += 1;
    
    if (complexity <= 2) return 'low';
    if (complexity <= 5) return 'medium';
    return 'high';
  },

  /**
   * Optimize query parameters
   */
  optimizeQuery: (query: any): any => {
    const optimized = { ...query };
    
    // Limit search term length for performance
    if (optimized.search && optimized.search.length > 50) {
      optimized.search = optimized.search.substring(0, 50);
    }
    
    // Cap limit for performance
    if (optimized.limit && optimized.limit > 100) {
      optimized.limit = 100;
    }
    
    // Remove empty arrays
    if (optimized.hierarchy_levels && optimized.hierarchy_levels.length === 0) {
      delete optimized.hierarchy_levels;
    }
    
    return optimized;
  }
};