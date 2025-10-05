/**
 * Repository layer exports
 * Provides data access layer following the Repository pattern
 */

// Base repository
export { BaseRepository } from './base.repository';

// Specific repositories
export { HierarchyRepository } from './hierarchy.repository';
export { UserRepository } from './user.repository';
export { PermissionRepository } from './permission.repository';

// Utilities
export { Transaction, withTransaction, QueryExecutor } from './utils/transaction';
export {
  buildWhereClause,
  buildOrderByClause,
  buildPaginationClause,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildSearchCondition,
  escapeLikeValue,
  type WhereCondition,
  type OrderByClause,
  type PaginationOptions
} from './utils/query-builder';

// Re-export types for convenience
export type {
  HierarchyStructure,
  User,
  Permission,
  UserPermission,
  UserRole,
  Role,
  RolePermission,
  HierarchyStatistics,
  UserStatistics,
  PermissionAuditEntry,
  HierarchyIntegrityIssue,
  CreateHierarchyData,
  UpdateHierarchyData,
  CreateUserData,
  UpdateUserData,
  GrantPermissionData,
  AssignRoleData,
  UpdatePermissionData,
  PermissionCheckRequest,
  BulkPermissionCheckResult,
  HierarchyQueryOptions,
  UserQueryOptions,
  PermissionQueryOptions,
  PaginatedResult
} from '../types/temp-types';