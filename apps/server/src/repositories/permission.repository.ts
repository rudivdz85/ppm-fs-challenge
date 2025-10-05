import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { WhereCondition } from './utils/query-builder';
import { User, HierarchyStructure, Permission, UserPermission, UserRole } from '../types/temp-types';
import { NotFoundError, ValidationError } from '../models';
import { randomUUID } from 'crypto';

/**
 * Repository for managing permissions and access control
 * Handles the core business logic for hierarchical permission system
 */
export class PermissionRepository extends BaseRepository {
  private readonly USER_PERMISSIONS_TABLE = 'user_permissions';
  private readonly USER_ROLES_TABLE = 'user_roles';
  private readonly PERMISSIONS_TABLE = 'permissions';
  private readonly ROLES_TABLE = 'roles';
  private readonly ROLE_PERMISSIONS_TABLE = 'role_permissions';

  constructor(client?: PoolClient) {
    super(client);
  }

  /**
   * Grant a direct permission to a user at a specific hierarchy level
   * @param data - Permission grant data
   * @returns Promise<UserPermission>
   */
  async grantUserPermission(data: {
    user_id: string;
    permission_id: string;
    hierarchy_id: string;
    inherit_to_descendants?: boolean;
    valid_from?: Date;
    valid_until?: Date;
    granted_by: string;
    context_data?: Record<string, any>;
  }): Promise<UserPermission> {
    this.validateRequiredFields(data, ['user_id', 'permission_id', 'hierarchy_id', 'granted_by']);
    this.validateUUID(data.user_id);
    this.validateUUID(data.permission_id);
    this.validateUUID(data.hierarchy_id);
    this.validateUUID(data.granted_by);

    // Verify user, permission, and hierarchy exist
    await this.validateEntitiesExist(data.user_id, data.permission_id, data.hierarchy_id);

    // Check if permission already exists
    const existing = await this.findOne<UserPermission>(
      this.USER_PERMISSIONS_TABLE,
      [
        { field: 'user_id', operator: '=', value: data.user_id },
        { field: 'permission_id', operator: '=', value: data.permission_id },
        { field: 'hierarchy_id', operator: '=', value: data.hierarchy_id },
        { field: 'is_active', operator: '=', value: true }
      ]
    );

    if (existing) {
      throw new ValidationError('Permission already granted to user at this hierarchy level');
    }

    const insertData = {
      user_id: data.user_id,
      permission_id: data.permission_id,
      hierarchy_id: data.hierarchy_id,
      inherit_to_descendants: data.inherit_to_descendants ?? true,
      valid_from: data.valid_from || new Date(),
      valid_until: data.valid_until || null,
      granted_by: data.granted_by,
      context_data: JSON.stringify(data.context_data || {}),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    return this.insertOne<UserPermission>(this.USER_PERMISSIONS_TABLE, insertData);
  }

  /**
   * Assign a role to a user at a specific hierarchy level
   * @param data - Role assignment data
   * @returns Promise<UserRole>
   */
  async assignUserRole(data: {
    user_id: string;
    role_id: string;
    hierarchy_id: string;
    inherit_to_descendants?: boolean;
    valid_from?: Date;
    valid_until?: Date;
    assigned_by: string;
  }): Promise<UserRole> {
    this.validateRequiredFields(data, ['user_id', 'role_id', 'hierarchy_id', 'assigned_by']);
    this.validateUUID(data.user_id);
    this.validateUUID(data.role_id);
    this.validateUUID(data.hierarchy_id);
    this.validateUUID(data.assigned_by);

    // Verify entities exist
    const [userExists, roleExists, hierarchyExists] = await Promise.all([
      this.exists('users', [
        { field: 'id', operator: '=', value: data.user_id },
        { field: 'is_active', operator: '=', value: true }
      ]),
      this.exists(this.ROLES_TABLE, [
        { field: 'id', operator: '=', value: data.role_id },
        { field: 'is_active', operator: '=', value: true }
      ]),
      this.exists('hierarchy_structures', [
        { field: 'id', operator: '=', value: data.hierarchy_id },
        { field: 'is_active', operator: '=', value: true }
      ])
    ]);

    if (!userExists) throw new NotFoundError('User', data.user_id);
    if (!roleExists) throw new NotFoundError('Role', data.role_id);
    if (!hierarchyExists) throw new NotFoundError('Hierarchy structure', data.hierarchy_id);

    // Check if role already assigned
    const existing = await this.findOne<UserRole>(
      this.USER_ROLES_TABLE,
      [
        { field: 'user_id', operator: '=', value: data.user_id },
        { field: 'role_id', operator: '=', value: data.role_id },
        { field: 'hierarchy_id', operator: '=', value: data.hierarchy_id },
        { field: 'is_active', operator: '=', value: true }
      ]
    );

    if (existing) {
      throw new ValidationError('Role already assigned to user at this hierarchy level');
    }

    const insertData = {
      user_id: data.user_id,
      role_id: data.role_id,
      hierarchy_id: data.hierarchy_id,
      inherit_to_descendants: data.inherit_to_descendants ?? true,
      valid_from: data.valid_from || new Date(),
      valid_until: data.valid_until || null,
      assigned_by: data.assigned_by,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    return this.insertOne<UserRole>(this.USER_ROLES_TABLE, insertData);
  }

  /**
   * Get all permissions for a user (direct + role-based)
   * @param userId - User ID
   * @param includeExpired - Whether to include expired permissions
   * @returns Promise<Array>
   */
  async findByUserId(userId: string, includeExpired: boolean = false): Promise<Array<{
    permission: Permission;
    hierarchy: HierarchyStructure;
    source: 'direct' | 'role';
    source_name?: string;
    inherit_to_descendants: boolean;
    valid_from: Date;
    valid_until: Date | null;
    context_data: Record<string, any>;
  }>> {
    this.validateUUID(userId);

    const timeClause = includeExpired ? '' : `
      AND (up.valid_until IS NULL OR up.valid_until > CURRENT_TIMESTAMP)
      AND (ur.valid_until IS NULL OR ur.valid_until > CURRENT_TIMESTAMP)
    `;

    const query = `
      WITH user_effective_permissions AS (
        -- Direct permissions
        SELECT 
          p.*,
          h.*,
          'direct' as source,
          NULL as source_name,
          up.inherit_to_descendants,
          up.valid_from,
          up.valid_until,
          up.context_data
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        JOIN hierarchy_structures h ON up.hierarchy_id = h.id
        WHERE up.user_id = $1 
          AND up.is_active = true 
          AND p.is_active = true 
          AND h.is_active = true
          ${timeClause.replace(/ur\./g, 'up.')}
        
        UNION
        
        -- Role-based permissions
        SELECT 
          p.*,
          h.*,
          'role' as source,
          r.name as source_name,
          ur.inherit_to_descendants,
          ur.valid_from,
          ur.valid_until,
          '{}'::jsonb as context_data
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        JOIN roles r ON ur.role_id = r.id
        JOIN hierarchy_structures h ON ur.hierarchy_id = h.id
        WHERE ur.user_id = $1 
          AND ur.is_active = true 
          AND rp.is_active = true 
          AND p.is_active = true 
          AND r.is_active = true 
          AND h.is_active = true
          ${timeClause.replace(/up\./g, 'ur.')}
      )
      SELECT * FROM user_effective_permissions
      ORDER BY hierarchy_path, resource, action
    `;

    const result = await this.query(query, [userId]);
    return result.rows.map(row => ({
      permission: {
        id: row.id,
        name: row.name,
        code: row.code,
        resource: row.resource,
        action: row.action,
        scope: row.scope,
        conditions: row.conditions,
        is_active: row.is_active
      },
      hierarchy: {
        id: row.hierarchy_id,
        name: row.hierarchy_name,
        code: row.hierarchy_code,
        path: row.hierarchy_path,
        parent_id: row.parent_id,
        level: row.level,
        sort_order: row.sort_order,
        metadata: row.metadata,
        is_active: row.h_is_active
      },
      source: row.source,
      source_name: row.source_name,
      inherit_to_descendants: row.inherit_to_descendants,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
      context_data: row.context_data
    }));
  }

  /**
   * Get all permissions for a specific hierarchy structure
   * @param structureId - Hierarchy structure ID
   * @returns Promise<Array>
   */
  async findByStructureId(structureId: string): Promise<Array<{
    user: User;
    permission: Permission;
    source: 'direct' | 'role';
    source_name?: string;
    inherit_to_descendants: boolean;
    valid_until: Date | null;
  }>> {
    this.validateUUID(structureId);

    const query = `
      WITH structure_permissions AS (
        -- Direct permissions
        SELECT 
          u.*,
          p.*,
          'direct' as source,
          NULL as source_name,
          up.inherit_to_descendants,
          up.valid_until
        FROM user_permissions up
        JOIN users u ON up.user_id = u.id
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.hierarchy_id = $1 
          AND up.is_active = true 
          AND u.is_active = true 
          AND p.is_active = true
          AND (up.valid_until IS NULL OR up.valid_until > CURRENT_TIMESTAMP)
        
        UNION
        
        -- Role-based permissions
        SELECT 
          u.*,
          p.*,
          'role' as source,
          r.name as source_name,
          ur.inherit_to_descendants,
          ur.valid_until
        FROM user_roles ur
        JOIN users u ON ur.user_id = u.id
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.hierarchy_id = $1 
          AND ur.is_active = true 
          AND u.is_active = true 
          AND rp.is_active = true 
          AND p.is_active = true 
          AND r.is_active = true
          AND (ur.valid_until IS NULL OR ur.valid_until > CURRENT_TIMESTAMP)
      )
      SELECT * FROM structure_permissions
      ORDER BY last_name, first_name, resource, action
    `;

    const result = await this.query(query, [structureId]);
    return result.rows.map(row => ({
      user: {
        id: row.user_id || row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        base_hierarchy_id: row.base_hierarchy_id,
        is_active: row.u_is_active || row.is_active,
        is_verified: row.is_verified,
        timezone: row.timezone,
        profile_data: row.profile_data
      },
      permission: {
        id: row.permission_id || row.id,
        name: row.name,
        code: row.code,
        resource: row.resource,
        action: row.action,
        scope: row.scope,
        conditions: row.conditions,
        is_active: row.p_is_active || row.is_active
      },
      source: row.source,
      source_name: row.source_name,
      inherit_to_descendants: row.inherit_to_descendants,
      valid_until: row.valid_until
    }));
  }

  /**
   * Check if a user has a specific permission at a hierarchy level
   * @param userId - User ID
   * @param resource - Permission resource
   * @param action - Permission action
   * @param hierarchyId - Hierarchy structure ID
   * @returns Promise<boolean>
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    hierarchyId: string
  ): Promise<boolean> {
    this.validateUUID(userId);
    this.validateUUID(hierarchyId);

    const query = `
      SELECT check_user_permission_fast($1, $2, $3, $4) as has_permission
    `;

    const result = await this.query(query, [userId, resource, action, hierarchyId]);
    return result.rows[0]?.has_permission || false;
  }

  /**
   * Get all hierarchy structures that a user can access
   * Core business logic - determines what data a user can view/modify
   * @param userId - User ID
   * @param minPermissionLevel - Minimum permission level required ('read', 'write', 'manage')
   * @returns Promise<HierarchyStructure[]>
   */
  async getAccessibleStructures(
    userId: string,
    minPermissionLevel: 'read' | 'write' | 'manage' = 'read'
  ): Promise<HierarchyStructure[]> {
    this.validateUUID(userId);

    const permissionActions = {
      read: ['read', 'write', 'manage'],
      write: ['write', 'manage'],
      manage: ['manage']
    };

    const allowedActions = permissionActions[minPermissionLevel];

    const query = `
      WITH user_accessible_hierarchies AS (
        -- Direct permissions
        SELECT DISTINCT h.*
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        JOIN hierarchy_structures h ON up.hierarchy_id = h.id
        JOIN hierarchy_structures target_h ON (
          target_h.id = h.id OR 
          (up.inherit_to_descendants = true AND target_h.path <@ h.path)
        )
        WHERE up.user_id = $1 
          AND up.is_active = true 
          AND p.is_active = true 
          AND h.is_active = true 
          AND target_h.is_active = true
          AND p.action = ANY($2)
          AND (up.valid_until IS NULL OR up.valid_until > CURRENT_TIMESTAMP)
        
        UNION
        
        -- Role-based permissions
        SELECT DISTINCT target_h.*
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        JOIN hierarchy_structures h ON ur.hierarchy_id = h.id
        JOIN hierarchy_structures target_h ON (
          target_h.id = h.id OR 
          (ur.inherit_to_descendants = true AND target_h.path <@ h.path)
        )
        WHERE ur.user_id = $1 
          AND ur.is_active = true 
          AND rp.is_active = true 
          AND p.is_active = true 
          AND h.is_active = true 
          AND target_h.is_active = true
          AND p.action = ANY($2)
          AND (ur.valid_until IS NULL OR ur.valid_until > CURRENT_TIMESTAMP)
        
        UNION
        
        -- User's base hierarchy (always accessible for reading own data)
        SELECT h.*
        FROM users u
        JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
        WHERE u.id = $1 AND u.is_active = true AND h.is_active = true
      )
      SELECT * FROM user_accessible_hierarchies
      ORDER BY path
    `;

    const result = await this.query(query, [userId, allowedActions]);
    return result.rows;
  }

  /**
   * Get all users that the specified user can access/query
   * Core business logic - determines which users can be seen by the requesting user
   * @param userId - Requesting user ID
   * @param permissionType - Type of access needed ('view', 'manage')
   * @returns Promise<User[]>
   */
  async getAccessibleUsers(
    userId: string,
    permissionType: 'view' | 'manage' = 'view'
  ): Promise<User[]> {
    this.validateUUID(userId);

    const resourcePermissions = {
      view: ['users:read', 'users:write', 'users:manage'],
      manage: ['users:write', 'users:manage']
    };

    const requiredPermissions = resourcePermissions[permissionType];

    const query = `
      WITH accessible_hierarchies AS (
        -- Get all hierarchies the user has access to
        SELECT DISTINCT target_h.id as hierarchy_id
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        JOIN hierarchy_structures h ON up.hierarchy_id = h.id
        JOIN hierarchy_structures target_h ON (
          target_h.id = h.id OR 
          (up.inherit_to_descendants = true AND target_h.path <@ h.path)
        )
        WHERE up.user_id = $1 
          AND up.is_active = true 
          AND p.is_active = true 
          AND h.is_active = true 
          AND target_h.is_active = true
          AND (p.resource || ':' || p.action) = ANY($2)
          AND (up.valid_until IS NULL OR up.valid_until > CURRENT_TIMESTAMP)
        
        UNION
        
        -- Role-based access
        SELECT DISTINCT target_h.id as hierarchy_id
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        JOIN hierarchy_structures h ON ur.hierarchy_id = h.id
        JOIN hierarchy_structures target_h ON (
          target_h.id = h.id OR 
          (ur.inherit_to_descendants = true AND target_h.path <@ h.path)
        )
        WHERE ur.user_id = $1 
          AND ur.is_active = true 
          AND rp.is_active = true 
          AND p.is_active = true 
          AND h.is_active = true 
          AND target_h.is_active = true
          AND (p.resource || ':' || p.action) = ANY($2)
          AND (ur.valid_until IS NULL OR ur.valid_until > CURRENT_TIMESTAMP)
        
        UNION
        
        -- User can always access their own data
        SELECT u.base_hierarchy_id as hierarchy_id
        FROM users u
        WHERE u.id = $1 AND u.is_active = true
      )
      SELECT DISTINCT 
        u.*,
        h.name as hierarchy_name,
        h.code as hierarchy_code,
        h.path as hierarchy_path,
        h.level as hierarchy_level
      FROM accessible_hierarchies ah
      JOIN users u ON u.base_hierarchy_id = ah.hierarchy_id
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE u.is_active = true AND h.is_active = true
      ORDER BY h.path, u.last_name, u.first_name
    `;

    const result = await this.query(query, [userId, requiredPermissions]);
    return result.rows;
  }

  /**
   * Find permission by user and hierarchy
   * @param userId - User ID
   * @param hierarchyId - Hierarchy ID
   * @returns Promise<Permission | null>
   */
  async findByUserAndHierarchy(userId: string, hierarchyId: string): Promise<Permission | null> {
    const result = await this.findOne<Permission>(
      this.USER_PERMISSIONS_TABLE,
      [
        { field: 'user_id', operator: '=', value: userId },
        { field: 'hierarchy_id', operator: '=', value: hierarchyId },
        { field: 'is_active', operator: '=', value: true }
      ]
    );
    return result;
  }

  /**
   * Create a new permission
   * @param data - Permission data
   * @returns Promise<Permission>
   */
  async create(data: any): Promise<Permission> {
    const result = await this.insertOne<Permission>(
      this.USER_PERMISSIONS_TABLE,
      {
        ...data,
        id: randomUUID(),
        created_at: new Date(),
        updated_at: new Date()
      }
    );
    return result;
  }

  /**
   * Find permission by ID
   * @param permissionId - Permission ID
   * @returns Promise<Permission | null>
   */
  async findById(permissionId: string): Promise<Permission | null> {
    const result = await this.findOne<Permission>(
      this.USER_PERMISSIONS_TABLE,
      [{ field: 'id', operator: '=', value: permissionId }]
    );
    return result;
  }

  /**
   * Update permission
   * @param permissionId - Permission ID
   * @param data - Update data
   * @returns Promise<Permission>
   */
  async update(permissionId: string, data: any): Promise<Permission> {
    const result = await this.updateById<Permission>(
      this.USER_PERMISSIONS_TABLE,
      permissionId,
      {
        ...data,
        updated_at: new Date()
      }
    );
    if (!result) {
      throw new NotFoundError('Permission', permissionId);
    }
    return result;
  }

  /**
   * Find active permissions by user ID with hierarchy information
   * @param userId - User ID
   * @returns Promise<Permission[]>
   */
  async findActiveByUserIdWithHierarchy(userId: string): Promise<Permission[]> {
    const query = `
      SELECT up.*, h.name as hierarchy_name, h.path as hierarchy_path
      FROM ${this.USER_PERMISSIONS_TABLE} up
      JOIN hierarchy_structures h ON up.hierarchy_id = h.id
      WHERE up.user_id = $1 AND up.is_active = true
      ORDER BY h.path, up.created_at
    `;
    
    const result = await this.query(query, [userId]);
    return result.rows;
  }

  /**
   * Revoke a user permission
   * @param permissionId - User permission ID
   * @param revokedBy - ID of user revoking the permission
   * @returns Promise<boolean>
   */
  async revokeUserPermission(permissionId: string, revokedBy: string): Promise<boolean> {
    this.validateUUID(permissionId);
    this.validateUUID(revokedBy);

    const result = await this.updateById(
      this.USER_PERMISSIONS_TABLE,
      permissionId,
      {
        is_active: false,
        revoked_at: new Date(),
        revoked_by: revokedBy,
        updated_at: new Date()
      }
    );

    return result !== null;
  }

  /**
   * Revoke a user role
   * @param userRoleId - User role assignment ID
   * @param revokedBy - ID of user revoking the role
   * @returns Promise<boolean>
   */
  async revokeUserRole(userRoleId: string, revokedBy: string): Promise<boolean> {
    this.validateUUID(userRoleId);
    this.validateUUID(revokedBy);

    const result = await this.updateById(
      this.USER_ROLES_TABLE,
      userRoleId,
      {
        is_active: false,
        revoked_at: new Date(),
        revoked_by: revokedBy,
        updated_at: new Date()
      }
    );

    return result !== null;
  }

  /**
   * Update user permission details
   * @param permissionId - User permission ID
   * @param data - Data to update
   * @returns Promise<UserPermission | null>
   */
  async updateUserPermission(permissionId: string, data: {
    inherit_to_descendants?: boolean;
    valid_until?: Date | null;
    context_data?: Record<string, any>;
  }): Promise<UserPermission | null> {
    this.validateUUID(permissionId);

    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (data.inherit_to_descendants !== undefined) {
      updateData.inherit_to_descendants = data.inherit_to_descendants;
    }
    if (data.valid_until !== undefined) {
      updateData.valid_until = data.valid_until;
    }
    if (data.context_data !== undefined) {
      updateData.context_data = JSON.stringify(data.context_data);
    }

    if (Object.keys(updateData).length === 1) { // Only updated_at
      throw new ValidationError('No data provided for update');
    }

    return this.updateById<UserPermission>(this.USER_PERMISSIONS_TABLE, permissionId, updateData);
  }

  /**
   * Bulk check multiple permissions for a user
   * @param userId - User ID
   * @param permissions - Array of permissions to check
   * @param hierarchyId - Default hierarchy ID if not specified per permission
   * @returns Promise<Record<string, boolean>>
   */
  async bulkCheckPermissions(
    userId: string,
    permissions: Array<{
      resource: string;
      action: string;
      hierarchy_id?: string;
    }>,
    hierarchyId?: string
  ): Promise<Record<string, boolean>> {
    this.validateUUID(userId);
    if (hierarchyId) this.validateUUID(hierarchyId);

    const permissionsWithHierarchy = permissions.map(p => ({
      ...p,
      hierarchy_id: p.hierarchy_id || hierarchyId
    }));

    // Validate all permissions have hierarchy_id
    for (const perm of permissionsWithHierarchy) {
      if (!perm.hierarchy_id) {
        throw new ValidationError('hierarchy_id is required for all permissions');
      }
      this.validateUUID(perm.hierarchy_id);
    }

    const query = `
      SELECT check_user_permissions_bulk($1, $2, $3) as results
    `;

    const result = await this.query(query, [
      userId,
      JSON.stringify(permissionsWithHierarchy),
      hierarchyId
    ]);

    return result.rows[0]?.results || {};
  }

  /**
   * Get permission audit trail for a user
   * @param userId - User ID
   * @param limit - Maximum number of records to return
   * @returns Promise<Array>
   */
  async getPermissionAuditTrail(userId: string, limit: number = 100): Promise<Array<{
    action: 'granted' | 'revoked' | 'updated';
    permission_name: string;
    hierarchy_name: string;
    source: 'direct' | 'role';
    performed_by: string;
    performed_at: Date;
    details: Record<string, any>;
  }>> {
    this.validateUUID(userId);

    const query = `
      WITH permission_audit AS (
        -- Direct permission grants
        SELECT 
          'granted' as action,
          p.name as permission_name,
          h.name as hierarchy_name,
          'direct' as source,
          up.granted_by as performed_by,
          up.created_at as performed_at,
          jsonb_build_object(
            'inherit_to_descendants', up.inherit_to_descendants,
            'valid_until', up.valid_until,
            'context_data', up.context_data
          ) as details
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        JOIN hierarchy_structures h ON up.hierarchy_id = h.id
        WHERE up.user_id = $1
        
        UNION ALL
        
        -- Role assignments
        SELECT 
          'granted' as action,
          r.name as permission_name,
          h.name as hierarchy_name,
          'role' as source,
          ur.assigned_by as performed_by,
          ur.created_at as performed_at,
          jsonb_build_object(
            'inherit_to_descendants', ur.inherit_to_descendants,
            'valid_until', ur.valid_until
          ) as details
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        JOIN hierarchy_structures h ON ur.hierarchy_id = h.id
        WHERE ur.user_id = $1
      )
      SELECT * FROM permission_audit
      ORDER BY performed_at DESC
      LIMIT $2
    `;

    const result = await this.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Validate that user, permission, and hierarchy entities exist
   * @private
   */
  private async validateEntitiesExist(
    userId: string,
    permissionId: string,
    hierarchyId: string
  ): Promise<void> {
    const [userExists, permissionExists, hierarchyExists] = await Promise.all([
      this.exists('users', [
        { field: 'id', operator: '=', value: userId },
        { field: 'is_active', operator: '=', value: true }
      ]),
      this.exists(this.PERMISSIONS_TABLE, [
        { field: 'id', operator: '=', value: permissionId },
        { field: 'is_active', operator: '=', value: true }
      ]),
      this.exists('hierarchy_structures', [
        { field: 'id', operator: '=', value: hierarchyId },
        { field: 'is_active', operator: '=', value: true }
      ])
    ]);

    if (!userExists) throw new NotFoundError('User', userId);
    if (!permissionExists) throw new NotFoundError('Permission', permissionId);
    if (!hierarchyExists) throw new NotFoundError('Hierarchy structure', hierarchyId);
  }
}