import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { WhereCondition, OrderByClause, buildSearchCondition } from './utils/query-builder';
import { User } from '../types/temp-types';
import { NotFoundError, ValidationError, DuplicateError } from '../models';

/**
 * Repository for managing users with hierarchy-aware operations
 * Handles CRUD operations for users table with relationships to hierarchy_structures
 */
export class UserRepository extends BaseRepository {
  private readonly TABLE_NAME = 'users';

  constructor(client?: PoolClient) {
    super(client);
  }

  /**
   * Create a new user
   * @param data - User data
   * @returns Promise<User> - Created user
   */
  async create(data: {
    email: string;
    full_name: string;
    password_hash: string;
    base_hierarchy_id: string;
    phone?: string;
    metadata?: Record<string, any>;
  }): Promise<User> {
    this.validateRequiredFields(data, ['email', 'full_name', 'password_hash', 'base_hierarchy_id']);
    this.validateEmail(data.email);
    this.validateUUID(data.base_hierarchy_id);

    // Check if email already exists
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new DuplicateError('User', 'email', data.email);
    }

    // Verify hierarchy exists
    const hierarchyExists = await this.exists('hierarchy_structures', [
      { field: 'id', operator: '=', value: data.base_hierarchy_id },
      { field: 'is_active', operator: '=', value: true }
    ]);

    if (!hierarchyExists) {
      throw new NotFoundError('Hierarchy structure', data.base_hierarchy_id);
    }

    const insertData = {
      email: data.email.toLowerCase().trim(),
      full_name: data.full_name.trim(),
      password_hash: data.password_hash,
      base_hierarchy_id: data.base_hierarchy_id,
      phone: data.phone,
      metadata: JSON.stringify(data.metadata || {}),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    return this.insertOne<User>(this.TABLE_NAME, insertData);
  }

