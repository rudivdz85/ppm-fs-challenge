/**
 * Hierarchy management routes
 * Handles organizational hierarchy structure operations
 */

import express from 'express';
import { HierarchyController } from '../controllers/hierarchy.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { requirePermission, structureIdExtractors } from '../middleware/authorize.middleware';
import { 
  createHierarchySchema,
  updateHierarchySchema,
  hierarchyIdParamSchema,
  queryHierarchiesSchema,
  getHierarchyTreeSchema,
  moveHierarchySchema,
  validateHierarchyIntegritySchema,
  bulkHierarchyOperationSchema,
  hierarchyDescendantsQuerySchema
} from '../validation/hierarchy.validation';

const router = express.Router();
const hierarchyController = new HierarchyController();

/**
 * GET /api/hierarchy
 * Get paginated list of hierarchy structures with filtering
 * Requires: Authentication
 * 
 * @example
 * Query parameters:
 * ?page=1&limit=20&search=engineering&is_active=true&parent_id=uuid&depth=2
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "hierarchy-uuid",
 *       "name": "Engineering Department",
 *       "path": "Company.Engineering",
 *       "parent_id": "company-uuid",
 *       "depth": 2,
 *       "is_active": true,
 *       "user_count": 45,
 *       "child_count": 5,
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
  validate({ query: queryHierarchiesSchema }),
  hierarchyController.getHierarchies
);

/**
 * GET /api/hierarchy/tree
 * Get hierarchy tree structure (nested format)
 * Requires: Authentication
 * 
 * @example
 * Query parameters:
 * ?root_id=uuid&max_depth=5&include_inactive=false&include_user_counts=true
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "root-uuid",
 *     "name": "Company",
 *     "path": "Company",
 *     "depth": 1,
 *     "user_count": 2500,
 *     "children": [
 *       {
 *         "id": "eng-uuid",
 *         "name": "Engineering",
 *         "path": "Company.Engineering",
 *         "depth": 2,
 *         "user_count": 450,
 *         "children": [
 *           {
 *             "id": "backend-uuid",
 *             "name": "Backend Team",
 *             "path": "Company.Engineering.Backend",
 *             "depth": 3,
 *             "user_count": 120,
 *             "children": []
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */
router.get('/tree',
  authenticate,
  validate({ query: getHierarchyTreeSchema }),
  hierarchyController.getHierarchyTree
);

/**
 * POST /api/hierarchy/validate-integrity
 * Validate hierarchy integrity and detect issues
 * Requires: Authentication + Admin permissions
 * 
 * @example
 * Request body:
 * {
 *   "check_types": ["orphaned_nodes", "circular_references", "invalid_paths"],
 *   "fix_issues": false
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "is_valid": false,
 *     "issues_found": [
 *       {
 *         "type": "orphaned_node",
 *         "hierarchy_id": "orphan-uuid",
 *         "description": "Node has invalid parent reference",
 *         "severity": "high"
 *       }
 *     ],
 *     "statistics": {
 *       "total_nodes": 100,
 *       "valid_nodes": 98,
 *       "issues_count": 2
 *     },
 *     "recommendations": [
 *       "Fix orphaned nodes by reassigning to valid parents",
 *       "Run integrity check monthly"
 *     ]
 *   }
 * }
 */
router.post('/validate-integrity',
  authenticate,
  validate({ body: validateHierarchyIntegritySchema }),
  hierarchyController.validateHierarchyIntegrity
);

/**
 * POST /api/hierarchy/bulk
 * Bulk operations on hierarchy structures
 * Requires: Authentication + Admin permissions
 * 
 * @example
 * Request body:
 * {
 *   "hierarchy_ids": ["uuid1", "uuid2", "uuid3"],
 *   "operation": "activate",
 *   "reason": "Quarterly reactivation"
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
 *     "errors": ["Hierarchy uuid3 has active users and cannot be deactivated"],
 *     "performed_by": "admin-uuid",
 *     "performed_at": "2024-01-01T12:00:00.000Z"
 *   }
 * }
 */
router.post('/bulk',
  authenticate,
  validate({ body: bulkHierarchyOperationSchema }),
  hierarchyController.bulkHierarchyOperation
);

/**
 * GET /api/hierarchy/:id
 * Get single hierarchy structure by ID
 * Requires: Authentication + Access to structure
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "hierarchy-uuid",
 *     "name": "Engineering Department",
 *     "description": "Main engineering department",
 *     "path": "Company.Engineering",
 *     "parent_id": "company-uuid",
 *     "depth": 2,
 *     "is_active": true,
 *     "user_count": 45,
 *     "direct_user_count": 12,
 *     "child_count": 5,
 *     "metadata": { "budget": 500000, "manager": "eng-manager-uuid" },
 *     "created_at": "2024-01-01T00:00:00.000Z",
 *     "updated_at": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 */
router.get('/:id',
  authenticate,
  validate({ params: hierarchyIdParamSchema }),
  requirePermission(structureIdExtractors.fromParams),
  hierarchyController.getHierarchy
);

