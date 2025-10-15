/**
 * UserService - Business logic for user management
 * Handles user creation, updates, and hierarchy-aware operations
 */

import { UserRepository, HierarchyRepository, PermissionRepository } from '../repositories';
import { User, CreateUserData, UpdateUserData } from '../types/temp-types';
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  BusinessRuleError,
  ServiceResult,
  createSuccessResult,
  handleAsync
} from '../errors';
import { 
  Validator, 
  BusinessRuleValidator, 
  Sanitizer 
} from './utils/validator';
import { createServiceLogger } from './utils/logger';
import * as bcrypt from 'bcrypt';

/**
 * User creation request
 */
export interface CreateUserRequest {
  email: string;
  full_name: string;
  password: string;
  base_hierarchy_id: string;
  phone?: string;
  metadata?: Record<string, any>;
}

/**
 * User update request
 */
export interface UpdateUserRequest {
  full_name?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/**
 * User search filters
 */
export interface UserSearchFilters {
  search_term?: string;
  hierarchy_path?: string;
  include_inactive?: boolean;
  is_active?: boolean;
  hierarchy_level?: number;
  is_verified?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'name' | 'email' | 'created_at' | 'hierarchy';
  sort_direction?: 'ASC' | 'DESC';
}

/**
 * Paginated user result
 */
export interface PaginatedUserResult {
  users: User[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  filters_applied: UserSearchFilters;
}

/**
 * User with hierarchy context
 */
export interface UserWithContext extends User {
  hierarchy_context: {
    ancestors: Array<{
      id: string;
      name: string;
      path: string;
      level: number;
    }>;
    can_access_siblings: boolean;
    can_access_children: boolean;
  };
}

/**
 * UserService class
 */
export class UserService {
  private logger = createServiceLogger('UserService');
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private userRepo: UserRepository,
    private hierarchyRepo: HierarchyRepository,
    private permissionRepo: PermissionRepository
  ) {}

  /**
   * Create user with hashed password and validation
   */
  async createUser(
    request: CreateUserRequest,
    createdBy: string
  ): Promise<ServiceResult<User>> {
    return handleAsync(async () => {
      this.logger.info('Creating user', {
        operation: 'createUser',
        userId: createdBy,
        userEmail: request.email
      });

      // Validate input
      await this.validateCreateRequest(request);

      // Sanitize input
      const sanitizedRequest = this.sanitizeCreateRequest(request);

      // Validate business rules
      await this.validateCreateBusinessRules(sanitizedRequest);

      // Hash password
      const password_hash = await this.hashPassword(sanitizedRequest.password);

      // Create user
      const createData: CreateUserData = {
        email: sanitizedRequest.email,
        full_name: sanitizedRequest.full_name,
        password_hash,
        base_hierarchy_id: sanitizedRequest.base_hierarchy_id,
        phone: sanitizedRequest.phone,
        metadata: sanitizedRequest.metadata || {}
      };

      const user = await this.userRepo.create(createData);

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = user;

      this.logger.audit('User created', {
        operation: 'createUser',
        userId: createdBy,
        entityType: 'user',
        entityId: user.id,
        metadata: {
          email: user.email,
          hierarchy_id: user.base_hierarchy_id
        }
      });

      return userResponse as User;
    });
  }

  /**
   * Get user by ID with structure information
   */
  async getUserById(
    id: string,
    include_hierarchy: boolean = true
  ): Promise<ServiceResult<User>> {
    return handleAsync(async () => {
      Validator.validateUUID(id);

      const user = await this.userRepo.findById(id, include_hierarchy);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = user;
      return userResponse as User;
    });
  }

  /**
   * Get user with full hierarchy context
   */
  async getUserWithContext(id: string): Promise<ServiceResult<UserWithContext>> {
    return handleAsync(async () => {
      Validator.validateUUID(id);

      const user = await this.userRepo.findById(id, true);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Get hierarchy context
      const hierarchy = await this.hierarchyRepo.findById(user.base_hierarchy_id);
      if (!hierarchy) {
        throw new NotFoundError('User hierarchy structure', user.base_hierarchy_id);
      }

      const ancestors = await this.hierarchyRepo.findAncestors(hierarchy.path, false);
      
      // Remove password hash and add context
      const { password_hash: _, ...userResponse } = user;
      
      const userWithContext: UserWithContext = {
        ...userResponse as User,
        hierarchy_context: {
          ancestors: ancestors.map(ancestor => ({
            id: ancestor.id,
            name: ancestor.name,
            path: ancestor.path,
            level: ancestor.level
          })),
          can_access_siblings: true, // Would be determined by permissions
          can_access_children: true  // Would be determined by permissions
        }
      };

      return userWithContext;
    });
  }