  /**
   * Find a user by ID with joined hierarchy information
   * @param id - User ID
   * @param includeHierarchy - Whether to include hierarchy structure details
   * @returns Promise<User | null>
   */
  async findById(id: string, includeHierarchy: boolean = true): Promise<User | null> {
    this.validateUUID(id);

    if (!includeHierarchy) {
      return this.findOne<User>(
        this.TABLE_NAME,
        [
          { field: 'id', operator: '=', value: id },
          { field: 'is_active', operator: '=', value: true }
        ]
      );
    }

    const query = `
      SELECT 
        u.*,
        h.name as hierarchy_name,
        h.code as hierarchy_code,
        h.path as hierarchy_path,
        h.level as hierarchy_level
      FROM users u
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE u.id = $1 AND u.is_active = true AND h.is_active = true
    `;

    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find a user by email for authentication
   * @param email - User email
   * @param includeInactive - Whether to include inactive users
   * @returns Promise<User | null>
   */
  async findByEmail(email: string, includeInactive: boolean = false): Promise<User | null> {
    this.validateEmail(email);

    const where: WhereCondition[] = [
      { field: 'email', operator: '=', value: email.toLowerCase().trim() }
    ];

    if (!includeInactive) {
      where.push({ field: 'is_active', operator: '=', value: true });
    }

    return this.findOne<User>(this.TABLE_NAME, where);
  }

  /**
   * Find all users at a specific hierarchy structure
   * @param structureId - Hierarchy structure ID
   * @param includeInactive - Whether to include inactive users
   * @returns Promise<User[]>
   */
  async findByStructure(structureId: string, includeInactive: boolean = false): Promise<User[]> {
    this.validateUUID(structureId);

    const where: WhereCondition[] = [
      { field: 'base_hierarchy_id', operator: '=', value: structureId }
    ];

    if (!includeInactive) {
      where.push({ field: 'is_active', operator: '=', value: true });
    }

    return this.findMany<User>(this.TABLE_NAME, {
      where,
      orderBy: [
        { field: 'full_name', direction: 'ASC' }
      ]
    });
  }

  /**
   * Find all users in a hierarchy structure and its descendants using ltree path matching
   * @param path - Hierarchy path (e.g., 'australia.sydney')
   * @param includeInactive - Whether to include inactive users
   * @returns Promise<User[]>
   */
  async findByStructurePath(path: string, includeInactive: boolean = false): Promise<User[]> {
    if (!path || typeof path !== 'string') {
      throw new ValidationError('Path must be a non-empty string');
    }

    const activeClause = includeInactive ? '' : 'AND u.is_active = true';

    const query = `
      SELECT 
        u.*,
        h.name as hierarchy_name,
        h.code as hierarchy_code,
        h.path as hierarchy_path,
        h.level as hierarchy_level
      FROM users u
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE h.path <@ $1::ltree 
        AND h.is_active = true
        ${activeClause}
      ORDER BY h.path, u.full_name
    `;

    const result = await this.query(query, [path]);
    return result.rows;
  }

  /**
   * Search users by name or email with hierarchy context
   * @param searchTerm - Search term for name or email
   * @param options - Search options
   * @returns Promise<User[]>
   */
  async searchUsers(searchTerm: string, options: {
    hierarchyPath?: string;
    includeInactive?: boolean;
    isActive?: boolean;
    orderBy?: OrderByClause[];
    limit?: number;
    offset?: number;
  } = {}): Promise<User[]> {
    const { hierarchyPath, includeInactive = false, isActive, orderBy = [], limit, offset } = options;

    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new ValidationError('Search term must be at least 2 characters');
    }

    let query = `
      SELECT 
        u.*,
        h.name as hierarchy_name,
        h.code as hierarchy_code,
        h.path as hierarchy_path,
        h.level as hierarchy_level
      FROM users u
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE h.is_active = true
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Add hierarchy path filter
    if (hierarchyPath) {
      query += ` AND h.path <@ $${paramIndex++}::ltree`;
      params.push(hierarchyPath);
    }

    // Add active filter
    if (isActive !== undefined) {
      query += ` AND u.is_active = $${paramIndex++}`;
      params.push(isActive);
    } else if (!includeInactive) {
      query += ` AND u.is_active = true`;
    }

    // Add search conditions
    const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
    query += ` AND (
      LOWER(u.full_name) LIKE $${paramIndex} OR
      LOWER(u.email) LIKE $${paramIndex}
    )`;
    params.push(searchPattern);
    paramIndex++;

    // Add ordering
    if (orderBy.length > 0) {
      const orderClauses = orderBy.map(({ field, direction }) => {
        // Map common field names to proper database columns
        let dbField = field;
        switch (field) {
          case 'name':
          case 'full_name':
            dbField = 'u.full_name';
            break;
          case 'email':
            dbField = 'u.email';
            break;
          case 'created_at':
            dbField = 'u.created_at';
            break;
          case 'hierarchy':
          case 'hierarchy_path':
            dbField = 'h.path';
            break;
          case 'is_active':
            dbField = 'u.is_active';
            break;
          default:
            dbField = field.includes('.') ? field : `u.${field}`;
        }
        return `${dbField} ${direction}`;
      });
      query += ` ORDER BY ${orderClauses.join(', ')}`;
    } else {
      query += ` ORDER BY h.path, u.full_name`;
    }

    // Add pagination
    if (limit !== undefined) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(limit);
    }
    if (offset !== undefined) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(offset);
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Get paginated list of all users with hierarchy information
   * @param options - Query options
   * @returns Promise<{users: User[], total: number}>
   */
  async findAll(options: {
    includeInactive?: boolean;
    isActive?: boolean;
    hierarchyPath?: string;
    orderBy?: OrderByClause[];
    limit?: number;
    offset?: number;
  } = {}): Promise<{ users: User[], total: number }> {
    const { includeInactive = false, isActive, hierarchyPath, orderBy = [], limit, offset } = options;

    let baseQuery = `
      FROM users u
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE h.is_active = true
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Add hierarchy path filter
    if (hierarchyPath) {
      baseQuery += ` AND h.path <@ $${paramIndex++}::ltree`;
      params.push(hierarchyPath);
    }

    // Add active filter
    if (isActive !== undefined) {
      baseQuery += ` AND u.is_active = $${paramIndex++}`;
      params.push(isActive);
    } else if (!includeInactive) {
      baseQuery += ` AND u.is_active = true`;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Build data query
    let dataQuery = `
      SELECT 
        u.*,
        h.name as hierarchy_name,
        h.code as hierarchy_code,
        h.path as hierarchy_path,
        h.level as hierarchy_level
      ${baseQuery}
    `;

    // Add ordering
    if (orderBy.length > 0) {
      const orderClauses = orderBy.map(({ field, direction }) => {
        const prefixedField = field.includes('.') ? field : `u.${field}`;
        return `${prefixedField} ${direction}`;
      });
      dataQuery += ` ORDER BY ${orderClauses.join(', ')}`;
    } else {
      dataQuery += ` ORDER BY h.path, u.full_name`;
    }

    // Add pagination
    if (limit !== undefined) {
      dataQuery += ` LIMIT $${paramIndex++}`;
      params.push(limit);
    }
    if (offset !== undefined) {
      dataQuery += ` OFFSET $${paramIndex++}`;
      params.push(offset);
    }

    const dataResult = await this.query(dataQuery, params);

    return {
      users: dataResult.rows,
      total
    };
  }

  /**
   * Update user information
   * @param id - User ID
   * @param data - Data to update
   * @returns Promise<User | null>
   */
  async update(id: string, data: {
    full_name?: string;
    email?: string;
    phone?: string;
    base_hierarchy_id?: string;
    metadata?: Record<string, any>;
  }): Promise<User | null> {
    this.validateUUID(id);

    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (data.full_name !== undefined) updateData.full_name = data.full_name.trim();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);

    // Handle email update with uniqueness check
    if (data.email !== undefined) {
      this.validateEmail(data.email);
      const existingUser = await this.findByEmail(data.email);
      if (existingUser && existingUser.id !== id) {
        throw new DuplicateError('User', 'email', data.email);
      }
      updateData.email = data.email.toLowerCase().trim();
    }

    // Handle hierarchy change with validation
    if (data.base_hierarchy_id !== undefined) {
      this.validateUUID(data.base_hierarchy_id);
      const hierarchyExists = await this.exists('hierarchy_structures', [
        { field: 'id', operator: '=', value: data.base_hierarchy_id },
        { field: 'is_active', operator: '=', value: true }
      ]);

      if (!hierarchyExists) {
        throw new NotFoundError('Hierarchy structure', data.base_hierarchy_id);
      }
      updateData.base_hierarchy_id = data.base_hierarchy_id;
    }

    if (Object.keys(updateData).length === 1) { // Only updated_at
      throw new ValidationError('No data provided for update');
    }

    return this.updateById<User>(this.TABLE_NAME, id, updateData);
  }

