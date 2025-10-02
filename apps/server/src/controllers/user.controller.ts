/**
 * UserController - User management endpoints
 * Handles user CRUD operations, search, and profile management
 */

import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { UserRepository, HierarchyRepository } from '../repositories';
import { success, error, created, noContent, paginated, handleServiceResult, notFound } from '../utils/response.util';
import { createServiceLogger } from '../services/utils/logger';
import { 
  AuthenticatedRequest, 
  ValidatedRequest, 
  AuthenticatedValidatedRequest 
} from '../types/express';
import { requireUserAccess, userIdExtractors } from '../middleware/authorize.middleware';

const logger = createServiceLogger('UserController');

/**
 * UserController class
 */
export class UserController {
  private userService: UserService;
  private authService: AuthService;

  constructor() {
    const userRepo = new UserRepository();
    const hierarchyRepo = new HierarchyRepository();
    
    this.authService = new AuthService(userRepo);
    this.userService = new UserService(userRepo, hierarchyRepo, this.authService);
  }

  /**
   * Get paginated list of users
   * GET /api/users
   * 
   * Query parameters:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   * - search: string (optional)
   * - hierarchy_id: string (optional)
   * - is_active: boolean (optional)
   * - sort_by: 'full_name' | 'email' | 'created_at' (default: 'full_name')
   * - sort_order: 'asc' | 'desc' (default: 'asc')
   * 
   * @example
   * GET /api/users?page=1&limit=20&search=john&is_active=true
   */
  public getUsers = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get users request', {
        operation: 'getUsers',
        userId: req.user.id,
        filters: req.validatedData.query,
        ip: req.clientIp
      });

      const searchResult = await this.userService.searchUsers(req.validatedData.query);

      if (!searchResult.success) {
        error(res, searchResult.error);
        return;
      }

      const { items, total, page, limit, pages, filters_applied } = searchResult.data;

      logger.info('Users retrieved successfully', {
        operation: 'getUsers',
        userId: req.user.id,
        totalFound: total,
        page,
        limit,
        filtersApplied: filters_applied
      });

      paginated(res, items, { page, limit, total, pages }, {
        filters_applied
      });
    } catch (err) {
      logger.error('Get users error', {
        operation: 'getUsers',
        userId: req.user?.id,
        filters: req.validatedData?.query
      }, err as Error);

      error(res, 'Failed to retrieve users', 500);
    }
  };

  /**
   * Get single user by ID
   * GET /api/users/:id
   */
  public getUser = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.validatedData.params.id;

      logger.info('Get user request', {
        operation: 'getUser',
        requestingUserId: req.user.id,
        targetUserId: userId,
        ip: req.clientIp
      });

      const userResult = await this.userService.getUserById(userId, true);

      if (!userResult.success) {
        if (userResult.error.statusCode === 404) {
          notFound(res, 'User', { userId });
        } else {
          error(res, userResult.error);
        }
        return;
      }

      logger.info('User retrieved successfully', {
        operation: 'getUser',
        requestingUserId: req.user.id,
        targetUserId: userId,
        targetUserEmail: userResult.data.email
      });

      success(res, userResult.data);
    } catch (err) {
      logger.error('Get user error', {
        operation: 'getUser',
        requestingUserId: req.user?.id,
        targetUserId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to retrieve user', 500);
    }
  };

  /**
   * Create new user (admin/manager only)
   * POST /api/users
   * 
   * @example
   * Request body:
   * {
   *   "email": "newuser@example.com",
   *   "password": "SecurePass123!",
   *   "full_name": "John Doe",
   *   "base_hierarchy_id": "hierarchy-uuid",
   *   "phone": "+1234567890",
   *   "metadata": { "department": "Engineering" }
   * }
   */
  public createUser = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Create user request', {
        operation: 'createUser',
        createdBy: req.user.id,
        email: req.validatedData.body.email,
        hierarchyId: req.validatedData.body.base_hierarchy_id,
        ip: req.clientIp
      });

      const createResult = await this.userService.createUser(
        req.validatedData.body,
        req.user.id
      );

      if (!createResult.success) {
        error(res, createResult.error);
        return;
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = createResult.data;

      logger.info('User created successfully', {
        operation: 'createUser',
        createdBy: req.user.id,
        newUserId: createResult.data.id,
        email: createResult.data.email,
        hierarchyId: createResult.data.base_hierarchy_id
      });

      created(res, userResponse);
    } catch (err) {
      logger.error('Create user error', {
        operation: 'createUser',
        createdBy: req.user?.id,
        email: req.validatedData?.body?.email
      }, err as Error);

      error(res, 'Failed to create user', 500);
    }
  };

  /**
   * Update user information
   * PUT /api/users/:id
   * 
   * @example
   * Request body:
   * {
   *   "full_name": "John Smith",
   *   "phone": "+1234567890",
   *   "is_active": true,
   *   "metadata": { "department": "Marketing" }
   * }
   */
  public updateUser = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.validatedData.params.id;

      logger.info('Update user request', {
        operation: 'updateUser',
        updatedBy: req.user.id,
        targetUserId: userId,
        updates: Object.keys(req.validatedData.body),
        ip: req.clientIp
      });

      const updateResult = await this.userService.updateUser(
        userId,
        req.validatedData.body,
        req.user.id
      );

      if (!updateResult.success) {
        if (updateResult.error.statusCode === 404) {
          notFound(res, 'User', { userId });
        } else {
          error(res, updateResult.error);
        }
        return;
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = updateResult.data;

      logger.info('User updated successfully', {
        operation: 'updateUser',
        updatedBy: req.user.id,
        targetUserId: userId,
        updates: Object.keys(req.validatedData.body)
      });

      success(res, userResponse);
    } catch (err) {
      logger.error('Update user error', {
        operation: 'updateUser',
        updatedBy: req.user?.id,
        targetUserId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to update user', 500);
    }
  };

  /**
   * Deactivate user (soft delete)
   * DELETE /api/users/:id
   */
  public deleteUser = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.validatedData.params.id;

      logger.info('Delete user request', {
        operation: 'deleteUser',
        deletedBy: req.user.id,
        targetUserId: userId,
        ip: req.clientIp
      });

      // Prevent self-deletion
      if (userId === req.user.id) {
        logger.warn('User attempted to delete themselves', {
          operation: 'deleteUser',
          userId: req.user.id
        });

        error(res, 'You cannot delete your own account', 400, {
          reason: 'SELF_DELETION_FORBIDDEN'
        });
        return;
      }

      const deleteResult = await this.userService.deactivateUser(userId, req.user.id);

      if (!deleteResult.success) {
        if (deleteResult.error.statusCode === 404) {
          notFound(res, 'User', { userId });
        } else {
          error(res, deleteResult.error);
        }
        return;
      }

      logger.info('User deleted successfully', {
        operation: 'deleteUser',
        deletedBy: req.user.id,
        targetUserId: userId
      });

      noContent(res);
    } catch (err) {
      logger.error('Delete user error', {
        operation: 'deleteUser',
        deletedBy: req.user?.id,
        targetUserId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to delete user', 500);
    }
  };

  /**
   * Change user's hierarchy structure
   * PUT /api/users/:id/hierarchy
   * 
   * @example
   * Request body:
   * {
   *   "new_hierarchy_id": "new-hierarchy-uuid"
   * }
   */
  public changeUserHierarchy = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.validatedData.params.id;
      const newHierarchyId = req.validatedData.body.new_hierarchy_id;

      logger.info('Change user hierarchy request', {
        operation: 'changeUserHierarchy',
        changedBy: req.user.id,
        targetUserId: userId,
        newHierarchyId,
        ip: req.clientIp
      });

      const changeResult = await this.userService.changeUserStructure(
        userId,
        newHierarchyId,
        req.user.id
      );

      if (!changeResult.success) {
        error(res, changeResult.error);
        return;
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = changeResult.data;

      logger.info('User hierarchy changed successfully', {
        operation: 'changeUserHierarchy',
        changedBy: req.user.id,
        targetUserId: userId,
        newHierarchyId,
        oldHierarchyId: userResponse.base_hierarchy_id
      });

      success(res, userResponse);
    } catch (err) {
      logger.error('Change user hierarchy error', {
        operation: 'changeUserHierarchy',
        changedBy: req.user?.id,
        targetUserId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to change user hierarchy', 500);
    }
  };

  /**
   * Get user activity log
   * GET /api/users/:id/activity
   */
  public getUserActivity = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.validatedData.params.id;

      logger.info('Get user activity request', {
        operation: 'getUserActivity',
        requestedBy: req.user.id,
        targetUserId: userId,
        filters: req.validatedData.query
      });

      // This would be implemented when we have an activity logging system
      // For now, return placeholder response
      const mockActivity = {
        user_id: userId,
        activities: [],
        total: 0,
        page: req.validatedData.query?.page || 1,
        limit: req.validatedData.query?.limit || 20
      };

      success(res, mockActivity);
    } catch (err) {
      logger.error('Get user activity error', {
        operation: 'getUserActivity',
        requestedBy: req.user?.id,
        targetUserId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to retrieve user activity', 500);
    }
  };

  /**
   * Update user profile (self-service)
   * PUT /api/users/profile
   * 
   * @example
   * Request body:
   * {
   *   "full_name": "John Smith",
   *   "phone": "+1234567890",
   *   "metadata": {
   *     "bio": "Software Engineer",
   *     "timezone": "America/New_York"
   *   }
   * }
   */
  public updateProfile = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Update profile request', {
        operation: 'updateProfile',
        userId: req.user.id,
        updates: Object.keys(req.validatedData.body),
        ip: req.clientIp
      });

      // Users can only update their own profile through this endpoint
      const updateResult = await this.userService.updateUser(
        req.user.id,
        req.validatedData.body,
        req.user.id
      );

      if (!updateResult.success) {
        error(res, updateResult.error);
        return;
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = updateResult.data;

      logger.info('Profile updated successfully', {
        operation: 'updateProfile',
        userId: req.user.id,
        updates: Object.keys(req.validatedData.body)
      });

      success(res, userResponse);
    } catch (err) {
      logger.error('Update profile error', {
        operation: 'updateProfile',
        userId: req.user?.id
      }, err as Error);

      error(res, 'Failed to update profile', 500);
    }
  };

  /**
   * Search users with autocomplete
   * GET /api/users/search/autocomplete
   * 
   * Query parameters:
   * - search: string (required, min 2 chars)
   * - limit: number (default: 10, max: 20)
   * - hierarchy_id: string (optional)
   * - exclude_inactive: boolean (default: true)
   */
  public searchAutocomplete = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const searchTerm = req.validatedData.query.search;
      const limit = req.validatedData.query.limit || 10;

      logger.info('User autocomplete search', {
        operation: 'searchAutocomplete',
        userId: req.user.id,
        searchTerm: searchTerm.substring(0, 10) + '...', // Truncate for privacy
        limit
      });

      // Use the basic search for now, filter results to autocomplete format
      const searchResult = await this.userService.searchUsers({
        search: searchTerm,
        limit,
        is_active: req.validatedData.query.exclude_inactive !== false,
        hierarchy_id: req.validatedData.query.hierarchy_id,
        sort_by: 'full_name',
        sort_order: 'asc'
      });

      if (!searchResult.success) {
        error(res, searchResult.error);
        return;
      }

      // Format for autocomplete
      const autocompleteResults = searchResult.data.items.map(user => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        hierarchy_name: user.hierarchy_name || 'Unknown'
      }));

      logger.info('User autocomplete completed', {
        operation: 'searchAutocomplete',
        userId: req.user.id,
        resultsCount: autocompleteResults.length
      });

      success(res, autocompleteResults);
    } catch (err) {
      logger.error('User autocomplete error', {
        operation: 'searchAutocomplete',
        userId: req.user?.id
      }, err as Error);

      error(res, 'User search failed', 500);
    }
  };

  /**
   * Bulk user operations
   * POST /api/users/bulk
   * 
   * @example
   * Request body:
   * {
   *   "user_ids": ["uuid1", "uuid2", "uuid3"],
   *   "operation": "activate",
   *   "reason": "Bulk reactivation for new project"
   * }
   */
  public bulkOperation = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const { user_ids, operation, reason } = req.validatedData.body;

      logger.info('Bulk user operation request', {
        operation: 'bulkOperation',
        performedBy: req.user.id,
        userCount: user_ids.length,
        operationType: operation,
        reason,
        ip: req.clientIp
      });

      // This would be implemented in the UserService
      // For now, return placeholder response
      const results = {
        operation,
        requested: user_ids.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
        performed_by: req.user.id,
        performed_at: new Date().toISOString()
      };

      logger.info('Bulk user operation completed', {
        operation: 'bulkOperation',
        performedBy: req.user.id,
        results
      });

      success(res, results);
    } catch (err) {
      logger.error('Bulk user operation error', {
        operation: 'bulkOperation',
        performedBy: req.user?.id
      }, err as Error);

      error(res, 'Bulk operation failed', 500);
    }
  };
}