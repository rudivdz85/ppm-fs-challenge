/**
 * Query routes - Core feature for advanced user queries
 * Handles complex user queries with analytics and filtering capabilities
 */

import express from 'express';
import { QueryController } from '../controllers/query.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { 
  queryUsersSchema,
  queryAnalyticsSchema,
  queryHierarchyStatsSchema,
  queryPermissionInsightsSchema,
  queryScopeComparisonSchema
} from '../validation/query.validation';

const router = express.Router();
const queryController = new QueryController();

/**
 * @swagger
 * /query/users:
 *   post:
 *     tags:
 *       - Query
 *     summary: Query users (Core Feature)
 *     description: |
 *       Execute complex user queries with advanced filtering, analytics, and hierarchical access control.
 *       This is the core feature of the system, allowing sophisticated user searches across organizational hierarchies.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hierarchy_filters:
 *                 type: object
 *                 properties:
 *                   include_paths:
 *                     type: array
 *                     items:
 *                       type: string
 *                   exclude_paths:
 *                     type: array
 *                     items:
 *                       type: string
 *                   depth_range:
 *                     type: object
 *                     properties:
 *                       min:
 *                         type: integer
 *                       max:
 *                         type: integer
 *               user_filters:
 *                 type: object
 *                 properties:
 *                   is_active:
 *                     type: boolean
 *                   search:
 *                     type: string
 *                   email_domain:
 *                     type: string
 *               output_options:
 *                 type: object
 *                 properties:
 *                   include_hierarchy_info:
 *                     type: boolean
 *                   include_permission_summary:
 *                     type: boolean
 *                   include_analytics:
 *                     type: boolean
 *               pagination:
 *                 type: object
 *                 properties:
 *                   page:
 *                     type: integer
 *                   limit:
 *                     type: integer
 *     responses:
 *       200:
 *         description: Query executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     meta:
 *                       type: object
 *                       description: Query analytics and execution details
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/users',
  authenticate,
  validate({ body: queryUsersSchema }),
  queryController.queryUsers as any
);

/**
 * GET /api/query/analytics
 * Get detailed analytics and insights about user distribution
 * Requires: Authentication
 * 
 * @example
 * Query parameters:
 * ?hierarchy_id=uuid&include_trends=true&period=30d&breakdown_by=role,hierarchy
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "overview": {
 *       "total_users": 2500,
 *       "active_users": 2200,
 *       "total_hierarchies": 25,
 *       "total_permissions": 8500
 *     },
 *     "hierarchy_breakdown": {
 *       "Company.Engineering": {
 *         "total_users": 450,
 *         "active_users": 420,
 *         "role_distribution": {
 *           "admin": 5,
 *           "manager": 45,
 *           "read": 400
 *         }
 *       }
 *     },
 *     "trends": {
 *       "period": "30d",
 *       "user_growth": "+15",
 *       "permission_changes": 125,
 *       "most_active_hierarchy": "Company.Engineering"
 *     },
 *     "insights": {
 *       "overprivileged_users": 12,
 *       "underprivileged_users": 45,
 *       "orphaned_hierarchies": 2,
 *       "recommendations": [
 *         "Consider reviewing admin permissions in Engineering",
 *         "Add permissions for 45 users without access"
 *       ]
 *     }
 *   }
 * }
 */
router.get('/analytics',
  authenticate,
  validate({ query: queryAnalyticsSchema }),
  queryController.getAnalytics as any
);

/**
 * GET /api/query/my-scope
 * Get current user's access scope and statistics
 * Requires: Authentication
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user_id": "user-uuid",
 *     "accessible_hierarchy_ids": ["uuid1", "uuid2"],
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
 *         "user_count": 100,
 *         "role": "manager",
 *         "granted_at": "2024-01-01T00:00:00.000Z"
 *       }
 *     ],
 *     "capabilities": {
 *       "can_grant_permissions": true,
 *       "can_create_users": true,
 *       "can_modify_hierarchy": false,
 *       "max_accessible_depth": 5
 *     }
 *   }
 * }
 */
