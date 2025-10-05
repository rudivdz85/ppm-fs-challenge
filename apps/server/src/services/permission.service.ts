/**
 * PermissionService - Core access control and permission management
 * Handles permission granting, access scope calculation, and user accessibility
 */

import { UserRepository, HierarchyRepository, PermissionRepository } from '../repositories';
import { 
  User, 
  HierarchyStructure, 
  Permission, 
  PermissionRole, 
  PaginatedResult 
} from '@ppm/types';
import { 
  ValidationError, 
  BusinessRuleError, 
  NotFoundError, 
  UnauthorizedError,
  ServiceResult,
  createSuccessResult,
  handleAsync
} from '../errors';
import { Validator } from './utils/validator';
import { createServiceLogger } from './utils/logger';
import { HierarchyCalculator, AccessScope } from './utils/hierarchy-calculator';
import logger from '../utils/logger';

/**
 * Permission grant request
 */
export interface GrantPermissionRequest {
  user_id: string;
  hierarchy_id: string;
  role: PermissionRole;
  inherit_to_descendants?: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

/**
 * Permission update request
 */
export interface UpdatePermissionRequest {
  role?: PermissionRole;
  inherit_to_descendants?: boolean;
  expires_at?: Date;
  metadata?: Record<string, any>;
  is_active?: boolean;
}

/**
 * User access filters
 */
export interface UserAccessFilters {
  search?: string;
  hierarchy_id?: string;
  role?: PermissionRole;
  is_active?: boolean;
  include_descendants?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'email' | 'hierarchy_path' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * User with access context
 */
export interface UserWithAccessContext extends Omit<User, 'password_hash'> {
  access_level: 'direct' | 'inherited';
  permission_source: 'direct' | 'role';
  user_hierarchy_path: string;
  user_hierarchy_name: string;
  accessible_through: string[];
}

/**
 * Access scope result
 */
export interface UserAccessScope {
  user_id: string;
  accessible_hierarchy_ids: string[];
  accessible_hierarchy_paths: string[];
  total_accessible_users: number;
  direct_permissions: Array<{
    hierarchy_id: string;
    hierarchy_path: string;
    hierarchy_name: string;
    role: PermissionRole;
    inherit_to_descendants: boolean;
  }>;
  inherited_permissions: Array<{
    hierarchy_id: string;
    hierarchy_path: string;
    hierarchy_name: string;
    source_hierarchy: string;
    effective_role: PermissionRole;
  }>;
}

/**
 * Permission validation result
 */
export interface PermissionValidationResult {
  isValid: boolean;
  canAccess: boolean;
  accessLevel?: 'direct' | 'inherited';
  effectiveRole?: PermissionRole;
  reason?: string;
}

/**
 * PermissionService class
 */
export class PermissionService {
  private logger = createServiceLogger('PermissionService');

  constructor(
    private userRepo: UserRepository,
    private hierarchyRepo: HierarchyRepository,
    private permissionRepo: PermissionRepository
  ) {}

  /**
   * Grant permission to user for hierarchy with validation
   */
  async grantPermission(
    request: GrantPermissionRequest, 
    grantedBy: string
  ): Promise<ServiceResult<Permission>> {
    return handleAsync(async () => {
      this.logger.info('Permission grant attempt', {
        operation: 'grantPermission',
        userId: request.user_id,
        hierarchyId: request.hierarchy_id,
        role: request.role,
        grantedBy
      });

      // Validate input
      this.validateGrantPermissionRequest(request);
      Validator.validateUUID(grantedBy);

      // Check if user exists and is active
      const user = await this.userRepo.findById(request.user_id);
      if (!user || !user.is_active) {
        throw new NotFoundError('User', request.user_id);
      }

      // Check if hierarchy exists
      const hierarchy = await this.hierarchyRepo.findById(request.hierarchy_id);
      if (!hierarchy || !hierarchy.is_active) {
        throw new NotFoundError('Hierarchy', request.hierarchy_id);
      }

      // Check if granting user has permission to grant at this level
      const canGrant = await this.canUserGrantPermission(grantedBy, request.hierarchy_id, request.role);
      if (!canGrant.canAccess) {
        this.logger.warn('Permission grant denied - insufficient privileges', {
          operation: 'grantPermission',
          grantedBy,
          hierarchyId: request.hierarchy_id,
          role: request.role,
          reason: canGrant.reason
        });
        throw new UnauthorizedError('Insufficient privileges to grant this permission');
      }

      // Check for existing permission
      const existingPermission = await this.permissionRepo.findByUserAndHierarchy(
        request.user_id, 
        request.hierarchy_id
      );

      if (existingPermission && existingPermission.is_active) {
        throw new BusinessRuleError(
          'User already has an active permission for this hierarchy',
          'PERMISSION_ALREADY_EXISTS'
        );
      }

      // Validate business rules
      await this.validatePermissionBusinessRules(request, user, hierarchy);

      // Create permission
      const permissionData = {
        user_id: request.user_id,
        hierarchy_id: request.hierarchy_id,
        role: request.role,
        inherit_to_descendants: request.inherit_to_descendants ?? true,
        expires_at: request.expires_at,
        metadata: request.metadata,
        granted_by: grantedBy,
        granted_at: new Date(),
        is_active: true
      };

      const permission = await this.permissionRepo.create(permissionData);

      logger.info('Permission granted', { 
        userId: request.user_id, 
        hierarchyId: request.hierarchy_id, 
        role: request.role,
        permissionId: permission.id 
      });
      
      this.logger.permission('Permission granted successfully', {
        operation: 'grantPermission',
        permissionId: permission.id,
        userId: request.user_id,
        hierarchyId: request.hierarchy_id,
        role: request.role,
        grantedBy,
        inheritToDescendants: request.inherit_to_descendants
      });

      return permission;
    });
  }