  /**
   * Get users by structure with optional descendant inclusion
   */
  async getUsersByStructure(
    structureId: string,
    includeDescendants: boolean = false,
    includeInactive: boolean = false
  ): Promise<ServiceResult<User[]>> {
    return handleAsync(async () => {
      Validator.validateUUID(structureId);

      // Verify structure exists
      const structure = await this.hierarchyRepo.findById(structureId);
      if (!structure) {
        throw new NotFoundError('Hierarchy structure', structureId);
      }

      let users: User[];

      if (includeDescendants) {
        users = await this.userRepo.findByStructurePath(structure.path, includeInactive);
      } else {
        users = await this.userRepo.findByStructure(structureId, includeInactive);
      }

      // Remove password hashes
      const sanitizedUsers = users.map(user => {
        const { password_hash: _, ...userResponse } = user;
        return userResponse as User;
      });

      return sanitizedUsers;
    });
  }

  /**
   * Search users with filters and pagination
   */
  async searchUsers(filters: any): Promise<ServiceResult<PaginatedUserResult>> {
    return handleAsync(async () => {
      // Map validated query parameters to internal format
      const searchFilters: UserSearchFilters = {
        search_term: filters.search, // Map 'search' to 'search_term'
        hierarchy_path: filters.hierarchy_id,
        is_active: filters.is_active, // Pass is_active directly
        limit: filters.limit,
        offset: (filters.page - 1) * filters.limit, // Convert page to offset
        sort_by: filters.sort_by,
        sort_direction: filters.sort_order?.toUpperCase() // Map 'asc'/'desc' to 'ASC'/'DESC'
      };

      // Validate filters
      this.validateSearchFilters(searchFilters);

      const limit = searchFilters.limit || 50;
      const offset = searchFilters.offset || 0;

      // Build ordering clause
      const orderBy = searchFilters.sort_by && searchFilters.sort_direction 
        ? [{ field: searchFilters.sort_by, direction: searchFilters.sort_direction as 'ASC' | 'DESC' }]
        : [];

      let users: User[];
      let total: number;

      if (searchFilters.search_term) {
        // Use search functionality
        const searchResults = await this.userRepo.searchUsers(searchFilters.search_term, {
          hierarchyPath: searchFilters.hierarchy_path,
          isActive: searchFilters.is_active,
          orderBy,
          limit,
          offset
        });
        users = searchResults;
        
        // For search, we need to get total separately
        const allSearchResults = await this.userRepo.searchUsers(searchFilters.search_term, {
          hierarchyPath: searchFilters.hierarchy_path,
          isActive: searchFilters.is_active
        });
        total = allSearchResults.length;
      } else {
        // Use findAll with filters
        const result = await this.userRepo.findAll({
          isActive: searchFilters.is_active,
          hierarchyPath: searchFilters.hierarchy_path,
          orderBy,
          limit,
          offset
        });
        users = result.users;
        total = result.total;
      }

      // Apply additional filters
      let filteredUsers = users;

      if (searchFilters.hierarchy_level !== undefined) {
        filteredUsers = filteredUsers.filter(user => 
          user.hierarchy_level === searchFilters.hierarchy_level
        );
      }

      if (searchFilters.is_verified !== undefined) {
        filteredUsers = filteredUsers.filter(user => 
          user.is_verified === searchFilters.is_verified
        );
      }

      // Sorting is now handled at the database level in the repository

      // Remove password hashes
      const sanitizedUsers = filteredUsers.map(user => {
        const { password_hash: _, ...userResponse } = user;
        return userResponse as User;
      });

      const page = Math.floor(offset / limit) + 1;
      const pages = Math.ceil(total / limit);

      const result: any = {
        users: sanitizedUsers,
        items: sanitizedUsers,
        data: sanitizedUsers,
        total,
        page,
        pages,
        limit,
        offset,
        has_more: offset + limit < total,
        filters_applied: searchFilters
      };

      this.logger.debug('User search completed', {
        operation: 'searchUsers',
        totalResults: total,
        returnedResults: sanitizedUsers.length,
        filters
      });

      return result;
    });
  }

