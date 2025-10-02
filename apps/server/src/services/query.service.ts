/**
 * QueryService - Main user query endpoint service
 * Orchestrates complex queries across users, hierarchies, and permissions
 */

import { UserRepository, HierarchyRepository, PermissionRepository } from '../repositories';
import { User, HierarchyStructure, Permission, PermissionRole, PaginatedResult } from '@ppm/types';
import { 
  ValidationError, 
  NotFoundError,
  ServiceResult,
  createSuccessResult,
  handleAsync
} from '../errors';
import { Validator } from './utils/validator';
import { createServiceLogger } from './utils/logger';
import { PermissionService, UserAccessFilters, UserWithAccessContext } from './permission.service';
import { AuthService } from './auth.service';

/**
 * Enhanced query filters with permission context
 */
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

/**
 * Query result with analytics
 */
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

/**
 * Quick stats request
 */
export interface StatsRequest {
  user_id: string;
  hierarchy_id?: string;
  include_descendants?: boolean;
}

/**
 * User statistics result
 */
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

/**
 * Bulk query request for multiple users
 */
export interface BulkUserQuery {
  user_ids: string[];
  include_permissions?: boolean;
  include_hierarchy_details?: boolean;
}

/**
 * QueryService class - Main entry point for user queries
 */
export class QueryService {
  private logger = createServiceLogger('QueryService');

  constructor(
    private userRepo: UserRepository,
    private hierarchyRepo: HierarchyRepository,
    private permissionRepo: PermissionRepository,
    private permissionService: PermissionService,
    private authService: AuthService
  ) {}

  /**
   * Main query endpoint - THE PRIMARY FEATURE
   * Get users with comprehensive filtering, analytics, and permission context
   */
  async queryUsers(
    requestingUserId: string,
    filters: QueryFilters = {}
  ): Promise<ServiceResult<QueryResult>> {
    return handleAsync(async () => {
      const startTime = Date.now();
      
      this.logger.info('User query initiated', {
        operation: 'queryUsers',
        requestingUserId,
        filters: this.sanitizeFiltersForLogging(filters)
      });

      // Validate requesting user
      Validator.validateUUID(requestingUserId);
      
      // Check if requesting user is active
      const requestingUser = await this.userRepo.findById(requestingUserId);
      if (!requestingUser || !requestingUser.is_active) {
        throw new NotFoundError('Requesting user', requestingUserId);
      }

      // Get accessible users through permission service
      const accessibleUsersResult = await this.permissionService.getAccessibleUsers(
        requestingUserId,
        this.convertToUserAccessFilters(filters)
      );

      if (!accessibleUsersResult.success) {
        throw accessibleUsersResult.error;
      }

      const accessibleUsers = accessibleUsersResult.data;

      // Apply additional filters
      let filteredUsers = accessibleUsers.items;
      
      if (filters.exclude_self) {
        filteredUsers = filteredUsers.filter(user => user.id !== requestingUserId);
      }

      if (filters.require_permission) {
        filteredUsers = await this.filterByRequiredPermission(
          filteredUsers,
          filters.require_permission,
          requestingUserId
        );
      }

      if (filters.hierarchy_levels && filters.hierarchy_levels.length > 0) {
        filteredUsers = filteredUsers.filter(user => 
          filters.hierarchy_levels!.includes(user.base_hierarchy_level)
        );
      }

      if (filters.created_after) {
        filteredUsers = filteredUsers.filter(user => 
          new Date(user.created_at) >= filters.created_after!
        );
      }

      if (filters.created_before) {
        filteredUsers = filteredUsers.filter(user => 
          new Date(user.created_at) <= filters.created_before!
        );
      }

      // Calculate analytics
      const analytics = this.calculateAnalytics(filteredUsers, accessibleUsers.items);

      // Get requestor context
      const accessScope = await this.permissionService.getUserAccessScope(requestingUserId);
      if (!accessScope.success) {
        throw accessScope.error;
      }

      const executionTime = Date.now() - startTime;

      const result: QueryResult = {
        items: filteredUsers,
        total: filteredUsers.length,
        page: accessibleUsers.page,
        limit: accessibleUsers.limit,
        pages: Math.ceil(filteredUsers.length / accessibleUsers.limit),
        analytics,
        requestor_context: {
          user_id: requestingUserId,
          accessible_hierarchies: accessScope.data.accessible_hierarchy_ids.length,
          total_accessible_users: accessScope.data.total_accessible_users,
          query_performance: {
            execution_time_ms: executionTime
          }
        }
      };

      this.logger.info('User query completed', {
        operation: 'queryUsers',
        requestingUserId,
        totalFound: result.total,
        executionTimeMs: executionTime,
        accessibleHierarchies: result.requestor_context.accessible_hierarchies
      });

      return result;
    });
  }

