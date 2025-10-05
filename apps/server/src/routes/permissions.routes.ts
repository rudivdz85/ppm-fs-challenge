/**
 * Permission management routes
 * Handles permission granting, revoking, and access control operations
 */

import express from 'express';
import { PermissionController } from '../controllers/permission.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { requireUserAccess, userIdExtractors } from '../middleware/authorize.middleware';
import { 
  grantPermissionSchema,
  updatePermissionSchema,
  permissionIdParamSchema,
  userIdParamSchema,
  checkUserAccessSchema,
  checkStructureAccessSchema,
  accessibleUsersQuerySchema,
  bulkPermissionOperationSchema,
  permissionAuditQuerySchema
} from '../validation/permission.validation';

const router = express.Router();
const permissionController = new PermissionController();

/**
 * POST /api/permissions
 * Grant permission to user
 * Requires: Authentication + Manager/Admin permissions for target hierarchy
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
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "permission-uuid",
 *     "user_id": "user-uuid",
 *     "hierarchy_id": "hierarchy-uuid",
 *     "role": "manager",
 *     "inherit_to_descendants": true,
 *     "granted_by": "granter-uuid",
 *     "granted_at": "2024-01-01T12:00:00.000Z",
 *     "expires_at": "2024-12-31T23:59:59Z"
 *   }
 * }
 */
router.post('/',
  authenticate,
  validate({ body: grantPermissionSchema }),
  permissionController.grantPermission as any
);

/**
 * PUT /api/permissions/:id
 * Update existing permission
 * Requires: Authentication + Manager/Admin permissions for target hierarchy
 * 
 * @example
 * Request body:
 * {
 *   "role": "admin",
 *   "inherit_to_descendants": false,
 *   "expires_at": "2025-12-31T23:59:59Z",
 *   "metadata": { "updated_reason": "Role promotion" }
 * }
 * 
 * Response: Updated permission object
 */
router.put('/:id',
  authenticate,
  validate({ params: permissionIdParamSchema, body: updatePermissionSchema }),
  permissionController.updatePermission as any
);

/**
 * DELETE /api/permissions/:id
 * Revoke permission
 * Requires: Authentication + Manager/Admin permissions for target hierarchy
 * 
 * Response: 204 No Content
 */
router.delete('/:id',
  authenticate,
  validate({ params: permissionIdParamSchema }),
  permissionController.revokePermission as any
);

/**
 * GET /api/permissions/user/:userId
 * Get all permissions for a specific user
 * Requires: Authentication + Access to target user
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "permission-uuid",
 *       "hierarchy_id": "hierarchy-uuid",
 *       "hierarchy_name": "Engineering Team",
 *       "hierarchy_path": "Company.Engineering.Backend",
 *       "role": "manager",
 *       "inherit_to_descendants": true,
 *       "granted_by": "granter-uuid",
 *       "granted_at": "2024-01-01T12:00:00.000Z",
 *       "expires_at": "2024-12-31T23:59:59Z",
 *       "is_active": true
 *     }
 *   ]
 * }
 */
router.get('/user/:userId',
  authenticate,
  validate({ params: userIdParamSchema }),
  requireUserAccess(userIdExtractors.fromParams('userId')),
  permissionController.getUserPermissions as any
);

/**
 * GET /api/permissions/scope/:userId
 * Get user's access scope (all accessible hierarchies and user counts)
 * Requires: Authentication + Access to target user
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user_id": "user-uuid",
 *     "accessible_hierarchy_ids": ["uuid1", "uuid2", "uuid3"],
 *     "total_accessible_users": 150,
 *     "effective_roles": {
 *       "hierarchy-uuid1": "manager",
 *       "hierarchy-uuid2": "read"
 *     },
 *     "hierarchy_details": [
 *       {
 *         "id": "hierarchy-uuid1",
 *         "name": "Engineering Team",
 *         "path": "Company.Engineering",
 *         "user_count": 45,
 *         "role": "manager"
 *       }
 *     ]
 *   }
 * }
 */
router.get('/scope/:userId',
  authenticate,
  validate({ params: userIdParamSchema }),
  requireUserAccess(userIdExtractors.fromParams('userId')),
  permissionController.getUserAccessScope as any
);