  /**
   * Update user password
   * @param id - User ID
   * @param passwordHash - New password hash
   * @returns Promise<boolean>
   */
  async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    this.validateUUID(id);

    if (!passwordHash || typeof passwordHash !== 'string') {
      throw new ValidationError('Password hash is required');
    }

    const result = await this.updateById(
      this.TABLE_NAME,
      id,
      {
        password_hash: passwordHash,
        updated_at: new Date()
      }
    );

    return result !== null;
  }

  /**
   * Soft delete a user (set is_active = false)
   * @param id - User ID
   * @returns Promise<boolean>
   */
  async delete(id: string): Promise<boolean> {
    this.validateUUID(id);
    return this.softDelete(this.TABLE_NAME, id);
  }

  /**
   * Reactivate a soft-deleted user
   * @param id - User ID
   * @returns Promise<boolean>
   */
  async reactivate(id: string): Promise<boolean> {
    this.validateUUID(id);

    const result = await this.updateById(
      this.TABLE_NAME,
      id,
      {
        is_active: true,
        updated_at: new Date()
      }
    );

    return result !== null;
  }

  /**
   * Verify a user's email
   * @param id - User ID
   * @returns Promise<boolean>
   */
  async verifyEmail(id: string): Promise<boolean> {
    this.validateUUID(id);

    const result = await this.updateById(
      this.TABLE_NAME,
      id,
      {
        is_verified: true,
        updated_at: new Date()
      }
    );

    return result !== null;
  }

  /**
   * Get user statistics by hierarchy
   * @param hierarchyPath - Optional hierarchy path to filter
   * @returns Promise<object> - User statistics
   */
  async getUserStatistics(hierarchyPath?: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    usersByLevel: Array<{ level: number; count: number }>;
  }> {
    let baseQuery = `
      FROM users u
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE h.is_active = true
    `;

    const params: any[] = [];
    if (hierarchyPath) {
      baseQuery += ` AND h.path <@ $1::ltree`;
      params.push(hierarchyPath);
    }

    // Get basic statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE u.is_active = true) as active_users,
        COUNT(*) FILTER (WHERE u.is_verified = true AND u.is_active = true) as verified_users
      ${baseQuery}
    `;

    const statsResult = await this.query(statsQuery, params);
    const stats = statsResult.rows[0];

    // Get user distribution by hierarchy level
    const levelQuery = `
      SELECT 
        h.level,
        COUNT(u.id) as count
      ${baseQuery}
        AND u.is_active = true
      GROUP BY h.level
      ORDER BY h.level
    `;

    const levelResult = await this.query(levelQuery, params);

    return {
      totalUsers: parseInt(stats.total_users),
      activeUsers: parseInt(stats.active_users),
      verifiedUsers: parseInt(stats.verified_users),
      usersByLevel: levelResult.rows.map(row => ({
        level: parseInt(row.level),
        count: parseInt(row.count)
      }))
    };
  }

  /**
   * Find users who recently joined (within specified days)
   * @param days - Number of days to look back
   * @param hierarchyPath - Optional hierarchy path to filter
   * @returns Promise<User[]>
   */
  async findRecentUsers(days: number = 30, hierarchyPath?: string): Promise<User[]> {
    if (days <= 0) {
      throw new ValidationError('Days must be positive');
    }

    let query = `
      SELECT 
        u.*,
        h.name as hierarchy_name,
        h.code as hierarchy_code,
        h.path as hierarchy_path,
        h.level as hierarchy_level
      FROM users u
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE h.is_active = true
        AND u.is_active = true
        AND u.created_at >= CURRENT_DATE - INTERVAL '${days} days'
    `;

    const params: any[] = [];
    if (hierarchyPath) {
      query += ` AND h.path <@ $1::ltree`;
      params.push(hierarchyPath);
    }

    query += ` ORDER BY u.created_at DESC`;

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Bulk update user hierarchy assignments
   * @param userIds - Array of user IDs
   * @param newHierarchyId - New hierarchy structure ID
   * @returns Promise<number> - Number of updated users
   */
  async bulkUpdateHierarchy(userIds: string[], newHierarchyId: string): Promise<number> {
    if (!userIds || userIds.length === 0) {
      throw new ValidationError('User IDs array cannot be empty');
    }

    this.validateUUID(newHierarchyId);
    userIds.forEach(id => this.validateUUID(id));

    // Verify hierarchy exists
    const hierarchyExists = await this.exists('hierarchy_structures', [
      { field: 'id', operator: '=', value: newHierarchyId },
      { field: 'is_active', operator: '=', value: true }
    ]);

    if (!hierarchyExists) {
      throw new NotFoundError('Hierarchy structure', newHierarchyId);
    }

    const where: WhereCondition[] = [
      { field: 'id', operator: 'IN', value: userIds },
      { field: 'is_active', operator: '=', value: true }
    ];

    const results = await this.updateMany<User>(
      this.TABLE_NAME,
      {
        base_hierarchy_id: newHierarchyId,
        updated_at: new Date()
      },
      where
    );

    return results.length;
  }

  /**
   * Search users with hierarchy information
   * @param searchCriteria - Search criteria
   * @returns Promise<User[]>
   */
  async searchUsersWithHierarchy(searchCriteria: any): Promise<User[]> {
    const query = `
      SELECT u.*, h.name as hierarchy_name, h.path as hierarchy_path
      FROM users u
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE u.is_active = true
      AND (
        u.full_name ILIKE $1 
        OR u.email ILIKE $1
        OR h.name ILIKE $1
      )
      ORDER BY u.full_name
      LIMIT $2
    `;
    
    const searchTerm = `%${searchCriteria.search || ''}%`;
    const limit = searchCriteria.limit || 50;
    
    const result = await this.query(query, [searchTerm, limit]);
    return result.rows;
  }

  /**
   * Count users by hierarchy paths
   * @param hierarchyPaths - Array of hierarchy paths
   * @returns Promise<number>
   */
  async countByHierarchyPaths(hierarchyPaths: string[]): Promise<number> {
    if (!hierarchyPaths || hierarchyPaths.length === 0) {
      return 0;
    }
    
    // Use OR conditions instead of ANY to avoid ltree issues
    const conditions = hierarchyPaths.map((_, index) => `h.path = $${index + 1}`).join(' OR ');
    const query = `
      SELECT COUNT(*) as count
      FROM users u
      JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
      WHERE (${conditions})
      AND u.is_active = true
    `;
    
    const result = await this.query(query, hierarchyPaths);
    return parseInt(result.rows[0]?.count || '0');
  }
}