/**
 * QueryController - Main user query and analytics endpoints
 * Handles the core feature: querying accessible users with complex filtering and analytics
 */

import { Request, Response } from 'express';
import { QueryService } from '../services/query.service';
import { PermissionService } from '../services/permission.service';
import { AuthService } from '../services/auth.service';
import { UserRepository, HierarchyRepository, PermissionRepository } from '../repositories';
import { success, error, paginated, handleServiceResult } from '../utils/response.util';
import { createServiceLogger } from '../services/utils/logger';
import { 
  AuthenticatedRequest, 
  ValidatedRequest, 
  AuthenticatedValidatedRequest 
} from '../types/express';

const logger = createServiceLogger('QueryController');

/**
 * QueryController class - THE CORE FEATURE CONTROLLER
 */
export class QueryController {
  private queryService: QueryService;
  private permissionService: PermissionService;

  constructor() {
    const userRepo = new UserRepository();
    const hierarchyRepo = new HierarchyRepository();
    const permissionRepo = new PermissionRepository();
    
    this.permissionService = new PermissionService(userRepo, hierarchyRepo, permissionRepo);
    const authService = new AuthService(userRepo);
    
    this.queryService = new QueryService(
      userRepo, 
      hierarchyRepo, 
      permissionRepo, 
      this.permissionService, 
      authService
    );
  }

  /**
   * **THE CORE FEATURE** - Query accessible users with analytics
   * GET /api/query/users
   * 
   * The main endpoint for the hierarchical permission system.
   * Returns users that the requesting user can access based on their permissions,
   * with comprehensive filtering, sorting, and analytics.
   * 
   * Query parameters:
   * - search: string (optional) - Search in names and emails
   * - hierarchy_id: string (optional) - Filter by specific hierarchy
   * - role: 'read'|'manager'|'admin' (optional) - Filter by role
   * - is_active: boolean (optional) - Filter by active status
   * - include_descendants: boolean (optional) - Include descendant hierarchies
   * - require_permission: 'read'|'manager'|'admin' (optional) - Require specific permission
   * - exclude_self: boolean (optional) - Exclude requesting user from results
   * - hierarchy_levels: string (optional) - Comma-separated hierarchy levels (0,1,2)
   * - created_after: ISO date (optional) - Filter by creation date
   * - created_before: ISO date (optional) - Filter by creation date
   * - last_login_after: ISO date (optional) - Filter by last login
   * - last_login_before: ISO date (optional) - Filter by last login
   * - include_inactive_hierarchies: boolean (optional) - Include inactive hierarchies
   * - page: number (optional) - Page number (default: 1)
   * - limit: number (optional) - Items per page (default: 20, max: 100)
   * - sort_by: string (optional) - Sort field (default: 'name')
   * - sort_order: 'asc'|'desc' (optional) - Sort order (default: 'asc')
   * 
   * @example
   * GET /api/query/users?search=john&hierarchy_id=uuid&role=manager&page=1&limit=20
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "user-uuid",
   *       "email": "john@example.com",
   *       "full_name": "John Doe",
   *       "access_level": "direct",
   *       "permission_source": "direct",
   *       "user_hierarchy_path": "org.dept.team",
   *       "accessible_through": ["org.dept"]
   *     }
   *   ],
   *   "pagination": { "page": 1, "limit": 20, "total": 50, "pages": 3 },
   *   "analytics": {
   *     "total_by_hierarchy": { "Engineering": 25, "Marketing": 15 },
   *     "total_by_role": { "read": 30, "manager": 15, "admin": 5 },
   *     "hierarchy_coverage": [...]
   *   },
   *   "requestor_context": {
   *     "user_id": "requesting-user-uuid",
   *     "accessible_hierarchies": 5,
   *     "total_accessible_users": 150,
   *     "query_performance": { "execution_time_ms": 245 }
   *   }
   * }
   */
  public queryUsers = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();

      logger.info('User query request - CORE FEATURE', {
        operation: 'queryUsers',
        requestingUserId: req.user.id,
        filters: req.validatedData.query,
        ip: req.clientIp,
        userAgent: req.userAgent
      });