  /**
   * Revoke permission by ID
   */
  async revokePermission(permissionId: string, revokedBy: string): Promise<ServiceResult<void>> {
    return handleAsync(async () => {
      this.logger.info('Permission revoke attempt', {
        operation: 'revokePermission',
        permissionId,
        revokedBy
      });

      Validator.validateUUID(permissionId);
      Validator.validateUUID(revokedBy);

      // Get permission
      const permission = await this.permissionRepo.findById(permissionId);
      if (!permission) {
        throw new NotFoundError('Permission', permissionId);
      }

      if (!permission.is_active) {
        throw new BusinessRuleError('Permission is already inactive', 'PERMISSION_ALREADY_INACTIVE');
      }

      // Check if revoking user has permission to revoke
      const canRevoke = await this.canUserRevokePermission(revokedBy, permission);
      if (!canRevoke.canAccess) {
        this.logger.warn('Permission revoke denied - insufficient privileges', {
          operation: 'revokePermission',
          permissionId,
          revokedBy,
          reason: canRevoke.reason
        });
        throw new UnauthorizedError('Insufficient privileges to revoke this permission');
      }

      // Revoke permission
      await this.permissionRepo.update(permissionId, {
        is_active: false,
        revoked_by: revokedBy,
        revoked_at: new Date()
      });

      logger.info('Permission revoked', { permissionId, userId: permission.user_id });
      
      this.logger.permission('Permission revoked successfully', {
        operation: 'revokePermission',
        permissionId,
        userId: permission.user_id,
        hierarchyId: permission.hierarchy_id,
        revokedBy
      });
    });
  }

  /**
   * Update permission details
   */
  async updatePermission(
    permissionId: string, 
    request: UpdatePermissionRequest,
    updatedBy: string
  ): Promise<ServiceResult<Permission>> {
    return handleAsync(async () => {
      this.logger.info('Permission update attempt', {
        operation: 'updatePermission',
        permissionId,
        updatedBy
      });

      Validator.validateUUID(permissionId);
      Validator.validateUUID(updatedBy);

      // Get current permission
      const currentPermission = await this.permissionRepo.findById(permissionId);
      if (!currentPermission) {
        throw new NotFoundError('Permission', permissionId);
      }

      // Check update privileges
      const canUpdate = await this.canUserUpdatePermission(updatedBy, currentPermission);
      if (!canUpdate.canAccess) {
        throw new UnauthorizedError('Insufficient privileges to update this permission');
      }

      // Validate role change if requested
      if (request.role && request.role !== currentPermission.role) {
        const canGrantNewRole = await this.canUserGrantPermission(
          updatedBy, 
          currentPermission.hierarchy_id, 
          request.role
        );
        if (!canGrantNewRole.canAccess) {
          throw new UnauthorizedError('Insufficient privileges to grant the requested role');
        }
      }

      // Update permission
      const updateData = {
        ...request,
        updated_by: updatedBy,
        updated_at: new Date()
      };

      const updatedPermission = await this.permissionRepo.update(permissionId, updateData);

      this.logger.permission('Permission updated successfully', {
        operation: 'updatePermission',
        permissionId,
        userId: currentPermission.user_id,
        hierarchyId: currentPermission.hierarchy_id,
        updatedBy,
        changes: Object.keys(request)
      });

      return updatedPermission;
    });
  }