  /**
   * Update user with validation
   */
  async updateUser(
    id: string,
    request: UpdateUserRequest,
    updatedBy: string
  ): Promise<ServiceResult<User>> {
    return handleAsync(async () => {
      this.logger.info('Updating user', {
        operation: 'updateUser',
        userId: updatedBy,
        targetUserId: id
      });

      Validator.validateUUID(id);

      // Verify user exists
      const existingUser = await this.userRepo.findById(id, false);
      if (!existingUser) {
        throw new NotFoundError('User', id);
      }

      // Validate update request
      this.validateUpdateRequest(request);

      // Sanitize input
      const sanitizedRequest = this.sanitizeUpdateRequest(request);

      // Validate business rules
      await this.validateUpdateBusinessRules(id, sanitizedRequest);

      // Update user
      const updateData: UpdateUserData = {};
      if (sanitizedRequest.full_name !== undefined) updateData.full_name = sanitizedRequest.full_name;
      if (sanitizedRequest.email !== undefined) updateData.email = sanitizedRequest.email;
      if (sanitizedRequest.phone !== undefined) updateData.phone = sanitizedRequest.phone;
      if (sanitizedRequest.metadata !== undefined) updateData.metadata = sanitizedRequest.metadata;

      const updatedUser = await this.userRepo.update(id, updateData);
      if (!updatedUser) {
        throw new NotFoundError('User', id);
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = updatedUser;

      this.logger.audit('User updated', {
        operation: 'updateUser',
        userId: updatedBy,
        entityType: 'user',
        entityId: id,
        metadata: {
          changes: Object.keys(sanitizedRequest)
        }
      });

      return userResponse as User;
    });
  }

  /**
   * Change user password
   */
  async changePassword(
    id: string,
    request: ChangePasswordRequest,
    changedBy: string
  ): Promise<ServiceResult<{ success: boolean }>> {
    return handleAsync(async () => {
      this.logger.info('Changing user password', {
        operation: 'changePassword',
        userId: changedBy,
        targetUserId: id
      });

      Validator.validateUUID(id);
      Validator.validateRequired(request, ['current_password', 'new_password']);
      Validator.validatePassword(request.new_password);

      // Get user with password hash for verification
      const user = await this.userRepo.findById(id, false);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Verify current password (if changing own password)
      if (changedBy === id) {
        const isCurrentPasswordValid = await this.comparePassword(
          request.current_password, 
          user.password_hash || ''
        );
        if (!isCurrentPasswordValid) {
          throw new ValidationError('Current password is incorrect', 'current_password');
        }
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(request.new_password);

      // Update password
      const success = await this.userRepo.updatePassword(id, newPasswordHash);

      this.logger.audit('User password changed', {
        operation: 'changePassword',
        userId: changedBy,
        entityType: 'user',
        entityId: id
      });

      return { success };
    });
  }

  /**
   * Move user to different hierarchy structure
   */
  async changeUserStructure(
    userId: string,
    newStructureId: string,
    changedBy: string
  ): Promise<ServiceResult<User>> {
    return handleAsync(async () => {
      this.logger.info('Moving user to new structure', {
        operation: 'changeUserStructure',
        userId: changedBy,
        targetUserId: userId,
        newStructureId
      });

      Validator.validateUUID(userId);
      Validator.validateUUID(newStructureId);

      // Verify user exists
      const user = await this.userRepo.findById(userId, true);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Verify new structure exists
      const newStructure = await this.hierarchyRepo.findById(newStructureId);
      if (!newStructure) {
        throw new NotFoundError('Hierarchy structure', newStructureId);
      }

      // Validate business rules for structure change
      await this.validateStructureChange(userId, user.base_hierarchy_id, newStructureId);

      // Update user's structure
      const updatedUser = await this.userRepo.update(userId, {
        base_hierarchy_id: newStructureId
      });

      if (!updatedUser) {
        throw new NotFoundError('User', userId);
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = updatedUser;

      this.logger.audit('User structure changed', {
        operation: 'changeUserStructure',
        userId: changedBy,
        entityType: 'user',
        entityId: userId,
        metadata: {
          fromStructure: user.base_hierarchy_id,
          toStructure: newStructureId
        }
      });

      return userResponse as User;
    });
  }

  /**
   * Delete user and associated permissions
   */
  async deleteUser(
    id: string,
    deletedBy: string,
    force: boolean = false
  ): Promise<ServiceResult<{ success: boolean; deletedPermissions: number }>> {
    return handleAsync(async () => {
      this.logger.info('Deleting user', {
        operation: 'deleteUser',
        userId: deletedBy,
        targetUserId: id,
        force
      });

      Validator.validateUUID(id);

      const user = await this.userRepo.findById(id, false);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Check for dependencies if not forced
      if (!force) {
        await this.validateUserDeletion(id);
      }

      // Get user permissions for cleanup count
      const permissions = await this.permissionRepo.findByUserId(id);

      // Delete user (soft delete)
      const success = await this.userRepo.delete(id);

      this.logger.audit('User deleted', {
        operation: 'deleteUser',
        userId: deletedBy,
        entityType: 'user',
        entityId: id,
        metadata: {
          userEmail: user.email,
          deletedPermissions: permissions.length,
          force
        }
      });

      return {
        success,
        deletedPermissions: permissions.length
      };
    });
  }

  /**
   * Reactivate soft-deleted user
   */
  async reactivateUser(
    id: string,
    reactivatedBy: string
  ): Promise<ServiceResult<User>> {
    return handleAsync(async () => {
      this.logger.info('Reactivating user', {
        operation: 'reactivateUser',
        userId: reactivatedBy,
        targetUserId: id
      });

      Validator.validateUUID(id);

      const success = await this.userRepo.reactivate(id);
      if (!success) {
        throw new NotFoundError('User', id);
      }

      const user = await this.userRepo.findById(id, true);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = user;

      this.logger.audit('User reactivated', {
        operation: 'reactivateUser',
        userId: reactivatedBy,
        entityType: 'user',
        entityId: id
      });

      return userResponse as User;
    });
  }

  /**
   * Verify user's email
   */
  async verifyUserEmail(
    id: string,
    verifiedBy: string
  ): Promise<ServiceResult<{ success: boolean }>> {
    return handleAsync(async () => {
      Validator.validateUUID(id);

      const success = await this.userRepo.verifyEmail(id);

      this.logger.audit('User email verified', {
        operation: 'verifyUserEmail',
        userId: verifiedBy,
        entityType: 'user',
        entityId: id
      });

      return { success };
    });
  }

  /**
   * Get paginated user list
   */
  async getAllUsers(
    pagination: { limit?: number; offset?: number; } = {}
  ): Promise<ServiceResult<PaginatedUserResult>> {
    return handleAsync(async () => {
      Validator.validatePagination(pagination.limit, pagination.offset);

      const result = await this.userRepo.findAll({
        limit: pagination.limit || 50,
        offset: pagination.offset || 0
      });

      // Remove password hashes
      const sanitizedUsers = result.users.map(user => {
        const { password_hash: _, ...userResponse } = user;
        return userResponse as User;
      });

      const paginatedResult: PaginatedUserResult = {
        users: sanitizedUsers,
        total: result.total,
        limit: pagination.limit || 50,
        offset: pagination.offset || 0,
        has_more: (pagination.offset || 0) + (pagination.limit || 50) < result.total,
        filters_applied: {}
      };

      return paginatedResult;
    });
  }

  // Private utility methods

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  private async comparePassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  // Private validation methods

  private async validateCreateRequest(request: CreateUserRequest): Promise<void> {
    Validator.validateRequired(request, ['email', 'full_name', 'password', 'base_hierarchy_id']);
    Validator.validateEmail(request.email);
    Validator.validatePassword(request.password);
    Validator.validateUUID(request.base_hierarchy_id);


    if (request.metadata) {
      BusinessRuleValidator.validateMetadata(request.metadata);
    }
  }

  private validateUpdateRequest(request: UpdateUserRequest): void {
    if (request.email !== undefined) {
      Validator.validateEmail(request.email);
    }

    if (request.full_name !== undefined) {
      // Simple validation for full name - non-empty and reasonable length
      if (!request.full_name.trim() || request.full_name.trim().length < 2) {
        throw new ValidationError('Full name must be at least 2 characters long');
      }
    }

    if (request.metadata !== undefined) {
      BusinessRuleValidator.validateMetadata(request.metadata);
    }
  }

  private validateSearchFilters(filters: UserSearchFilters): void {
    if (filters.search_term !== undefined) {
      Validator.validateSearchTerm(filters.search_term);
    }

    if (filters.limit !== undefined || filters.offset !== undefined) {
      Validator.validatePagination(filters.limit, filters.offset);
    }

    if (filters.sort_direction !== undefined) {
      Validator.validateSortDirection(filters.sort_direction);
    }

    if (filters.hierarchy_level !== undefined) {
      BusinessRuleValidator.validateHierarchyLevel(filters.hierarchy_level);
    }
  }

  private sanitizeCreateRequest(request: CreateUserRequest): CreateUserRequest {
    return {
      ...request,
      email: Sanitizer.sanitizeEmail(request.email),
      full_name: Sanitizer.sanitizeString(request.full_name)
    };
  }

  private sanitizeUpdateRequest(request: UpdateUserRequest): UpdateUserRequest {
    const sanitized: UpdateUserRequest = {};

    if (request.email !== undefined) {
      sanitized.email = Sanitizer.sanitizeEmail(request.email);
    }

    if (request.full_name !== undefined) {
      sanitized.full_name = Sanitizer.sanitizeString(request.full_name);
    }

    if (request.phone !== undefined) {
      sanitized.phone = Sanitizer.sanitizeString(request.phone);
    }

    if (request.metadata !== undefined) {
      sanitized.metadata = request.metadata;
    }

    return sanitized;
  }

  private async validateCreateBusinessRules(request: CreateUserRequest): Promise<void> {
    // Check if email already exists
    const existingUser = await this.userRepo.findByEmail(request.email);
    if (existingUser) {
      throw new ConflictError(
        `User with email '${request.email}' already exists`,
        'email',
        request.email
      );
    }

    // Verify hierarchy structure exists
    const structure = await this.hierarchyRepo.findById(request.base_hierarchy_id);
    if (!structure) {
      throw new NotFoundError('Hierarchy structure', request.base_hierarchy_id);
    }
  }

  private async validateUpdateBusinessRules(id: string, request: UpdateUserRequest): Promise<void> {
    // Check email uniqueness if email is being changed
    if (request.email) {
      const existingUser = await this.userRepo.findByEmail(request.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictError(
          `User with email '${request.email}' already exists`,
          'email',
          request.email
        );
      }
    }
  }

  private async validateStructureChange(
    userId: string,
    currentStructureId: string,
    newStructureId: string
  ): Promise<void> {
    if (currentStructureId === newStructureId) {
      throw new ValidationError('User is already in the target structure');
    }

    // Additional business rules for structure changes could be added here
    // For example, checking if the user has permissions to be moved
  }

  private async validateUserDeletion(userId: string): Promise<void> {
    // Check for dependencies that would prevent deletion
    // For now, we allow deletion but log it for audit
    // In a real system, you might check for:
    // - Active sessions
    // - Pending approvals
    // - Owned resources
    // etc.
  }

  private sortUsers(users: User[], sortBy: string, direction: string = 'ASC'): User[] {
    return users.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.full_name || '';
          bValue = b.full_name || '';
          break;
        case 'email':
          aValue = a.email;
          bValue = b.email;
          break;
        case 'created_at':
          aValue = a.created_at ? new Date(a.created_at) : new Date(0);
          bValue = b.created_at ? new Date(b.created_at) : new Date(0);
          break;
        case 'hierarchy':
          aValue = a.hierarchy_path || '';
          bValue = b.hierarchy_path || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return direction === 'ASC' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }
}