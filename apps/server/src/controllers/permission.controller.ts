/**
 * PermissionController - Permission management endpoints
 * Handles permission granting, revoking, and access control operations
 */

import { Request, Response } from 'express';
import { PermissionService } from '../services/permission.service';
import { UserRepository, HierarchyRepository, PermissionRepository } from '../repositories';
import { success, error, created, noContent, paginated, handleServiceResult, notFound } from '../utils/response.util';
import { createServiceLogger } from '../services/utils/logger';
import { 
  AuthenticatedRequest, 
  ValidatedRequest, 
  AuthenticatedValidatedRequest 
} from '../types/express';

const logger = createServiceLogger('PermissionController');

/**
 * PermissionController class
 */
export class PermissionController {
  private permissionService: PermissionService;

  constructor() {
    const userRepo = new UserRepository();
    const hierarchyRepo = new HierarchyRepository();
    const permissionRepo = new PermissionRepository();
    
    this.permissionService = new PermissionService(userRepo, hierarchyRepo, permissionRepo);
  }

  /**
   * Grant permission to user
   * POST /api/permissions
   * 
   * @example
   * Request body:
   * {
   *   "user_id": "user-uuid",
   *   "hierarchy_id": "hierarchy-uuid",
   *   "role": "manager",
   *   "inherit_to_descendants": true,
   *   "expires_at": "2024-12-31T23:59:59Z",
   *   "metadata": { "reason": "Project assignment" }
   * }
   */
  public grantPermission = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Grant permission request', {
        operation: 'grantPermission',
        grantedBy: req.user.id,
        targetUserId: req.validatedData.body.user_id,
        hierarchyId: req.validatedData.body.hierarchy_id,
        role: req.validatedData.body.role,
        inheritToDescendants: req.validatedData.body.inherit_to_descendants,
        ip: req.clientIp
      });

      const grantResult = await this.permissionService.grantPermission(
        req.validatedData.body,
        req.user.id
      );

      if (!grantResult.success) {
        error(res, grantResult.error);
        return;
      }

      logger.permission('Permission granted successfully', {
        operation: 'grantPermission',
        grantedBy: req.user.id,
        permissionId: grantResult.data.id,
        targetUserId: req.validatedData.body.user_id,
        hierarchyId: req.validatedData.body.hierarchy_id,
        role: req.validatedData.body.role
      });

      created(res, grantResult.data);
    } catch (err) {
      logger.error('Grant permission error', {
        operation: 'grantPermission',
        grantedBy: req.user?.id,
        targetUserId: req.validatedData?.body?.user_id,
        hierarchyId: req.validatedData?.body?.hierarchy_id
      }, err as Error);

      error(res, 'Failed to grant permission', 500);
    }
  };

  /**
   * Revoke permission
   * DELETE /api/permissions/:id
   */
  public revokePermission = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const permissionId = req.validatedData.params.id;

      logger.info('Revoke permission request', {
        operation: 'revokePermission',
        revokedBy: req.user.id,
        permissionId,
        ip: req.clientIp
      });

      const revokeResult = await this.permissionService.revokePermission(
        permissionId,
        req.user.id
      );

      if (!revokeResult.success) {
        if (revokeResult.error.statusCode === 404) {
          notFound(res, 'Permission', { permissionId });
        } else {
          error(res, revokeResult.error);
        }
        return;
      }

      logger.permission('Permission revoked successfully', {
        operation: 'revokePermission',
        revokedBy: req.user.id,
        permissionId
      });

      noContent(res);
    } catch (err) {
      logger.error('Revoke permission error', {
        operation: 'revokePermission',
        revokedBy: req.user?.id,
        permissionId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to revoke permission', 500);
    }
  };

  /**
   * Update permission
   * PUT /api/permissions/:id
   * 
   * @example
   * Request body:
   * {
   *   "role": "admin",
   *   "inherit_to_descendants": false,
   *   "expires_at": "2025-12-31T23:59:59Z",
   *   "metadata": { "updated_reason": "Role promotion" }
   * }
   */
  public updatePermission = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const permissionId = req.validatedData.params.id;

      logger.info('Update permission request', {
        operation: 'updatePermission',
        updatedBy: req.user.id,
        permissionId,
        updates: Object.keys(req.validatedData.body),
        ip: req.clientIp
      });

      const updateResult = await this.permissionService.updatePermission(
        permissionId,
        req.validatedData.body,
        req.user.id
      );

      if (!updateResult.success) {
        if (updateResult.error.statusCode === 404) {
          notFound(res, 'Permission', { permissionId });
        } else {
          error(res, updateResult.error);
        }
        return;
      }

      logger.permission('Permission updated successfully', {
        operation: 'updatePermission',
        updatedBy: req.user.id,
        permissionId,
        updates: Object.keys(req.validatedData.body)
      });

      success(res, updateResult.data);
    } catch (err) {
      logger.error('Update permission error', {
        operation: 'updatePermission',
        updatedBy: req.user?.id,
        permissionId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to update permission', 500);
    }
  };

  /**
   * Get user's permissions
   * GET /api/permissions/user/:userId
   */
  public getUserPermissions = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const targetUserId = req.validatedData.params.userId;

      logger.info('Get user permissions request', {
        operation: 'getUserPermissions',
        requestedBy: req.user.id,
        targetUserId,
        ip: req.clientIp
      });

      const permissionsResult = await this.permissionService.getUserPermissions(targetUserId);

      if (!permissionsResult.success) {
        error(res, permissionsResult.error);
        return;
      }

      logger.info('User permissions retrieved successfully', {
        operation: 'getUserPermissions',
        requestedBy: req.user.id,
        targetUserId,
        permissionCount: permissionsResult.data.length
      });

      success(res, permissionsResult.data);
    } catch (err) {
      logger.error('Get user permissions error', {
        operation: 'getUserPermissions',
        requestedBy: req.user?.id,
        targetUserId: req.validatedData?.params?.userId
      }, err as Error);

      error(res, 'Failed to retrieve user permissions', 500);
    }
  };

  /**
   * Get user's access scope
   * GET /api/permissions/scope/:userId
   */
  public getUserAccessScope = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const targetUserId = req.validatedData.params.userId;

      logger.info('Get user access scope request', {
        operation: 'getUserAccessScope',
        requestedBy: req.user.id,
        targetUserId,
        ip: req.clientIp
      });

      const scopeResult = await this.permissionService.getUserAccessScope(targetUserId);

      if (!scopeResult.success) {
        error(res, scopeResult.error);
        return;
      }

      logger.info('User access scope retrieved successfully', {
        operation: 'getUserAccessScope',
        requestedBy: req.user.id,
        targetUserId,
        accessibleHierarchies: scopeResult.data.accessible_hierarchy_ids.length,
        totalAccessibleUsers: scopeResult.data.total_accessible_users
      });

      success(res, scopeResult.data);
    } catch (err) {
      logger.error('Get user access scope error', {
        operation: 'getUserAccessScope',
        requestedBy: req.user?.id,
        targetUserId: req.validatedData?.params?.userId
      }, err as Error);

      error(res, 'Failed to retrieve user access scope', 500);
    }
  };

  /**
   * Get current user's access scope
   * GET /api/permissions/my-scope
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
        totalAccessibleUsers: scopeResult.data.total_accessible_users
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
   * Check if user can access another user
   * POST /api/permissions/check/user-access
   * 
   * @example
   * Request body:
   * {
   *   "target_user_id": "target-user-uuid"
   * }
   */
  public checkUserAccess = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const targetUserId = req.validatedData.body.target_user_id;

      logger.info('Check user access request', {
        operation: 'checkUserAccess',
        requestingUserId: req.user.id,
        targetUserId,
        ip: req.clientIp
      });

      const accessResult = await this.permissionService.canUserAccessUser(
        req.user.id,
        targetUserId
      );

      if (!accessResult.success) {
        error(res, accessResult.error);
        return;
      }

      logger.permission('User access check completed', {
        operation: 'checkUserAccess',
        requestingUserId: req.user.id,
        targetUserId,
        canAccess: accessResult.data.canAccess,
        accessLevel: accessResult.data.accessLevel,
        effectiveRole: accessResult.data.effectiveRole
      });

      success(res, accessResult.data);
    } catch (err) {
      logger.error('Check user access error', {
        operation: 'checkUserAccess',
        requestingUserId: req.user?.id,
        targetUserId: req.validatedData?.body?.target_user_id
      }, err as Error);

      error(res, 'Failed to check user access', 500);
    }
  };

  /**
   * Check if user can access a hierarchy structure
   * POST /api/permissions/check/structure-access
   * 
   * @example
   * Request body:
   * {
   *   "hierarchy_id": "hierarchy-uuid"
   * }
   */
  public checkStructureAccess = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const hierarchyId = req.validatedData.body.hierarchy_id;

      logger.info('Check structure access request', {
        operation: 'checkStructureAccess',
        requestingUserId: req.user.id,
        hierarchyId,
        ip: req.clientIp
      });

      const accessResult = await this.permissionService.canUserAccessStructure(
        req.user.id,
        hierarchyId
      );

      if (!accessResult.success) {
        error(res, accessResult.error);
        return;
      }

      logger.permission('Structure access check completed', {
        operation: 'checkStructureAccess',
        requestingUserId: req.user.id,
        hierarchyId,
        canAccess: accessResult.data.canAccess,
        accessLevel: accessResult.data.accessLevel,
        effectiveRole: accessResult.data.effectiveRole
      });

      success(res, accessResult.data);
    } catch (err) {
      logger.error('Check structure access error', {
        operation: 'checkStructureAccess',
        requestingUserId: req.user?.id,
        hierarchyId: req.validatedData?.body?.hierarchy_id
      }, err as Error);

      error(res, 'Failed to check structure access', 500);
    }
  };

  /**
   * Get accessible users with filters (delegated to QueryController)
   * GET /api/permissions/accessible-users
   * 
   * This endpoint is available here for convenience but the main implementation
   * is in QueryController for better organization
   */
  public getAccessibleUsers = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get accessible users request', {
        operation: 'getAccessibleUsers',
        requestingUserId: req.user.id,
        filters: req.validatedData.query,
        ip: req.clientIp
      });

      const accessibleUsersResult = await this.permissionService.getAccessibleUsers(
        req.user.id,
        req.validatedData.query
      );

      if (!accessibleUsersResult.success) {
        error(res, accessibleUsersResult.error);
        return;
      }

      const { items, total, page, limit, pages } = accessibleUsersResult.data;

      logger.info('Accessible users retrieved successfully', {
        operation: 'getAccessibleUsers',
        requestingUserId: req.user.id,
        totalFound: total,
        page,
        limit
      });

      paginated(res, items, { page, limit, total, pages });
    } catch (err) {
      logger.error('Get accessible users error', {
        operation: 'getAccessibleUsers',
        requestingUserId: req.user?.id
      }, err as Error);

      error(res, 'Failed to retrieve accessible users', 500);
    }
  };

  /**
   * Bulk permission operations
   * POST /api/permissions/bulk
   * 
   * @example
   * Request body:
   * {
   *   "user_ids": ["uuid1", "uuid2", "uuid3"],
   *   "hierarchy_id": "hierarchy-uuid",
   *   "operation": "grant",
   *   "role": "read",
   *   "inherit_to_descendants": true,
   *   "reason": "Project team assignment"
   * }
   */
  public bulkPermissionOperation = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const { user_ids, hierarchy_id, operation, role, inherit_to_descendants, reason } = req.validatedData.body;

      logger.info('Bulk permission operation request', {
        operation: 'bulkPermissionOperation',
        performedBy: req.user.id,
        userCount: user_ids.length,
        hierarchyId: hierarchy_id,
        operationType: operation,
        role,
        reason,
        ip: req.clientIp
      });

      // This would be implemented as a new method in PermissionService
      // For now, return placeholder response
      const results = {
        operation,
        hierarchy_id,
        role,
        inherit_to_descendants,
        requested: user_ids.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
        performed_by: req.user.id,
        performed_at: new Date().toISOString(),
        reason
      };

      logger.permission('Bulk permission operation completed', {
        operation: 'bulkPermissionOperation',
        performedBy: req.user.id,
        results
      });

      success(res, results);
    } catch (err) {
      logger.error('Bulk permission operation error', {
        operation: 'bulkPermissionOperation',
        performedBy: req.user?.id
      }, err as Error);

      error(res, 'Bulk permission operation failed', 500);
    }
  };

  /**
   * Get permission audit log
   * GET /api/permissions/audit
   */
  public getPermissionAudit = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get permission audit request', {
        operation: 'getPermissionAudit',
        requestedBy: req.user.id,
        filters: req.validatedData.query,
        ip: req.clientIp
      });

      // This would be implemented when we have an audit logging system
      // For now, return placeholder response
      const auditResults = {
        audit_logs: [],
        total: 0,
        page: req.validatedData.query?.page || 1,
        limit: req.validatedData.query?.limit || 20,
        filters_applied: req.validatedData.query
      };

      success(res, auditResults);
    } catch (err) {
      logger.error('Get permission audit error', {
        operation: 'getPermissionAudit',
        requestedBy: req.user?.id
      }, err as Error);

      error(res, 'Failed to retrieve permission audit', 500);
    }
  };
}