  /**
   * Get all permissions for a user with hierarchy details
   */
  async getUserPermissions(userId: string): Promise<ServiceResult<Permission[]>> {
    return handleAsync(async () => {
      Validator.validateUUID(userId);

      const permissions = await this.permissionRepo.findByUserId(userId);
      
      this.logger.info('User permissions retrieved', {
        operation: 'getUserPermissions',
        userId,
        permissionCount: permissions.length
      });

      return permissions;
    });
  }

  /**
   * THE CORE FEATURE: Get all users accessible to the requesting user
   */
  async getAccessibleUsers(
    requestingUserId: string, 
    filters: UserAccessFilters = {}
  ): Promise<ServiceResult<PaginatedResult<UserWithAccessContext>>> {
    return handleAsync(async () => {
      this.logger.info('Accessible users query', {
        operation: 'getAccessibleUsers',
        requestingUserId,
        filters
      });

      Validator.validateUUID(requestingUserId);

      // Get requesting user's access scope
      const accessScope = await this.getUserAccessScope(requestingUserId);
      if (accessScope.data.accessible_hierarchy_paths.length === 0) {
        this.logger.warn('User has no accessible hierarchies', {
          operation: 'getAccessibleUsers',
          requestingUserId
        });
        
        return {
          items: [],
          total: 0,
          page: filters.page || 1,
          limit: filters.limit || 50,
          pages: 0
        };
      }

      // Build search criteria
      const searchCriteria = this.buildUserSearchCriteria(filters, accessScope.data);

      // Execute search with pagination
      const result = await this.userRepo.searchUsersWithHierarchy(searchCriteria);

      // Enhance results with access context
      const enhancedUsers = await this.enhanceUsersWithAccessContext(
        result.items,
        accessScope.data
      );

      this.logger.info('Accessible users query completed', {
        operation: 'getAccessibleUsers',
        requestingUserId,
        totalFound: result.total,
        returnedCount: enhancedUsers.length
      });

      return {
        items: enhancedUsers,
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages
      };
    });
  }

  /**
   * Check if a user can access another user
   */
  async canUserAccessUser(
    requestingUserId: string, 
    targetUserId: string
  ): Promise<ServiceResult<PermissionValidationResult>> {
    return handleAsync(async () => {
      Validator.validateUUID(requestingUserId);
      Validator.validateUUID(targetUserId);

      if (requestingUserId === targetUserId) {
        return {
          isValid: true,
          canAccess: true,
          accessLevel: 'direct',
          effectiveRole: 'read'
        };
      }

      // Get target user
      const targetUser = await this.userRepo.findById(targetUserId, true);
      if (!targetUser || !targetUser.is_active) {
        return {
          isValid: false,
          canAccess: false,
          reason: 'Target user not found or inactive'
        };
      }

      // Get requesting user's access scope
      const accessScope = await this.getUserAccessScope(requestingUserId);
      
      // Check if target user's hierarchy is accessible
      const isAccessible = HierarchyCalculator.isHierarchyAccessible(
        targetUser.hierarchy_path,
        accessScope.data.direct_permissions.map(p => ({
          hierarchyId: p.hierarchy_id,
          hierarchyPath: p.hierarchy_path,
          hierarchyName: p.hierarchy_name,
          accessLevel: 'direct' as const,
          permissionSource: 'direct' as const,
          inheritToDescendants: p.inherit_to_descendants,
          descendantPaths: [] // Will be calculated by isHierarchyAccessible
        }))
      );

      if (!isAccessible) {
        return {
          isValid: true,
          canAccess: false,
          reason: 'User hierarchy not accessible'
        };
      }

      // Determine access level and effective role
      const directPermission = accessScope.data.direct_permissions.find(
        p => p.hierarchy_path === targetUser.hierarchy_path
      );

      if (directPermission) {
        return {
          isValid: true,
          canAccess: true,
          accessLevel: 'direct',
          effectiveRole: directPermission.role
        };
      }

      // Check inherited access
      const inheritedPermission = accessScope.data.direct_permissions.find(
        p => p.inherit_to_descendants && 
             HierarchyCalculator.isDescendant(targetUser.hierarchy_path, p.hierarchy_path)
      );

      if (inheritedPermission) {
        return {
          isValid: true,
          canAccess: true,
          accessLevel: 'inherited',
          effectiveRole: inheritedPermission.role
        };
      }

      return {
        isValid: true,
        canAccess: false,
        reason: 'No applicable permissions found'
      };
    });
  }