  /**
   * Get quick statistics for dashboard
   */
  async getUserStats(
    requestingUserId: string,
    request: StatsRequest
  ): Promise<ServiceResult<UserStats>> {
    return handleAsync(async () => {
      this.logger.info('User stats request', {
        operation: 'getUserStats',
        requestingUserId,
        targetHierarchy: request.hierarchy_id
      });

      Validator.validateUUID(requestingUserId);
      if (request.hierarchy_id) {
        Validator.validateUUID(request.hierarchy_id);
      }

      // Get user's access scope
      const accessScope = await this.permissionService.getUserAccessScope(requestingUserId);
      if (!accessScope.success) {
        throw accessScope.error;
      }

      // Determine target hierarchies
      let targetHierarchyPaths = accessScope.data.accessible_hierarchy_paths;
      
      if (request.hierarchy_id) {
        // Check if user can access the specified hierarchy
        const canAccess = await this.permissionService.canUserAccessStructure(
          requestingUserId,
          request.hierarchy_id
        );
        
        if (!canAccess.success || !canAccess.data.canAccess) {
          throw new NotFoundError('Hierarchy', request.hierarchy_id);
        }

        const hierarchy = await this.hierarchyRepo.findById(request.hierarchy_id);
        if (!hierarchy) {
          throw new NotFoundError('Hierarchy', request.hierarchy_id);
        }

        if (request.include_descendants) {
          // Get all descendant paths
          const allHierarchies = await this.hierarchyRepo.findAll();
          targetHierarchyPaths = [hierarchy.path].concat(
            allHierarchies
              .filter(h => h.path.startsWith(hierarchy.path + '.'))
              .map(h => h.path)
          );
        } else {
          targetHierarchyPaths = [hierarchy.path];
        }
      }

      // Get users in target hierarchies
      const users = await this.userRepo.findByHierarchyPaths(targetHierarchyPaths);
      
      // Calculate statistics
      const stats = await this.calculateUserStats(users, targetHierarchyPaths);

      this.logger.info('User stats calculated', {
        operation: 'getUserStats',
        requestingUserId,
        totalUsers: stats.total_users,
        hierarchiesAnalyzed: targetHierarchyPaths.length
      });

      return stats;
    });
  }