router.get('/my-scope',
  authenticate,
  queryController.getMyAccessScope as any
);

/**
 * GET /api/query/hierarchy-stats
 * Get statistics for hierarchy structures
 * Requires: Authentication
 * 
 * @example
 * Query parameters:
 * ?hierarchy_id=uuid&include_descendants=true&role_breakdown=true
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "hierarchy_id": "hierarchy-uuid",
 *     "name": "Engineering",
 *     "path": "Company.Engineering",
 *     "statistics": {
 *       "direct_users": 25,
 *       "total_users_including_descendants": 150,
 *       "direct_permissions": 30,
 *       "inherited_permissions": 200,
 *       "child_hierarchies": 5,
 *       "max_depth": 3
 *     },
 *     "role_breakdown": {
 *       "admin": 2,
 *       "manager": 8,
 *       "read": 140
 *     },
 *     "descendants": [
 *       {
 *         "id": "child-uuid",
 *         "name": "Backend Team",
 *         "path": "Company.Engineering.Backend",
 *         "user_count": 45,
 *         "permission_count": 60
 *       }
 *     ]
 *   }
 * }
 */
router.get('/hierarchy-stats',
  authenticate,
  validate({ query: queryHierarchyStatsSchema }),
  queryController.getHierarchyStats as any
);

/**
 * GET /api/query/permission-insights
 * Get insights about permission distribution and patterns
 * Requires: Authentication + Manager/Admin permissions
 * 
 * @example
 * Query parameters:
 * ?analysis_type=distribution&include_recommendations=true&period=90d
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "permission_distribution": {
 *       "by_role": {
 *         "admin": { "count": 25, "percentage": 1.0 },
 *         "manager": { "count": 150, "percentage": 6.0 },
 *         "read": { "count": 2325, "percentage": 93.0 }
 *       },
 *       "by_hierarchy": {
 *         "Company.Engineering": 450,
 *         "Company.Sales": 300
 *       }
 *     },
 *     "patterns": {
 *       "most_common_grants": "read permissions to Engineering",
 *       "most_active_granters": ["admin-uuid1", "admin-uuid2"],
 *       "permission_hotspots": ["Company.Engineering.Backend"]
 *     },
 *     "anomalies": {
 *       "users_with_excessive_permissions": 5,
 *       "recently_escalated_permissions": 12,
 *       "soon_to_expire_permissions": 25
 *     },
 *     "recommendations": [
 *       "Review admin permissions granted in last 30 days",
 *       "Consider revoking 5 excessive permissions",
 *       "Renew 25 permissions expiring soon"
 *     ]
 *   }
 * }
 */
router.get('/permission-insights',
  authenticate,
  validate({ query: queryPermissionInsightsSchema }),
  queryController.getPermissionInsights as any
);

/**
 * POST /api/query/scope-comparison
 * Compare access scopes between users
 * Requires: Authentication + Access to target users
 * 
 * @example
 * Request body:
 * {
 *   "user_ids": ["user1-uuid", "user2-uuid", "user3-uuid"],
 *   "comparison_type": "detailed"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "users": [
 *       {
 *         "id": "user1-uuid",
 *         "name": "John Doe",
 *         "accessible_hierarchies": 15,
 *         "total_accessible_users": 250,
 *         "highest_role": "admin"
 *       }
 *     ],
 *     "comparison": {
 *       "common_hierarchies": ["Company.Engineering"],
 *       "unique_access": {
 *         "user1-uuid": ["Company.Sales"],
 *         "user2-uuid": ["Company.Marketing"]
 *       },
 *       "role_differences": {
 *         "Company.Engineering": {
 *           "user1-uuid": "admin",
 *           "user2-uuid": "manager"
 *         }
 *       }
 *     },
 *     "recommendations": [
 *       "Consider standardizing roles in Company.Engineering",
 *       "User2 may need access to Company.Sales"
 *     ]
 *   }
 * }
 */
router.post('/scope-comparison',
  authenticate,
  validate({ body: queryScopeComparisonSchema }),
  queryController.compareScopeAccess as any
);

export default router;