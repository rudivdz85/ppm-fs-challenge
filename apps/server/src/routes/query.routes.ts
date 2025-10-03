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
 * POST /api/query/users
 * CORE FEATURE: Complex user queries with advanced filtering and analytics
 * Requires: Authentication
 * 
 * @example
 * Request body:
 * {
 *   "hierarchy_filters": {
 *     "include_paths": ["Company.Engineering"],
 *     "exclude_paths": ["Company.HR"],
 *     "depth_range": { "min": 2, "max": 4 },
 *     "specific_ids": ["hierarchy-uuid1", "hierarchy-uuid2"]
 *   },
 *   "user_filters": {
 *     "is_active": true,
 *     "search": "john",
 *     "email_domain": "@company.com",
 *     "created_after": "2024-01-01T00:00:00.000Z",
 *     "created_before": "2024-12-31T23:59:59.999Z",
 *     "has_phone": true,
 *     "metadata_filters": {
 *       "department": "Engineering",
 *       "role": "Senior"
 *     }
 *   },
 *   "permission_filters": {
 *     "has_permissions": true,
 *     "roles": ["manager", "admin"],
 *     "granted_by": "granter-uuid",
 *     "granted_after": "2024-01-01T00:00:00.000Z",
 *     "expires_before": "2024-12-31T23:59:59.999Z",
 *     "include_inherited": true
 *   },
 *   "output_options": {
 *     "include_hierarchy_info": true,
 *     "include_permission_summary": true,
 *     "include_metadata": true,
 *     "include_analytics": true,
 *     "exclude_fields": ["phone", "metadata"]
 *   },
 *   "pagination": {
 *     "page": 1,
 *     "limit": 50
 *   },
 *   "sorting": {
 *     "sort_by": "full_name",
 *     "sort_order": "asc"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "user-uuid",
 *       "email": "john@company.com",
 *       "full_name": "John Doe",
 *       "is_active": true,
 *       "hierarchy_info": {
 *         "id": "hierarchy-uuid",
 *         "name": "Backend Team",
 *         "path": "Company.Engineering.Backend",
 *         "depth": 3
 *       },
 *       "permission_summary": {
 *         "effective_role": "manager",
 *         "direct_permissions": 2,
 *         "inherited_permissions": 5,
 *         "total_accessible_users": 25,
 *         "highest_role": "admin"
 *       },
 *       "created_at": "2024-01-01T00:00:00.000Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 50,
 *     "total": 1250,
 *     "pages": 25
 *   },
 *   "meta": {
 *     "analytics": {
 *       "total_users_in_scope": 1250,
 *       "active_users": 1100,
 *       "hierarchy_distribution": {
 *         "Company.Engineering": 450,
 *         "Company.Sales": 300,
 *         "Company.Marketing": 250
 *       },
 *       "role_distribution": {
 *         "admin": 25,
 *         "manager": 150,
 *         "read": 1075
 *       },
 *       "permission_statistics": {
 *         "users_with_permissions": 950,
 *         "users_without_permissions": 300,
 *         "average_permissions_per_user": 3.2,
 *         "most_common_role": "read"
 *       },
 *       "temporal_insights": {
 *         "newest_user": "2024-01-15T10:30:00.000Z",
 *         "oldest_user": "2023-01-01T00:00:00.000Z",
 *         "users_created_last_30_days": 45
 *       }
 *     },
 *     "requestor_context": {
 *       "requesting_user_id": "requester-uuid",
 *       "requesting_user_role": "admin",
 *       "accessible_hierarchy_count": 15,
 *       "total_accessible_users": 2500,
 *       "query_scope": "filtered_by_permissions",
 *       "execution_time_ms": 150
 *     },
 *     "filters_applied": {
 *       "hierarchy_filters": ["include_paths", "depth_range"],
 *       "user_filters": ["is_active", "search"],
 *       "permission_filters": ["has_permissions", "roles"]
 *     }
 *   }
 * }
 */
router.post('/users',
  authenticate,
  validate({ body: queryUsersSchema }),
  queryController.queryUsers
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
  queryController.getAnalytics
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
  queryController.getMyAccessScope
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
  queryController.getHierarchyStats
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
  queryController.getPermissionInsights
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
  queryController.compareScopeAccess
);

export default router;