  /**
   * Bulk query for multiple specific users
   */
  async bulkQueryUsers(
    requestingUserId: string,
    request: BulkUserQuery
  ): Promise<ServiceResult<Array<UserWithAccessContext & { permissions?: Permission[] }>>> {
    return handleAsync(async () => {
      this.logger.info('Bulk user query', {
        operation: 'bulkQueryUsers',
        requestingUserId,
        userCount: request.user_ids.length
      });

      Validator.validateUUID(requestingUserId);
      
      if (!request.user_ids || request.user_ids.length === 0) {
        throw new ValidationError('User IDs are required');
      }

      if (request.user_ids.length > 100) {
        throw new ValidationError('Maximum 100 users per bulk query');
      }

      // Validate all user IDs
      request.user_ids.forEach(id => Validator.validateUUID(id));

      const results: Array<UserWithAccessContext & { permissions?: Permission[] }> = [];

      // Check access for each user
      for (const userId of request.user_ids) {
        try {
          const canAccess = await this.permissionService.canUserAccessUser(
            requestingUserId,
            userId
          );

          if (canAccess.success && canAccess.data.canAccess) {
            const user = await this.userRepo.findById(userId, true);
            if (user && user.is_active) {
              // Remove password hash
              const { password_hash: _, ...userWithoutPassword } = user;
              
              const userWithContext: UserWithAccessContext & { permissions?: Permission[] } = {
                ...userWithoutPassword,
                access_level: canAccess.data.accessLevel || 'direct',
                permission_source: 'direct',
                user_hierarchy_path: user.hierarchy_path,
                user_hierarchy_name: user.hierarchy_name,
                accessible_through: [user.hierarchy_path]
              };

              // Include permissions if requested
              if (request.include_permissions) {
                const permissions = await this.permissionRepo.findByUserId(userId);
                userWithContext.permissions = permissions;
              }

              results.push(userWithContext);
            }
          }
        } catch (error) {
          this.logger.warn('Error in bulk query for user', {
            operation: 'bulkQueryUsers',
            requestingUserId,
            targetUserId: userId
          }, error as Error);
          // Continue processing other users
        }
      }

      this.logger.info('Bulk user query completed', {
        operation: 'bulkQueryUsers',
        requestingUserId,
        requested: request.user_ids.length,
        accessible: results.length
      });

      return results;
    });
  }

