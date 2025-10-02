/**
 * Authorization middleware
 * Checks if authenticated users have permission to access specific resources
 */

import { Request, Response, NextFunction } from 'express';
import { PermissionService } from '../services/permission.service';
import { HierarchyService } from '../services/hierarchy.service';
import { UserRepository, HierarchyRepository, PermissionRepository } from '../repositories';
import { createServiceLogger } from '../services/utils/logger';
import { PermissionRole } from '@ppm/types';

const logger = createServiceLogger('AuthorizeMiddleware');

// Lazy initialization of services to avoid circular dependencies
let permissionService: PermissionService | null = null;
let hierarchyService: HierarchyService | null = null;

/**
 * Initialize services with repositories
 * This is called once when middleware is first used
 */
function initializeServices(): void {
  if (!permissionService || !hierarchyService) {
    const userRepo = new UserRepository();
    const hierarchyRepo = new HierarchyRepository();
    const permissionRepo = new PermissionRepository();
    
    permissionService = new PermissionService(userRepo, hierarchyRepo, permissionRepo);
    hierarchyService = new HierarchyService(hierarchyRepo, userRepo);
  }
}

/**
 * Function type to extract structure/hierarchy ID from request
 */
type StructureIdExtractor = (req: Request) => string | undefined;

/**
 * Function type to extract user ID from request (for user-specific authorization)
 */
type UserIdExtractor = (req: Request) => string | undefined;

/**
 * Authorization result interface
 */
interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
  accessLevel?: 'direct' | 'inherited';
  effectiveRole?: PermissionRole;
}

/**
 * Require permission to access a specific hierarchy structure
 * 
 * @param getStructureId - Function to extract structure ID from request
 * @param minRole - Minimum required role (optional)
 * 
 * @example
 * ```typescript
 * // Check permission for structure ID in URL params
 * app.get('/structures/:id', 
 *   authenticate,
 *   requirePermission(req => req.params.id),
 *   getStructure
 * );
 * 
 * // Check permission for structure ID in request body
 * app.post('/users',
 *   authenticate,
 *   requirePermission(req => req.body.hierarchy_id, 'manager'),
 *   createUser
 * );
 * ```
 */
