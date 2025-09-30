import type { BaseEntity } from '@ppm/types';
import type { HierarchyStructure } from './HierarchyStructure';

/**
 * User Model
 * Represents a user account with base hierarchy location
 */
export interface User extends BaseEntity {
  // Basic user information
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  
  // User status
  isActive: boolean;
  isVerified: boolean;
  isSystemUser: boolean;
  
  // Hierarchy reference - user's base location
  baseHierarchyId: string;
  baseHierarchy?: HierarchyStructure;
  
  // Authentication and security
  lastLoginAt?: Date;
  passwordChangedAt: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  
  // Profile information
  phone?: string;
  timezone: string;
  locale: string;
  
  // Additional profile data
  profileData: Record<string, any>;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Public user model (without sensitive information)
 */
export interface PublicUser extends Omit<User, 'passwordHash' | 'failedLoginAttempts' | 'lockedUntil'> {
  fullName: string;
}

/**
 * Input model for user registration
 */
export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  baseHierarchyId: string;
  phone?: string;
  timezone?: string;
  locale?: string;
  profileData?: Record<string, any>;
}

/**
 * Input model for updating user
 */
export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  baseHierarchyId?: string;
  phone?: string;
  timezone?: string;
  locale?: string;
  isActive?: boolean;
  profileData?: Record<string, any>;
}

/**
 * Password change input
 */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * User authentication result
 */
export interface AuthResult {
  user: PublicUser;
  token: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Login input
 */
export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * User query options
 */
export interface UserQueryOptions {
  searchTerm?: string;
  hierarchyId?: string;
  includeDescendants?: boolean;
  isActive?: boolean;
  isVerified?: boolean;
  sortBy?: 'firstName' | 'lastName' | 'email' | 'createdAt' | 'lastLoginAt';
  sortOrder?: 'ASC' | 'DESC';
  offset?: number;
  limit?: number;
}

/**
 * User query result with pagination
 */
export interface UserQueryResult {
  users: PublicUser[];
  total: number;
  hasMore: boolean;
}

/**
 * User with hierarchy path information
 */
export interface UserWithHierarchy extends PublicUser {
  hierarchyPath: string;
  hierarchyLevel: number;
  hierarchyAncestors: HierarchyStructure[];
}

/**
 * User statistics
 */
export interface UserStats {
  total: number;
  active: number;
  verified: number;
  byHierarchy: Array<{
    hierarchyId: string;
    hierarchyName: string;
    userCount: number;
  }>;
  byStatus: {
    active: number;
    inactive: number;
    locked: number;
    unverified: number;
  };
}

/**
 * User session information
 */
export interface UserSession {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}

/**
 * User activity log entry
 */
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}