/**
 * POST /api/hierarchy
 * Create new hierarchy structure
 * Requires: Authentication + Manager/Admin permissions for parent structure
 * 
 * @example
 * Request body:
 * {
 *   "name": "Frontend Team",
 *   "description": "Frontend development team",
 *   "parent_id": "engineering-uuid",
 *   "metadata": {
 *     "tech_stack": "React, TypeScript",
 *     "team_lead": "frontend-lead-uuid"
 *   }
 * }
 * 
 * Response: Created hierarchy object with generated path
 */
router.post('/',
  authenticate,
  validate({ body: createHierarchySchema }),
  hierarchyController.createHierarchy
);

/**
 * PUT /api/hierarchy/:id
 * Update hierarchy structure
 * Requires: Authentication + Manager/Admin permissions for structure
 * 
 * @example
 * Request body:
 * {
 *   "name": "Updated Engineering Department",
 *   "description": "Updated description",
 *   "is_active": true,
 *   "metadata": {
 *     "budget": 600000,
 *     "updated_reason": "Budget increase"
 *   }
 * }
 * 
 * Response: Updated hierarchy object
 */
router.put('/:id',
  authenticate,
  validate({ params: hierarchyIdParamSchema, body: updateHierarchySchema }),
  requirePermission(structureIdExtractors.fromParams, 'manager'),
  hierarchyController.updateHierarchy
);

/**
 * DELETE /api/hierarchy/:id
 * Delete hierarchy structure (soft delete if has users/children)
 * Requires: Authentication + Admin permissions for structure
 * 
 * Note: Structure can only be hard deleted if it has no users or child structures
 * Otherwise it will be soft deleted (deactivated)
 * 
 * Response: 204 No Content
 */
router.delete('/:id',
  authenticate,
  validate({ params: hierarchyIdParamSchema }),
  requirePermission(structureIdExtractors.fromParams, 'admin'),
  hierarchyController.deleteHierarchy
);

/**
 * POST /api/hierarchy/:id/move
 * Move hierarchy structure to new parent
 * Requires: Authentication + Admin permissions for both source and target
 * 
 * @example
 * Request body:
 * {
 *   "new_parent_id": "new-parent-uuid"
 * }
 * 
 * Response: Updated hierarchy object with new path
 */
router.post('/:id/move',
  authenticate,
  validate({ params: hierarchyIdParamSchema, body: moveHierarchySchema }),
  requirePermission(structureIdExtractors.fromParams, 'admin'),
  hierarchyController.moveHierarchy
);

/**
 * GET /api/hierarchy/:id/descendants
 * Get all descendants of a hierarchy structure
 * Requires: Authentication + Access to structure
 * 
 * @example
 * Query parameters:
 * ?max_depth=3&include_users=true&include_inactive=false&format=tree
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "child-uuid",
 *       "name": "Backend Team",
 *       "path": "Company.Engineering.Backend",
 *       "depth": 3,
 *       "parent_id": "engineering-uuid",
 *       "user_count": 25,
 *       "users": [
 *         {
 *           "id": "user-uuid",
 *           "full_name": "John Doe",
 *           "email": "john@company.com"
 *         }
 *       ]
 *     }
 *   ],
 *   "meta": {
 *     "total_descendants": 15,
 *     "max_depth_reached": 4,
 *     "total_users": 150
 *   }
 * }
 */
router.get('/:id/descendants',
  authenticate,
  validate({ params: hierarchyIdParamSchema, query: hierarchyDescendantsQuerySchema }),
  requirePermission(structureIdExtractors.fromParams),
  hierarchyController.getHierarchyDescendants
);

/**
 * GET /api/hierarchy/:id/ancestors
 * Get all ancestors (parent path) of a hierarchy structure
 * Requires: Authentication + Access to structure
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "company-uuid",
 *       "name": "Company",
 *       "path": "Company",
 *       "depth": 1
 *     },
 *     {
 *       "id": "engineering-uuid",
 *       "name": "Engineering",
 *       "path": "Company.Engineering",
 *       "depth": 2
 *     }
 *   ],
 *   "meta": {
 *     "total_ancestors": 2,
 *     "root_hierarchy": "company-uuid"
 *   }
 * }
 */
router.get('/:id/ancestors',
  authenticate,
  validate({ params: hierarchyIdParamSchema }),
  requirePermission(structureIdExtractors.fromParams),
  hierarchyController.getHierarchyAncestors
);

/**
 * GET /api/hierarchy/:id/users
 * Get all users in a hierarchy structure (including descendants)
 * Requires: Authentication + Access to structure
 * 
 * @example
 * Query parameters:
 * ?include_descendants=true&is_active=true&page=1&limit=20
 * 
 * Response: Paginated list of users in the hierarchy
 */
router.get('/:id/users',
  authenticate,
  validate({ params: hierarchyIdParamSchema, query: queryUsersSchema }),
  requirePermission(structureIdExtractors.fromParams),
  hierarchyController.getHierarchyUsers
);

export default router;