  /**
   * Check if a user can access a hierarchy structure
   */
  async canUserAccessStructure(
    requestingUserId: string, 
    hierarchyId: string
  ): Promise<ServiceResult<PermissionValidationResult>> {
    return handleAsync(async () => {
      Validator.validateUUID(requestingUserId);
      Validator.validateUUID(hierarchyId);

      // Get hierarchy
      const hierarchy = await this.hierarchyRepo.findById(hierarchyId);
      if (!hierarchy || !hierarchy.is_active) {
        return {
          isValid: false,
          canAccess: false,
          reason: 'Hierarchy not found or inactive'
        };
      }

      // Get user's access scope
      const accessScope = await this.getUserAccessScope(requestingUserId);
      
      // Check direct access
      const directPermission = accessScope.data.direct_permissions.find(
        p => p.hierarchy_id === hierarchyId
      );

      if (directPermission) {
        return {
          isValid: true,
          canAccess: true,
          accessLevel: 'direct',
          effectiveRole: directPermission.role
        };
      }

      // Check inherited access
      const inheritedPermission = accessScope.data.direct_permissions.find(
        p => p.inherit_to_descendants && 
             HierarchyCalculator.isDescendant(hierarchy.path, p.hierarchy_path)
      );

      if (inheritedPermission) {
        return {
          isValid: true,
          canAccess: true,
          accessLevel: 'inherited',
          effectiveRole: inheritedPermission.role
        };
      }

      return {
        isValid: true,
        canAccess: false,
        reason: 'No applicable permissions found'
      };
    });
  }

  /**
   * Get user's complete access scope
   */
  async getUserAccessScope(userId: string): Promise<ServiceResult<UserAccessScope>> {
    return handleAsync(async () => {
      Validator.validateUUID(userId);

      // Get user's direct permissions
      const permissions = await this.permissionRepo.findActiveByUserIdWithHierarchy(userId);
      
      // Get all hierarchies for inheritance calculation
      const allHierarchies = await this.hierarchyRepo.findAll();

      // Calculate access scope
      const accessScope = HierarchyCalculator.calculateAccessScope(
        permissions.map(p => ({
          hierarchy_id: p.hierarchy_id,
          hierarchy_path: p.hierarchy_path,
          hierarchy_name: p.hierarchy_name,
          inherit_to_descendants: p.inherit_to_descendants,
          source: 'direct' as const
        })),
        allHierarchies
      );

      // Get all accessible paths
      const accessiblePaths = HierarchyCalculator.getAccessiblePaths(accessScope);

      // Count accessible users
      const accessibleUserCount = await this.userRepo.countByHierarchyPaths(accessiblePaths);

      const result: UserAccessScope = {
        user_id: userId,
        accessible_hierarchy_ids: permissions.map(p => p.hierarchy_id),
        accessible_hierarchy_paths: accessiblePaths,
        total_accessible_users: accessibleUserCount,
        direct_permissions: permissions.map(p => ({
          hierarchy_id: p.hierarchy_id,
          hierarchy_path: p.hierarchy_path,
          hierarchy_name: p.hierarchy_name,
          role: p.role,
          inherit_to_descendants: p.inherit_to_descendants
        })),
        inherited_permissions: [] // Future enhancement for role-based inheritance
      };

      this.logger.info('User access scope calculated', {
        operation: 'getUserAccessScope',
        userId,
        directPermissions: result.direct_permissions.length,
        accessiblePaths: result.accessible_hierarchy_paths.length,
        totalAccessibleUsers: result.total_accessible_users
      });

      return result;
    });
  }

  // Private helper methods

  private validateGrantPermissionRequest(request: GrantPermissionRequest): void {
    Validator.validateRequired(request, ['user_id', 'hierarchy_id', 'role']);
    Validator.validateUUID(request.user_id);
    Validator.validateUUID(request.hierarchy_id);
    
    if (!Object.values(PermissionRole).includes(request.role)) {
      throw new ValidationError(`Invalid role: ${request.role}`, 'role');
    }

    if (request.expires_at && request.expires_at <= new Date()) {
      throw new ValidationError('Expiration date must be in the future', 'expires_at');
    }
  }

  private async validatePermissionBusinessRules(
    request: GrantPermissionRequest,
    user: User,
    hierarchy: HierarchyStructure
  ): Promise<void> {
    // Rule: Cannot grant permission above user's base hierarchy level
    if (hierarchy.level < user.base_hierarchy_level) {
      throw new BusinessRuleError(
        'Cannot grant permission to hierarchy above user base level',
        'PERMISSION_ABOVE_BASE_LEVEL'
      );
    }

    // Rule: Admin role requires special validation
    if (request.role === PermissionRole.ADMIN) {
      // Additional admin validation logic here
      this.logger.warn('Admin permission granted', {
        operation: 'validatePermissionBusinessRules',
        userId: request.user_id,
        hierarchyId: request.hierarchy_id
      });
    }
  }

