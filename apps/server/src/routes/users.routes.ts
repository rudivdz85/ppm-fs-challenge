/**
 * User management routes
 * Handles user CRUD operations, search, and profile management
 */

import express from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { requireUserAccess, userIdExtractors } from '../middleware/authorize.middleware';
import { 
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
  userIdParamSchema,
  queryUsersSchema,
  changeUserHierarchySchema,
  userAutocompleteSchema,
  bulkUserOperationSchema,
  userActivityQuerySchema
} from '../validation/user.validation';

const router = express.Router();
const userController = new UserController();

/**
 * GET /api/users
 * Get paginated list of users with filtering and search
 * Requires: Authentication
 * 
 * @example
 * Query parameters:
 * ?page=1&limit=20&search=john&hierarchy_id=uuid&is_active=true&sort_by=full_name&sort_order=asc
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
 *       "is_active": true,
 *       "created_at": "2024-01-01T00:00:00.000Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "total": 100,
 *     "pages": 5
 *   }
 * }
 */
router.get('/',
  authenticate,
  validate({ query: queryUsersSchema }),
  userController.getUsers as any
);

/**
 * GET /api/users/search/autocomplete
 * Search users with autocomplete format (simplified results)
 * Requires: Authentication
 * 
 * @example
 * Query: ?search=john&limit=10&exclude_inactive=true&hierarchy_id=uuid
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "user-uuid",
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "hierarchy_name": "Engineering Team"
 *     }
 *   ]
 * }
 */
router.get('/search/autocomplete',
  authenticate,
  validate({ query: userAutocompleteSchema }),
  userController.searchAutocomplete as any
);

/**
 * PUT /api/users/profile
 * Update current user's profile (self-service)
 * Requires: Authentication
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
 * 
 * Response: Updated user object without password_hash
 */
router.put('/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  userController.updateProfile as any
);

/**
 * POST /api/users/bulk
 * Bulk operations on multiple users
 * Requires: Authentication + Manager/Admin permissions
 * 
 * @example
 * Request body:
 * {
 *   "user_ids": ["uuid1", "uuid2", "uuid3"],
 *   "operation": "activate",
 *   "reason": "Bulk reactivation for new project"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "operation": "activate",
 *     "requested": 3,
 *     "successful": 2,
 *     "failed": 1,
 *     "errors": ["User uuid3 not found"]
 *   }
 * }
 */
router.post('/bulk',
  authenticate,
  validate({ body: bulkUserOperationSchema }),
  userController.bulkOperation as any
);

/**
 * GET /api/users/:id
 * Get single user by ID
 * Requires: Authentication + Access to target user
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user-uuid",
 *     "email": "john@example.com",
 *     "full_name": "John Doe",
 *     "base_hierarchy_id": "hierarchy-uuid",
 *     "hierarchy_path": "Company.Engineering.Backend",
 *     "is_active": true,
 *     "phone": "+1234567890",
 *     "metadata": { "department": "Engineering" },
 *     "created_at": "2024-01-01T00:00:00.000Z",
 *     "updated_at": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.get('/:id',
  authenticate,
  validate({ params: userIdParamSchema }),
  requireUserAccess(userIdExtractors.fromParams as any),
  userController.getUser as any
);

/**
 * POST /api/users
 * Create new user
 * Requires: Authentication + Manager/Admin permissions
 * 
 * @example
 * Request body:
 * {
 *   "email": "newuser@example.com",
 *   "password": "SecurePass123!",
 *   "full_name": "Jane Doe",
 *   "base_hierarchy_id": "hierarchy-uuid",
 *   "phone": "+1234567890",
 *   "metadata": { "department": "Engineering" }
 * }
 * 
 * Response: Created user object without password_hash
 */
router.post('/',
  authenticate,
  validate({ body: createUserSchema }),
  userController.createUser as any
);

/**
 * PUT /api/users/:id
 * Update user information
 * Requires: Authentication + Access to target user + Manager/Admin permissions
 * 
 * @example
 * Request body:
 * {
 *   "full_name": "John Smith",
 *   "phone": "+1234567890",
 *   "is_active": true,
 *   "metadata": { "department": "Marketing" }
 * }
 * 
 * Response: Updated user object without password_hash
 */
router.put('/:id',
  authenticate,
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  requireUserAccess(userIdExtractors.fromParams as any),
  userController.updateUser as any
);

/**
 * DELETE /api/users/:id
 * Deactivate user (soft delete)
 * Requires: Authentication + Access to target user + Manager/Admin permissions
 * Note: Users cannot delete themselves
 * 
 * Response: 204 No Content
 */
router.delete('/:id',
  authenticate,
  validate({ params: userIdParamSchema }),
  requireUserAccess(userIdExtractors.fromParams as any),
  userController.deleteUser as any
);

/**
 * PUT /api/users/:id/hierarchy
 * Change user's hierarchy structure
 * Requires: Authentication + Access to target user + Admin permissions
 * 
 * @example
 * Request body:
 * {
 *   "new_hierarchy_id": "new-hierarchy-uuid"
 * }
 * 
 * Response: Updated user object with new hierarchy
 */
router.put('/:id/hierarchy',
  authenticate,
  validate({ params: userIdParamSchema, body: changeUserHierarchySchema }),
  requireUserAccess(userIdExtractors.fromParams as any),
  userController.changeUserHierarchy as any
);

/**
 * GET /api/users/:id/activity
 * Get user activity log
 * Requires: Authentication + Access to target user
 * 
 * @example
 * Query: ?page=1&limit=20&activity_type=login&date_from=2024-01-01
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user_id": "user-uuid",
 *     "activities": [
 *       {
 *         "id": "activity-uuid",
 *         "type": "login",
 *         "timestamp": "2024-01-01T12:00:00.000Z",
 *         "details": { "ip": "192.168.1.1" }
 *       }
 *     ],
 *     "total": 50,
 *     "page": 1,
 *     "limit": 20
 *   }
 * }
 */
router.get('/:id/activity',
  authenticate,
  validate({ params: userIdParamSchema, query: userActivityQuerySchema }),
  requireUserAccess(userIdExtractors.fromParams as any),
  userController.getUserActivity as any
);

export default router;