/**
 * Service Layer Entry Point
 * Exports all services for the hierarchical permission system
 */

// Core services
export { HierarchyService } from './hierarchy.service';
export { UserService } from './user.service';
export { AuthService } from './auth.service';
export { PermissionService } from './permission.service';
export { QueryService } from './query.service';

// Service DTOs and interfaces
export type {
  // Authentication
  LoginRequest,
  LoginResponse,
  TokenPayload,
  RefreshTokenRequest,
  TokenValidationResult,
  PasswordValidationRequest,

  // User management
  CreateUserRequest,
  UpdateUserRequest,
  UserSearchFilters,
  PaginatedUserResult,

  // Hierarchy management
  CreateStructureRequest,
  UpdateStructureRequest,
  HierarchyValidationResult,

  // Permission management
  GrantPermissionRequest,
  UpdatePermissionRequest,
  UserAccessFilters,
  UserWithAccessContext,
  UserAccessScope,
  PermissionValidationResult,

  // Query service
  QueryFilters,
  QueryResult,
  StatsRequest,
  UserStats,
  BulkUserQuery
} from './auth.service';

export type {
  HierarchyTreeNode
} from './utils/hierarchy-calculator';

// Re-export utility types
export type {
  AccessScope,
  PathAncestry
} from './utils/hierarchy-calculator';

// Service utilities
export { Validator } from './utils/validator';
export { HierarchyCalculator, PathUtils } from './utils/hierarchy-calculator';
export { createServiceLogger } from './utils/logger';

// Legacy base service
export * from './baseService';

/**
 * Service layer overview:
 * 
 * 1. HierarchyService - Manages hierarchy structures and relationships
 * 2. UserService - User CRUD operations and hierarchy associations
 * 3. AuthService - Authentication, password management, and JWT tokens
 * 4. PermissionService - Core access control logic and permission management
 * 5. QueryService - Main user query endpoint with analytics and filtering
 * 
 * Each service follows dependency injection pattern and uses repositories
 * for database operations. All business logic is contained in services.
 */