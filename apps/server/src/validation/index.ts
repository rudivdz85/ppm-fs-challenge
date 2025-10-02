/**
 * Validation Layer Entry Point
 * Exports all validation schemas and utilities
 */

// Validation middleware
export {
  validate,
  validateBody,
  validateParams,
  validateQuery,
  validateTarget,
  createTypedValidator,
  commonSchemas,
  createValidationErrorResponse
} from '../middleware/validate.middleware';

export type {
  ValidationTarget,
  ValidationConfig,
  ValidatedData,
  ValidatedRequest,
  ValidationErrorDetail
} from '../middleware/validate.middleware';

// Authentication validation
export {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyPasswordSchema,
  userIdParamSchema,
  tokenSchema,
  authValidationMessages,
  authValidationUtils
} from './auth.validation';

export type {
  LoginRequest as AuthLoginRequest,
  RegisterRequest as AuthRegisterRequest,
  RefreshTokenRequest as AuthRefreshTokenRequest,
  ChangePasswordRequest as AuthChangePasswordRequest,
  ForgotPasswordRequest as AuthForgotPasswordRequest,
  ResetPasswordRequest as AuthResetPasswordRequest,
  VerifyPasswordRequest as AuthVerifyPasswordRequest,
  UserIdParam as AuthUserIdParam,
  TokenRequest as AuthTokenRequest
} from './auth.validation';

// User validation
export {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema as userIdParam,
  userIdsSchema,
  queryUsersSchema,
  changePasswordSchema as userChangePasswordSchema,
  changeUserHierarchySchema,
  bulkUserOperationSchema,
  userActivityQuerySchema,
  updateUserProfileSchema,
  userValidationMessages,
  userValidationUtils
} from './user.validation';

export type {
  CreateUserRequest as UserCreateRequest,
  UpdateUserRequest as UserUpdateRequest,
  UserIdParam as UserIdParameter,
  UserIdsRequest,
  QueryUsersRequest as UserQueryRequest,
  ChangePasswordRequest as UserChangePasswordRequest,
  ChangeUserHierarchyRequest,
  BulkUserOperationRequest,
  UserActivityQueryRequest,
  UpdateUserProfileRequest
} from './user.validation';

// Permission validation
export {
  grantPermissionSchema,
  updatePermissionSchema,
  permissionIdParamSchema,
  userPermissionsQuerySchema,
  permissionAccessCheckSchema,
  userAccessScopeQuerySchema,
  accessibleUsersQuerySchema,
  bulkPermissionOperationSchema,
  permissionAuditQuerySchema,
  permissionValidationRuleSchema,
  permissionValidationMessages,
  permissionValidationUtils
} from './permission.validation';

export type {
  GrantPermissionRequest as PermissionGrantRequest,
  UpdatePermissionRequest as PermissionUpdateRequest,
  PermissionIdParam,
  UserPermissionsQuery,
  PermissionAccessCheck,
  UserAccessScopeQuery,
  AccessibleUsersQuery,
  BulkPermissionOperation,
  PermissionAuditQuery,
  PermissionValidationRule
} from './permission.validation';

// Hierarchy validation
export {
  createStructureSchema,
  updateStructureSchema,
  structureIdParamSchema,
  moveStructureSchema,
  hierarchyTreeQuerySchema,
  hierarchyPathSchema,
  hierarchySearchQuerySchema,
  hierarchyStatsQuerySchema,
  hierarchyValidationSchema,
  bulkHierarchyOperationSchema,
  hierarchyPathQuerySchema,
  hierarchyValidationMessages,
  hierarchyValidationUtils
} from './hierarchy.validation';

export type {
  CreateStructureRequest as HierarchyCreateRequest,
  UpdateStructureRequest as HierarchyUpdateRequest,
  StructureIdParam,
  MoveStructureRequest,
  HierarchyTreeQuery,
  HierarchySearchQuery,
  HierarchyStatsQuery,
  HierarchyValidationRequest,
  BulkHierarchyOperation,
  HierarchyPathQuery
} from './hierarchy.validation';

// Query validation
export {
  queryAccessibleUsersSchema,
  userStatsQuerySchema,
  bulkUserQuerySchema,
  userAutocompleteQuerySchema,
  analyticsQuerySchema,
  exportQuerySchema,
  advancedSearchSchema,
  queryPerformanceSchema,
  queryValidationMessages,
  queryValidationUtils
} from './query.validation';

export type {
  QueryAccessibleUsersRequest,
  UserStatsQuery,
  BulkUserQuery,
  UserAutocompleteQuery,
  AnalyticsQuery,
  ExportQuery,
  AdvancedSearch,
  QueryPerformance
} from './query.validation';

/**
 * Validation layer overview:
 * 
 * 1. Authentication Validation - Login, registration, password management
 * 2. User Validation - User CRUD operations and queries
 * 3. Permission Validation - Permission granting, access control
 * 4. Hierarchy Validation - Hierarchy structure management
 * 5. Query Validation - Complex user queries and analytics
 * 
 * All validation schemas use Zod for runtime type checking and provide
 * TypeScript types automatically. The middleware validates requests
 * before they reach the service layer.
 */