      // Execute the core query through QueryService
      const queryResult = await this.queryService.queryUsers(
        req.user.id,
        req.validatedData.query
      );

      if (!queryResult.success) {
        logger.warn('User query failed', {
          operation: 'queryUsers',
          requestingUserId: req.user.id,
          error: queryResult.error.message,
          filters: req.validatedData.query
        });

        error(res, queryResult.error);
        return;
      }

      const executionTime = Date.now() - startTime;
      
      // Log successful query with analytics
      logger.info('User query completed successfully - CORE FEATURE', {
        operation: 'queryUsers',
        requestingUserId: req.user.id,
        totalFound: queryResult.data.total,
        page: queryResult.data.page,
        limit: queryResult.data.limit,
        executionTimeMs: executionTime,
        accessibleHierarchies: queryResult.data.requestor_context.accessible_hierarchies,
        totalAccessibleUsers: queryResult.data.requestor_context.total_accessible_users,
        analyticsIncluded: true
      });

      // Return comprehensive response with analytics
      const response = {
        users: queryResult.data.items,
        analytics: queryResult.data.analytics,
        requestor_context: {
          ...queryResult.data.requestor_context,
          query_performance: {
            execution_time_ms: executionTime,
            cache_hit: false // Future enhancement
          }
        }
      };