  private async canUserGrantPermission(
    userId: string, 
    hierarchyId: string, 
    role: PermissionRole
  ): Promise<PermissionValidationResult> {
    try {
      const userPermissions = await this.permissionRepo.findActiveByUserIdWithHierarchy(userId);
      
      // Check if user has admin access to this hierarchy or its ancestors
      const hierarchy = await this.hierarchyRepo.findById(hierarchyId);
      if (!hierarchy) {
        return { isValid: false, canAccess: false, reason: 'Hierarchy not found' };
      }

      // Check direct permission
      const directPermission = userPermissions.find(p => p.hierarchy_id === hierarchyId);
      if (directPermission && (directPermission.role === PermissionRole.ADMIN || 
                              directPermission.role === PermissionRole.MANAGER)) {
        return { isValid: true, canAccess: true, accessLevel: 'direct', effectiveRole: directPermission.role };
      }

      // Check inherited permission from ancestors
      const ancestorPaths = HierarchyCalculator.getAncestorPaths(hierarchy.path);
      const inheritedPermission = userPermissions.find(p => 
        p.inherit_to_descendants && 
        ancestorPaths.includes(p.hierarchy_path) &&
        (p.role === PermissionRole.ADMIN || p.role === PermissionRole.MANAGER)
      );

      if (inheritedPermission) {
        return { isValid: true, canAccess: true, accessLevel: 'inherited', effectiveRole: inheritedPermission.role };
      }

      return { isValid: true, canAccess: false, reason: 'Insufficient permissions to grant access' };
    } catch (error) {
      this.logger.error('Error checking grant permission capability', {
        operation: 'canUserGrantPermission',
        userId,
        hierarchyId
      }, error as Error);
      return { isValid: false, canAccess: false, reason: 'Error validating permissions' };
    }
  }

  private async canUserRevokePermission(
    userId: string, 
    permission: Permission
  ): Promise<PermissionValidationResult> {
    // User can revoke their own permissions
    if (permission.user_id === userId) {
      return { isValid: true, canAccess: true, accessLevel: 'direct' };
    }

    // Check if user has admin/manager access to the hierarchy
    return this.canUserGrantPermission(userId, permission.hierarchy_id, PermissionRole.MANAGER);
  }

  private async canUserUpdatePermission(
    userId: string, 
    permission: Permission
  ): Promise<PermissionValidationResult> {
    // Use same logic as revoke for now
    return this.canUserRevokePermission(userId, permission);
  }

  private buildUserSearchCriteria(
    filters: UserAccessFilters, 
    accessScope: UserAccessScope
  ): any {
    const criteria: any = {
      hierarchy_paths: accessScope.accessible_hierarchy_paths,
      page: filters.page || 1,
      limit: Math.min(filters.limit || 50, 100), // Cap at 100
      sort_by: filters.sort_by || 'name',
      sort_order: filters.sort_order || 'asc'
    };

    if (filters.search) {
      criteria.search = filters.search.trim();
    }

    if (filters.hierarchy_id) {
      criteria.hierarchy_id = filters.hierarchy_id;
    }

    if (filters.is_active !== undefined) {
      criteria.is_active = filters.is_active;
    }

    return criteria;
  }

  private async enhanceUsersWithAccessContext(
    users: User[], 
    accessScope: UserAccessScope
  ): Promise<UserWithAccessContext[]> {
    return users.map(user => {
      // Determine access level and source
      const directPermission = accessScope.direct_permissions.find(
        p => p.hierarchy_path === user.hierarchy_path
      );

      let accessLevel: 'direct' | 'inherited' = 'inherited';
      let permissionSource: 'direct' | 'role' = 'direct';
      let accessibleThrough: string[] = [];

      if (directPermission) {
        accessLevel = 'direct';
        accessibleThrough.push(directPermission.hierarchy_path);
      } else {
        // Find which ancestor permissions provide access
        const ancestorPermissions = accessScope.direct_permissions.filter(
          p => p.inherit_to_descendants && 
               HierarchyCalculator.isDescendant(user.hierarchy_path, p.hierarchy_path)
        );
        accessibleThrough = ancestorPermissions.map(p => p.hierarchy_path);
      }

      // Remove password_hash from user
      const { password_hash: _, ...userWithoutPassword } = user;

      return {
        ...userWithoutPassword,
        access_level: accessLevel,
        permission_source: permissionSource,
        user_hierarchy_path: user.hierarchy_path,
        user_hierarchy_name: user.hierarchy_name,
        accessible_through: accessibleThrough
      };
    });
  }
}