/**
 * GET /api/permissions/my-scope
 * Get current user's access scope
 * Requires: Authentication
 * 
 * Response: Same as /scope/:userId but for current user
 */
router.get('/my-scope',
  authenticate,
  permissionController.getMyAccessScope as any
);

/**
 * POST /api/permissions/check/user-access
 * Check if current user can access another user
 * Requires: Authentication
 * 
 * @example
 * Request body:
 * {
 *   "target_user_id": "target-user-uuid"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "canAccess": true,
 *     "accessLevel": "direct",
 *     "effectiveRole": "manager",
 *     "reason": "Direct permission in hierarchy",
 *     "hierarchy_path": "Company.Engineering.Backend"
 *   }
 * }
 */
router.post('/check/user-access',
  authenticate,
  validate({ body: checkUserAccessSchema }),
  permissionController.checkUserAccess as any
);

/**
 * POST /api/permissions/check/structure-access
 * Check if current user can access a hierarchy structure
 * Requires: Authentication
 * 
 * @example
 * Request body:
 * {
 *   "hierarchy_id": "hierarchy-uuid"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "canAccess": true,
 *     "accessLevel": "inherited",
 *     "effectiveRole": "read",
 *     "reason": "Inherited from parent hierarchy",
 *     "parent_hierarchy_path": "Company.Engineering"
 *   }
 * }
 */
router.post('/check/structure-access',
  authenticate,
  validate({ body: checkStructureAccessSchema }),
  permissionController.checkStructureAccess as any
);

/**
 * GET /api/permissions/accessible-users
 * Get users accessible to current user with filtering
 * Requires: Authentication
 * 
 * @example
 * Query parameters:
 * ?page=1&limit=20&search=john&hierarchy_id=uuid&role=manager&is_active=true
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "user-uuid",
 *       "email": "john@example.com",
 *       "full_name": "John Doe",
 *       "hierarchy_name": "Engineering Team",
 *       "access_level": "direct",
 *       "effective_role": "manager"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "total": 150,
 *     "pages": 8
 *   }
 * }
 */
router.get('/accessible-users',
  authenticate,
  validate({ query: accessibleUsersQuerySchema }),
  permissionController.getAccessibleUsers as any
);

/**
 * POST /api/permissions/bulk
 * Bulk permission operations
 * Requires: Authentication + Manager/Admin permissions
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
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "operation": "grant",
 *     "hierarchy_id": "hierarchy-uuid",
 *     "role": "read",
 *     "requested": 3,
 *     "successful": 2,
 *     "failed": 1,
 *     "errors": ["User uuid3 already has higher permissions"],
 *     "performed_by": "admin-uuid",
 *     "performed_at": "2024-01-01T12:00:00.000Z"
 *   }
 * }
 */
router.post('/bulk',
  authenticate,
  validate({ body: bulkPermissionOperationSchema }),
  permissionController.bulkPermissionOperation as any
);

/**
 * GET /api/permissions/audit
 * Get permission audit log
 * Requires: Authentication + Admin permissions
 * 
 * @example
 * Query parameters:
 * ?page=1&limit=20&user_id=uuid&action=grant&date_from=2024-01-01&date_to=2024-01-31
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "audit_logs": [
 *       {
 *         "id": "audit-uuid",
 *         "action": "grant",
 *         "target_user_id": "user-uuid",
 *         "target_user_email": "user@example.com",
 *         "hierarchy_id": "hierarchy-uuid",
 *         "hierarchy_name": "Engineering Team",
 *         "role": "manager",
 *         "performed_by": "admin-uuid",
 *         "performed_by_email": "admin@example.com",
 *         "performed_at": "2024-01-01T12:00:00.000Z",
 *         "details": { "reason": "Project assignment" }
 *       }
 *     ],
 *     "total": 100,
 *     "page": 1,
 *     "limit": 20,
 *     "filters_applied": {
 *       "action": "grant",
 *       "date_range": "2024-01-01 to 2024-01-31"
 *     }
 *   }
 * }
 */
router.get('/audit',
  authenticate,
  validate({ query: permissionAuditQuerySchema }),
  permissionController.getPermissionAudit as any
);

export default router;