export const requirePermission = (
  getStructureId: StructureIdExtractor,
  minRole?: PermissionRole
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required.',
            code: 'AUTH_REQUIRED',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Initialize services if needed
      initializeServices();

      // Extract structure ID from request
      const structureId = getStructureId(req);
      
      if (!structureId) {
        logger.warn('Authorization failed - no structure ID provided', {
          operation: 'requirePermission',
          userId: req.user.id,
          path: req.path,
          method: req.method
        });

        res.status(400).json({
          success: false,
          error: {
            message: 'Structure ID is required for this operation.',
            code: 'STRUCTURE_ID_REQUIRED',
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if user can access the structure
      const accessResult = await permissionService!.canUserAccessStructure(
        req.user.id,
        structureId
      );

      if (!accessResult.success) {
        logger.error('Authorization check failed', {
          operation: 'requirePermission',
          userId: req.user.id,
          structureId,
          path: req.path
        });

        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to check permissions.',
            code: 'PERMISSION_CHECK_FAILED',
            statusCode: 500
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!accessResult.data.canAccess) {
        logger.warn('Authorization denied - no access to structure', {
          operation: 'requirePermission',
          userId: req.user.id,
          structureId,
          reason: accessResult.data.reason,
          path: req.path,
          method: req.method
        });

        res.status(403).json({
          success: false,
          error: {
            message: 'Access denied. You do not have permission to access this resource.',
            code: 'ACCESS_DENIED',
            statusCode: 403,
            details: {
              reason: accessResult.data.reason,
              structureId
            }
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check minimum role requirement if specified
      if (minRole && accessResult.data.effectiveRole) {
        const roleHierarchy = { 'read': 1, 'manager': 2, 'admin': 3 };
        const userRoleLevel = roleHierarchy[accessResult.data.effectiveRole];
        const requiredRoleLevel = roleHierarchy[minRole];

        if (userRoleLevel < requiredRoleLevel) {
          logger.warn('Authorization denied - insufficient role', {
            operation: 'requirePermission',
            userId: req.user.id,
            structureId,
            userRole: accessResult.data.effectiveRole,
            requiredRole: minRole,
            path: req.path,
            method: req.method
          });

          res.status(403).json({
            success: false,
            error: {
              message: `Access denied. ${minRole} role or higher required.`,
              code: 'INSUFFICIENT_ROLE',
              statusCode: 403,
              details: {
                requiredRole: minRole,
                userRole: accessResult.data.effectiveRole,
                structureId
              }
            },
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      // Attach authorization info to request for use in controllers
      req.authorization = {
        structureId,
        accessLevel: accessResult.data.accessLevel || 'direct',
        effectiveRole: accessResult.data.effectiveRole || 'read',
        canAccess: true
      };

      logger.info('Authorization successful', {
        operation: 'requirePermission',
        userId: req.user.id,
        structureId,
        accessLevel: accessResult.data.accessLevel,
        effectiveRole: accessResult.data.effectiveRole,
        path: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      logger.error('Authorization error', {
        operation: 'requirePermission',
        userId: req.user?.id,
        path: req.path
      }, error as Error);

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal authorization error.',
          code: 'AUTHORIZATION_ERROR',
          statusCode: 500
        },
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Require permission to access a specific user
 * 
 * @param getUserId - Function to extract target user ID from request
 * 
 * @example
 * ```typescript
 * // Check permission to access user by ID in URL params
 * app.get('/users/:id',
 *   authenticate,
 *   requireUserAccess(req => req.params.id),
 *   getUser
 * );
 * ```
 */
export const requireUserAccess = (getUserId: UserIdExtractor) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required.',
            code: 'AUTH_REQUIRED',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      initializeServices();

      const targetUserId = getUserId(req);
      
      if (!targetUserId) {
        res.status(400).json({
          success: false,
          error: {
            message: 'User ID is required for this operation.',
            code: 'USER_ID_REQUIRED',
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if user can access the target user
      const accessResult = await permissionService!.canUserAccessUser(
        req.user.id,
        targetUserId
      );

      if (!accessResult.success) {
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to check user access permissions.',
            code: 'USER_ACCESS_CHECK_FAILED',
            statusCode: 500
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!accessResult.data.canAccess) {
        logger.warn('User access denied', {
          operation: 'requireUserAccess',
          requestingUserId: req.user.id,
          targetUserId,
          reason: accessResult.data.reason,
          path: req.path
        });

        res.status(403).json({
          success: false,
          error: {
            message: 'Access denied. You do not have permission to access this user.',
            code: 'USER_ACCESS_DENIED',
            statusCode: 403,
            details: {
              reason: accessResult.data.reason,
              targetUserId
            }
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Attach user access info to request
      req.userAuthorization = {
        targetUserId,
        accessLevel: accessResult.data.accessLevel || 'direct',
        effectiveRole: accessResult.data.effectiveRole || 'read',
        canAccess: true
      };

      logger.info('User access authorization successful', {
        operation: 'requireUserAccess',
        requestingUserId: req.user.id,
        targetUserId,
        accessLevel: accessResult.data.accessLevel,
        effectiveRole: accessResult.data.effectiveRole
      });

      next();
    } catch (error) {
      logger.error('User access authorization error', {
        operation: 'requireUserAccess',
        userId: req.user?.id,
        path: req.path
      }, error as Error);

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal user access authorization error.',
          code: 'USER_AUTHORIZATION_ERROR',
          statusCode: 500
        },
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Require specific role level
 * 
 * @param role - Required role level
 * 
 * @example
 * ```typescript
 * // Require admin role
 * app.delete('/structures/:id',
 *   authenticate,
 *   requireRole('admin'),
 *   deleteStructure
 * );
 * ```
 */
export const requireRole = (role: PermissionRole) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required.',
            code: 'AUTH_REQUIRED',
            statusCode: 401
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      initializeServices();

      // Get user's permissions
      const userAccessScope = await permissionService!.getUserAccessScope(req.user.id);

      if (!userAccessScope.success) {
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to check user role.',
            code: 'ROLE_CHECK_FAILED',
            statusCode: 500
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if user has the required role in any hierarchy
      const roleHierarchy = { 'read': 1, 'manager': 2, 'admin': 3 };
      const requiredRoleLevel = roleHierarchy[role];

      const hasRequiredRole = userAccessScope.data.direct_permissions.some(permission => {
        const userRoleLevel = roleHierarchy[permission.role];
        return userRoleLevel >= requiredRoleLevel;
      });

      if (!hasRequiredRole) {
        logger.warn('Role authorization denied', {
          operation: 'requireRole',
          userId: req.user.id,
          requiredRole: role,
          userRoles: userAccessScope.data.direct_permissions.map(p => p.role),
          path: req.path
        });

        res.status(403).json({
          success: false,
          error: {
            message: `Access denied. ${role} role or higher required.`,
            code: 'INSUFFICIENT_GLOBAL_ROLE',
            statusCode: 403,
            details: {
              requiredRole: role
            }
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info('Role authorization successful', {
        operation: 'requireRole',
        userId: req.user.id,
        requiredRole: role,
        path: req.path
      });

      next();
    } catch (error) {
      logger.error('Role authorization error', {
        operation: 'requireRole',
        userId: req.user?.id,
        requiredRole: role,
        path: req.path
      }, error as Error);

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal role authorization error.',
          code: 'ROLE_AUTHORIZATION_ERROR',
          statusCode: 500
        },
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Common structure ID extractors for convenience
 */
export const structureIdExtractors = {
  fromParams: (paramName: string = 'id') => (req: Request) => req.params[paramName],
  fromBody: (fieldName: string = 'hierarchy_id') => (req: Request) => req.body?.[fieldName],
  fromQuery: (paramName: string = 'hierarchy_id') => (req: Request) => req.query[paramName] as string,
  fromValidatedBody: (fieldName: string = 'hierarchy_id') => (req: Request) => req.validatedData?.body?.[fieldName],
  fromValidatedParams: (paramName: string = 'id') => (req: Request) => req.validatedData?.params?.[paramName]
};

/**
 * Common user ID extractors for convenience
 */
export const userIdExtractors = {
  fromParams: (paramName: string = 'id') => (req: Request) => req.params[paramName],
  fromBody: (fieldName: string = 'user_id') => (req: Request) => req.body?.[fieldName],
  fromQuery: (paramName: string = 'user_id') => (req: Request) => req.query[paramName] as string,
  fromValidatedBody: (fieldName: string = 'user_id') => (req: Request) => req.validatedData?.body?.[fieldName],
  fromValidatedParams: (paramName: string = 'id') => (req: Request) => req.validatedData?.params?.[paramName]
};

// Extend Express Request interface for authorization data
declare global {
  namespace Express {
    interface Request {
      authorization?: {
        structureId: string;
        accessLevel: 'direct' | 'inherited';
        effectiveRole: PermissionRole;
        canAccess: boolean;
      };
      userAuthorization?: {
        targetUserId: string;
        accessLevel: 'direct' | 'inherited';
        effectiveRole: PermissionRole;
        canAccess: boolean;
      };
    }
  }
}