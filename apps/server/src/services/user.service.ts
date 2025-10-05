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
  first_name: string;
  last_name: string;
  password: string;
  base_hierarchy_id: string;
  timezone?: string;
  profile_data?: Record<string, any>;
}

/**
 * User update request
 */
export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  timezone?: string;
  profile_data?: Record<string, any>;
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
        first_name: sanitizedRequest.first_name,
        last_name: sanitizedRequest.last_name,
        password_hash,
        base_hierarchy_id: sanitizedRequest.base_hierarchy_id,
        timezone: sanitizedRequest.timezone || 'UTC',
        profile_data: sanitizedRequest.profile_data || {}
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
  async searchUsers(filters: UserSearchFilters): Promise<ServiceResult<PaginatedUserResult>> {
    return handleAsync(async () => {
      // Validate filters
      this.validateSearchFilters(filters);

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      let users: User[];
      let total: number;

      if (filters.search_term) {
        // Use search functionality
        const searchResults = await this.userRepo.searchUsers(filters.search_term, {
          hierarchyPath: filters.hierarchy_path,
          includeInactive: filters.include_inactive,
          limit,
          offset
        });
        users = searchResults;
        
        // For search, we need to get total separately
        const allSearchResults = await this.userRepo.searchUsers(filters.search_term, {
          hierarchyPath: filters.hierarchy_path,
          includeInactive: filters.include_inactive
        });
        total = allSearchResults.length;
      } else {
        // Use findAll with filters
        const result = await this.userRepo.findAll({
          includeInactive: filters.include_inactive,
          hierarchyPath: filters.hierarchy_path,
          limit,
          offset
        });
        users = result.users;
        total = result.total;
      }

      // Apply additional filters
      let filteredUsers = users;

      if (filters.hierarchy_level !== undefined) {
        filteredUsers = filteredUsers.filter(user => 
          user.hierarchy_level === filters.hierarchy_level
        );
      }

      if (filters.is_verified !== undefined) {
        filteredUsers = filteredUsers.filter(user => 
          user.is_verified === filters.is_verified
        );
      }

      // Apply sorting if specified
      if (filters.sort_by) {
        filteredUsers = this.sortUsers(filteredUsers, filters.sort_by, filters.sort_direction);
      }

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
        filters_applied: filters
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
      if (sanitizedRequest.first_name !== undefined) updateData.first_name = sanitizedRequest.first_name;
      if (sanitizedRequest.last_name !== undefined) updateData.last_name = sanitizedRequest.last_name;
      if (sanitizedRequest.email !== undefined) updateData.email = sanitizedRequest.email;
      if (sanitizedRequest.timezone !== undefined) updateData.timezone = sanitizedRequest.timezone;
      if (sanitizedRequest.profile_data !== undefined) updateData.profile_data = sanitizedRequest.profile_data;

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
    Validator.validateRequired(request, ['email', 'first_name', 'last_name', 'password', 'base_hierarchy_id']);
    Validator.validateEmail(request.email);
    Validator.validateUserName(request.first_name, request.last_name);
    Validator.validatePassword(request.password);
    Validator.validateUUID(request.base_hierarchy_id);

    if (request.timezone) {
      Validator.validateTimezone(request.timezone);
    }

    if (request.profile_data) {
      BusinessRuleValidator.validateMetadata(request.profile_data);
    }
  }

  private validateUpdateRequest(request: UpdateUserRequest): void {
    if (request.email !== undefined) {
      Validator.validateEmail(request.email);
    }

    if (request.first_name !== undefined || request.last_name !== undefined) {
      Validator.validateUserName(
        request.first_name || 'temp',
        request.last_name || 'temp'
      );
    }

    if (request.timezone !== undefined) {
      Validator.validateTimezone(request.timezone);
    }

    if (request.profile_data !== undefined) {
      BusinessRuleValidator.validateMetadata(request.profile_data);
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
      first_name: Sanitizer.sanitizeString(request.first_name),
      last_name: Sanitizer.sanitizeString(request.last_name)
    };
  }

  private sanitizeUpdateRequest(request: UpdateUserRequest): UpdateUserRequest {
    const sanitized: UpdateUserRequest = {};

    if (request.email !== undefined) {
      sanitized.email = Sanitizer.sanitizeEmail(request.email);
    }

    if (request.first_name !== undefined) {
      sanitized.first_name = Sanitizer.sanitizeString(request.first_name);
    }

    if (request.last_name !== undefined) {
      sanitized.last_name = Sanitizer.sanitizeString(request.last_name);
    }

    if (request.timezone !== undefined) {
      sanitized.timezone = request.timezone;
    }

    if (request.profile_data !== undefined) {
      sanitized.profile_data = request.profile_data;
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
          aValue = `${a.last_name} ${a.first_name}`;
          bValue = `${b.last_name} ${b.first_name}`;
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