      paginated(
        res, 
        queryResult.data.items, 
        {
          page: queryResult.data.page,
          limit: queryResult.data.limit,
          total: queryResult.data.total,
          pages: queryResult.data.pages
        },
        {
          analytics: queryResult.data.analytics,
          requestor_context: response.requestor_context,
          query_complexity: this.estimateQueryComplexity(req.validatedData.query),
          performance: {
            execution_time_ms: executionTime,
            database_queries: 3, // Estimated
            cache_hits: 0 // Future enhancement
          }
        }
      );
    } catch (err) {
      logger.error('User query error - CORE FEATURE', {
        operation: 'queryUsers',
        requestingUserId: req.user?.id,
        filters: req.validatedData?.query
      }, err as Error);

      error(res, 'User query failed due to internal error', 500);
    }
  };

  /**
   * Get current user's access scope and statistics
   * GET /api/query/my-scope
   * 
   * Returns detailed information about what the current user can access
   * 
   * @example
   * Response:
   * {
   *   "user_id": "user-uuid",
   *   "accessible_hierarchy_ids": ["uuid1", "uuid2"],
   *   "accessible_hierarchy_paths": ["org.dept1", "org.dept2"],
   *   "total_accessible_users": 150,
   *   "direct_permissions": [...],
   *   "inherited_permissions": [...]
   * }
   */
  public getMyAccessScope = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get my access scope request', {
        operation: 'getMyAccessScope',
        userId: req.user.id,
        ip: req.clientIp
      });

      const scopeResult = await this.permissionService.getUserAccessScope(req.user.id);

      if (!scopeResult.success) {
        error(res, scopeResult.error);
        return;
      }

      logger.info('My access scope retrieved successfully', {
        operation: 'getMyAccessScope',
        userId: req.user.id,
        accessibleHierarchies: scopeResult.data.accessible_hierarchy_ids.length,
        totalAccessibleUsers: scopeResult.data.total_accessible_users,
        directPermissions: scopeResult.data.direct_permissions.length
      });

      success(res, scopeResult.data);
    } catch (err) {
      logger.error('Get my access scope error', {
        operation: 'getMyAccessScope',
        userId: req.user?.id
      }, err as Error);

      error(res, 'Failed to retrieve access scope', 500);
    }
  };

  /**
   * Get user statistics and dashboard data
   * GET /api/query/stats
   * 
   * Query parameters:
   * - hierarchy_id: string (optional) - Specific hierarchy to analyze
   * - include_descendants: boolean (optional) - Include descendant hierarchies
   * - include_hierarchy_breakdown: boolean (optional) - Include hierarchy stats
   * - include_role_distribution: boolean (optional) - Include role distribution
   * - include_activity_metrics: boolean (optional) - Include activity data
   * - date_range_days: number (optional) - Days to include in activity metrics (default: 30)
   * 
   * @example
   * GET /api/query/stats?include_descendants=true&date_range_days=30
   */
  public getUserStats = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get user stats request', {
        operation: 'getUserStats',
        requestingUserId: req.user.id,
        filters: req.validatedData.query,
        ip: req.clientIp
      });

      const statsResult = await this.queryService.getUserStats(
        req.user.id,
        {
          user_id: req.user.id,
          ...req.validatedData.query
        }
      );

      if (!statsResult.success) {
        error(res, statsResult.error);
        return;
      }

      logger.info('User stats retrieved successfully', {
        operation: 'getUserStats',
        requestingUserId: req.user.id,
        totalUsers: statsResult.data.total_users,
        activeUsers: statsResult.data.active_users,
        hierarchiesAnalyzed: statsResult.data.by_hierarchy.length
      });

      success(res, statsResult.data);
    } catch (err) {
      logger.error('Get user stats error', {
        operation: 'getUserStats',
        requestingUserId: req.user?.id
      }, err as Error);

      error(res, 'Failed to retrieve user statistics', 500);
    }
  };

  /**
   * Bulk query specific users
   * POST /api/query/bulk-users
   * 
   * @example
   * Request body:
   * {
   *   "user_ids": ["uuid1", "uuid2", "uuid3"],
   *   "include_permissions": true,
   *   "include_hierarchy_details": true,
   *   "include_activity": false
   * }
   */
  public bulkQueryUsers = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Bulk query users request', {
        operation: 'bulkQueryUsers',
        requestingUserId: req.user.id,
        userCount: req.validatedData.body.user_ids.length,
        includePermissions: req.validatedData.body.include_permissions,
        ip: req.clientIp
      });

      const bulkResult = await this.queryService.bulkQueryUsers(
        req.user.id,
        req.validatedData.body
      );

      if (!bulkResult.success) {
        error(res, bulkResult.error);
        return;
      }

      logger.info('Bulk query users completed', {
        operation: 'bulkQueryUsers',
        requestingUserId: req.user.id,
        requested: req.validatedData.body.user_ids.length,
        accessible: bulkResult.data.length
      });

      success(res, {
        users: bulkResult.data,
        summary: {
          requested: req.validatedData.body.user_ids.length,
          accessible: bulkResult.data.length,
          include_permissions: req.validatedData.body.include_permissions,
          include_hierarchy_details: req.validatedData.body.include_hierarchy_details
        }
      });
    } catch (err) {
      logger.error('Bulk query users error', {
        operation: 'bulkQueryUsers',
        requestingUserId: req.user?.id,
        userCount: req.validatedData?.body?.user_ids?.length
      }, err as Error);

      error(res, 'Bulk user query failed', 500);
    }
  };

  /**
   * User autocomplete search
   * GET /api/query/autocomplete
   * 
   * Fast autocomplete search for user selection interfaces
   * 
   * Query parameters:
   * - search: string (required, min 2 chars) - Search term
   * - limit: number (optional, default: 10, max: 20) - Results limit
   * - hierarchy_id: string (optional) - Limit to specific hierarchy
   * - exclude_inactive: boolean (optional, default: true) - Exclude inactive users
   * 
   * @example
   * GET /api/query/autocomplete?search=john&limit=10
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "user-uuid",
   *       "name": "John Doe",
   *       "email": "john@example.com",
   *       "hierarchy_name": "Engineering Department"
   *     }
   *   ]
   * }
   */
  public searchAutocomplete = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const searchTerm = req.validatedData.query.search;
      const limit = req.validatedData.query.limit || 10;

      logger.info('User autocomplete search', {
        operation: 'searchAutocomplete',
        userId: req.user.id,
        searchLength: searchTerm.length,
        limit,
        ip: req.clientIp
      });

      const autocompleteResult = await this.queryService.searchUsersAutocomplete(
        req.user.id,
        searchTerm,
        limit
      );

      if (!autocompleteResult.success) {
        error(res, autocompleteResult.error);
        return;
      }

      logger.info('User autocomplete completed', {
        operation: 'searchAutocomplete',
        userId: req.user.id,
        resultsCount: autocompleteResult.data.length,
        searchTerm: searchTerm.substring(0, 10) // Truncated for privacy
      });

      success(res, autocompleteResult.data);
    } catch (err) {
      logger.error('User autocomplete error', {
        operation: 'searchAutocomplete',
        userId: req.user?.id,
        searchTerm: req.validatedData?.query?.search?.substring(0, 10)
      }, err as Error);

      error(res, 'Autocomplete search failed', 500);
    }
  };

  /**
   * Export user query results
   * POST /api/query/export
   * 
   * Export query results in various formats (CSV, JSON, Excel)
   * 
   * @example
   * Request body:
   * {
   *   "format": "csv",
   *   "include_headers": true,
   *   "fields": ["id", "email", "full_name", "hierarchy_name"],
   *   "max_records": 5000,
   *   "search": "manager",
   *   "hierarchy_id": "dept-uuid"
   * }
   */
  public exportUsers = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const { format, max_records, fields, ...queryFilters } = req.validatedData.body;

      logger.info('Export users request', {
        operation: 'exportUsers',
        requestingUserId: req.user.id,
        format,
        maxRecords: max_records,
        fieldsCount: fields?.length,
        filters: queryFilters,
        ip: req.clientIp
      });

      // This would be implemented as a new method in QueryService
      // For now, return placeholder response
      const exportResult = {
        export_id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        format,
        status: 'processing',
        estimated_records: 0,
        download_url: null, // Would be populated when ready
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        created_at: new Date().toISOString(),
        created_by: req.user.id
      };

      logger.info('Export users initiated', {
        operation: 'exportUsers',
        requestingUserId: req.user.id,
        exportId: exportResult.export_id,
        format
      });

      success(res, exportResult, 202); // 202 Accepted for async processing
    } catch (err) {
      logger.error('Export users error', {
        operation: 'exportUsers',
        requestingUserId: req.user?.id
      }, err as Error);

      error(res, 'Export request failed', 500);
    }
  };

  /**
   * Get query performance metrics
   * GET /api/query/performance
   * 
   * Returns performance metrics for query optimization
   */
  public getQueryPerformance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get query performance request', {
        operation: 'getQueryPerformance',
        userId: req.user.id,
        ip: req.clientIp
      });

      // Mock performance data - would be real metrics in production
      const performanceData = {
        user_id: req.user.id,
        query_stats: {
          total_queries_today: 45,
          avg_execution_time_ms: 180,
          slowest_query_ms: 850,
          fastest_query_ms: 45,
          cache_hit_rate: 0.65
        },
        recommendations: [
          'Consider adding hierarchy filters to improve performance',
          'Large result sets detected - use pagination'
        ],
        access_scope_summary: {
          accessible_hierarchies: 8,
          total_accessible_users: 1250,
          most_queried_hierarchy: 'Engineering Department'
        }
      };

      success(res, performanceData);
    } catch (err) {
      logger.error('Get query performance error', {
        operation: 'getQueryPerformance',
        userId: req.user?.id
      }, err as Error);

      error(res, 'Failed to retrieve performance metrics', 500);
    }
  };

  /**
   * Private helper methods
   */

  /**
   * Estimate query complexity for performance monitoring
   */
  private estimateQueryComplexity(filters: any): 'low' | 'medium' | 'high' {
    let complexity = 0;
    
    if (filters.search) complexity += 2;
    if (filters.hierarchy_levels && filters.hierarchy_levels.length > 1) complexity += 1;
    if (filters.created_after || filters.created_before) complexity += 1;
    if (filters.last_login_after || filters.last_login_before) complexity += 1;
    if (filters.include_descendants) complexity += 2;
    if (filters.require_permission) complexity += 1;
    if (filters.limit && filters.limit > 50) complexity += 1;
    
    if (complexity <= 3) return 'low';
    if (complexity <= 6) return 'medium';
    return 'high';
  }
}