  /**
   * Search users with autocomplete support
   */
  async searchUsersAutocomplete(
    requestingUserId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<ServiceResult<Array<{ id: string; name: string; email: string; hierarchy_name: string }>>> {
    return handleAsync(async () => {
      this.logger.info('User autocomplete search', {
        operation: 'searchUsersAutocomplete',
        requestingUserId,
        searchTerm: searchTerm.substring(0, 20) // Log partial for privacy
      });

      Validator.validateUUID(requestingUserId);
      
      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new ValidationError('Search term must be at least 2 characters');
      }

      const sanitizedTerm = searchTerm.trim().toLowerCase();
      const clampedLimit = Math.min(Math.max(limit, 1), 20); // Between 1 and 20

      // Get accessible users with search
      const result = await this.permissionService.getAccessibleUsers(requestingUserId, {
        search: sanitizedTerm,
        limit: clampedLimit,
        sort_by: 'name'
      });

      if (!result.success) {
        throw result.error;
      }

      const autocompleteResults = result.data.items.map(user => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        hierarchy_name: user.user_hierarchy_name
      }));

      this.logger.info('User autocomplete completed', {
        operation: 'searchUsersAutocomplete',
        requestingUserId,
        resultsCount: autocompleteResults.length
      });

      return autocompleteResults;
    });
  }

  // Private helper methods

  private convertToUserAccessFilters(filters: QueryFilters): UserAccessFilters {
    return {
      search: filters.search,
      hierarchy_id: filters.hierarchy_id,
      role: filters.role,
      is_active: filters.is_active,
      include_descendants: filters.include_descendants,
      page: filters.page,
      limit: filters.limit,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order
    };
  }

  private async filterByRequiredPermission(
    users: UserWithAccessContext[],
    requiredRole: PermissionRole,
    requestingUserId: string
  ): Promise<UserWithAccessContext[]> {
    const filteredUsers: UserWithAccessContext[] = [];

    for (const user of users) {
      try {
        const permissions = await this.permissionRepo.findActiveByUserIdWithHierarchy(user.id);
        const hasRequiredRole = permissions.some(p => p.role === requiredRole);
        
        if (hasRequiredRole) {
          filteredUsers.push(user);
        }
      } catch (error) {
        this.logger.warn('Error checking required permission', {
          operation: 'filterByRequiredPermission',
          userId: user.id,
          requiredRole
        }, error as Error);
      }
    }

    return filteredUsers;
  }

  private calculateAnalytics(
    resultUsers: UserWithAccessContext[],
    allAccessibleUsers: UserWithAccessContext[]
  ): QueryResult['analytics'] {
    const totalByHierarchy: Record<string, number> = {};
    const totalByRole: Record<string, number> = {};
    const totalByAccessLevel: Record<string, number> = {};

    // Count by hierarchy
    resultUsers.forEach(user => {
      const hierarchyName = user.user_hierarchy_name;
      totalByHierarchy[hierarchyName] = (totalByHierarchy[hierarchyName] || 0) + 1;
    });

    // Count by access level
    resultUsers.forEach(user => {
      totalByAccessLevel[user.access_level] = (totalByAccessLevel[user.access_level] || 0) + 1;
    });

    // Calculate hierarchy coverage
    const hierarchyMap = new Map<string, { name: string; path: string; count: number }>();
    
    allAccessibleUsers.forEach(user => {
      const key = user.base_hierarchy_id;
      if (!hierarchyMap.has(key)) {
        hierarchyMap.set(key, {
          name: user.user_hierarchy_name,
          path: user.user_hierarchy_path,
          count: 0
        });
      }
      
      if (resultUsers.some(ru => ru.id === user.id)) {
        hierarchyMap.get(key)!.count++;
      }
    });

    const hierarchyCoverage = Array.from(hierarchyMap.entries()).map(([id, data]) => ({
      hierarchy_id: id,
      hierarchy_name: data.name,
      hierarchy_path: data.path,
      user_count: data.count,
      percentage: allAccessibleUsers.length > 0 ? 
        Math.round((data.count / allAccessibleUsers.length) * 100 * 100) / 100 : 0
    }));

    return {
      total_by_hierarchy: totalByHierarchy,
      total_by_role: totalByRole,
      total_by_access_level: totalByAccessLevel,
      hierarchy_coverage: hierarchyCoverage
    };
  }

  private async calculateUserStats(
    users: User[],
    hierarchyPaths: string[]
  ): Promise<UserStats> {
    const activeUsers = users.filter(u => u.is_active);
    const inactiveUsers = users.filter(u => !u.is_active);

    // Group by hierarchy
    const hierarchyMap = new Map<string, { name: string; path: string; users: User[] }>();
    
    for (const user of users) {
      const key = user.base_hierarchy_id;
      if (!hierarchyMap.has(key)) {
        const hierarchy = await this.hierarchyRepo.findById(user.base_hierarchy_id);
        hierarchyMap.set(key, {
          name: hierarchy?.name || 'Unknown',
          path: hierarchy?.path || '',
          users: []
        });
      }
      hierarchyMap.get(key)!.users.push(user);
    }

    const byHierarchy = Array.from(hierarchyMap.entries()).map(([id, data]) => ({
      hierarchy_id: id,
      hierarchy_name: data.name,
      hierarchy_path: data.path,
      user_count: data.users.length,
      active_count: data.users.filter(u => u.is_active).length,
      percentage_of_total: users.length > 0 ? 
        Math.round((data.users.length / users.length) * 100 * 100) / 100 : 0
    }));

    // Calculate role distribution (placeholder - would need permission data)
    const byRole: Record<PermissionRole, number> = {
      [PermissionRole.READ]: 0,
      [PermissionRole.MANAGER]: 0,
      [PermissionRole.ADMIN]: 0
    };

    // Calculate recent activity (placeholder for now)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsersLast30Days = users.filter(u => 
      new Date(u.created_at) >= thirtyDaysAgo
    ).length;

    return {
      total_users: users.length,
      active_users: activeUsers.length,
      inactive_users: inactiveUsers.length,
      by_hierarchy: byHierarchy,
      by_role: byRole,
      recent_activity: {
        new_users_last_30_days: newUsersLast30Days,
        logins_last_30_days: 0, // Would need login tracking
        permission_changes_last_30_days: 0 // Would need audit log
      }
    };
  }

  private sanitizeFiltersForLogging(filters: QueryFilters): Partial<QueryFilters> {
    const { search, ...safeFilters } = filters;
    return {
      ...safeFilters,
      search: search ? `[${search.length} chars]` : undefined
    };
  }
}