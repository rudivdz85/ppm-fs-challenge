import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { WhereCondition, OrderByClause } from './utils/query-builder';
import { HierarchyStructure } from '@ppm/types';
import { NotFoundError, ValidationError } from '../models';

/**
 * Repository for managing hierarchical organizational structures
 * Handles CRUD operations for hierarchy_structures table using ltree for efficient queries
 */
export class HierarchyRepository extends BaseRepository {
  private readonly TABLE_NAME = 'hierarchy_structures';

  constructor(client?: PoolClient) {
    super(client);
  }

  /**
   * Create a new hierarchy node
   * @param data - Hierarchy node data
   * @returns Promise<HierarchyStructure> - Created hierarchy node
   */
  async create(data: {
    name: string;
    code: string;
    parent_id?: string | null;
    sort_order?: number;
    metadata?: Record<string, any>;
  }): Promise<HierarchyStructure> {
    this.validateRequiredFields(data, ['name', 'code']);

    // Validate parent exists if provided
    let parentPath: string = '';
    let level: number = 0;

    if (data.parent_id) {
      this.validateUUID(data.parent_id);
      const parent = await this.findById(data.parent_id);
      if (!parent) {
        throw new NotFoundError('Parent hierarchy node', data.parent_id);
      }
      parentPath = parent.path;
      level = parent.level + 1;
    }

    // Generate the ltree path
    const path = parentPath ? `${parentPath}.${data.code}` : data.code;

    // Validate code uniqueness within the same parent
    const existingWithCode = await this.findOne<HierarchyStructure>(
      this.TABLE_NAME,
      [
        { field: 'code', operator: '=', value: data.code },
        { field: 'parent_id', operator: data.parent_id ? '=' : 'IS', value: data.parent_id || null }
      ]
    );

    if (existingWithCode) {
      throw new ValidationError(`Code '${data.code}' already exists at this level`);
    }

    const insertData = {
      name: data.name,
      code: data.code,
      path,
      parent_id: data.parent_id || null,
      level,
      sort_order: data.sort_order || 0,
      metadata: JSON.stringify(data.metadata || {}),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    return this.insertOne<HierarchyStructure>(this.TABLE_NAME, insertData);
  }

  /**
   * Find a hierarchy node by ID
   * @param id - Node ID
   * @returns Promise<HierarchyStructure | null>
   */
  async findById(id: string): Promise<HierarchyStructure | null> {
    this.validateUUID(id);
    
    return this.findOne<HierarchyStructure>(
      this.TABLE_NAME,
      [
        { field: 'id', operator: '=', value: id },
        { field: 'is_active', operator: '=', value: true }
      ]
    );
  }

  /**
   * Find a hierarchy node by its ltree path
   * @param path - Full ltree path (e.g., 'australia.sydney.cbd')
   * @returns Promise<HierarchyStructure | null>
   */
  async findByPath(path: string): Promise<HierarchyStructure | null> {
    if (!path || typeof path !== 'string') {
      throw new ValidationError('Path must be a non-empty string');
    }

    return this.findOne<HierarchyStructure>(
      this.TABLE_NAME,
      [
        { field: 'path', operator: '=', value: path },
        { field: 'is_active', operator: '=', value: true }
      ]
    );
  }

  /**
   * Find a hierarchy node by its code
   * @param code - Node code
   * @returns Promise<HierarchyStructure | null>
   */
  async findByCode(code: string): Promise<HierarchyStructure | null> {
    if (!code || typeof code !== 'string') {
      throw new ValidationError('Code must be a non-empty string');
    }

    return this.findOne<HierarchyStructure>(
      this.TABLE_NAME,
      [
        { field: 'code', operator: '=', value: code },
        { field: 'is_active', operator: '=', value: true }
      ]
    );
  }

  /**
   * Get all hierarchy nodes
   * @param options - Query options
   * @returns Promise<HierarchyStructure[]>
   */
  async findAll(options: {
    includeInactive?: boolean;
    orderBy?: OrderByClause[];
    limit?: number;
    offset?: number;
  } = {}): Promise<HierarchyStructure[]> {
    const { includeInactive = false, orderBy = [], limit, offset } = options;

    const where: WhereCondition[] = [];
    if (!includeInactive) {
      where.push({ field: 'is_active', operator: '=', value: true });
    }

    const defaultOrderBy: OrderByClause[] = orderBy.length > 0 
      ? orderBy 
      : [{ field: 'path', direction: 'ASC' }];

    return this.findMany<HierarchyStructure>(this.TABLE_NAME, {
      where,
      orderBy: defaultOrderBy,
      pagination: { limit, offset }
    });
  }

  /**
   * Get direct children of a hierarchy node
   * @param parentId - Parent node ID
   * @returns Promise<HierarchyStructure[]>
   */
  async findChildren(parentId: string | null): Promise<HierarchyStructure[]> {
    if (parentId) {
      this.validateUUID(parentId);
    }

    return this.findMany<HierarchyStructure>(this.TABLE_NAME, {
      where: [
        { field: 'parent_id', operator: parentId ? '=' : 'IS', value: parentId },
        { field: 'is_active', operator: '=', value: true }
      ],
      orderBy: [
        { field: 'sort_order', direction: 'ASC' },
        { field: 'name', direction: 'ASC' }
      ]
    });
  }

  /**
   * Get all descendants of a hierarchy node using ltree path matching
   * @param path - Parent path (e.g., 'australia.sydney')
   * @param includeParent - Whether to include the parent node itself
   * @returns Promise<HierarchyStructure[]>
   */
  async findDescendants(path: string, includeParent: boolean = false): Promise<HierarchyStructure[]> {
    if (!path || typeof path !== 'string') {
      throw new ValidationError('Path must be a non-empty string');
    }

    // Use ltree descendant operator <@ for efficient queries
    const where: WhereCondition[] = [
      { field: 'path', operator: '<@', value: path },
      { field: 'is_active', operator: '=', value: true }
    ];

    if (!includeParent) {
      where.push({ field: 'path', operator: '!=', value: path });
    }

    return this.findMany<HierarchyStructure>(this.TABLE_NAME, {
      where,
      orderBy: [{ field: 'path', direction: 'ASC' }]
    });
  }

  /**
   * Get all ancestors of a hierarchy node by parsing the path
   * @param path - Node path (e.g., 'australia.sydney.cbd')
   * @param includeNode - Whether to include the node itself
   * @returns Promise<HierarchyStructure[]>
   */
  async findAncestors(path: string, includeNode: boolean = false): Promise<HierarchyStructure[]> {
    if (!path || typeof path !== 'string') {
      throw new ValidationError('Path must be a non-empty string');
    }

    // Use ltree ancestor operator ~ for efficient queries
    const where: WhereCondition[] = [
      { field: 'path', operator: '~', value: `${path}.*` },
      { field: 'is_active', operator: '=', value: true }
    ];

    if (!includeNode) {
      where.push({ field: 'path', operator: '!=', value: path });
    }

    return this.findMany<HierarchyStructure>(this.TABLE_NAME, {
      where,
      orderBy: [{ field: 'level', direction: 'ASC' }]
    });
  }

  /**
   * Get siblings of a hierarchy node (nodes with same parent)
   * @param id - Node ID
   * @param includeSelf - Whether to include the node itself
   * @returns Promise<HierarchyStructure[]>
   */
  async findSiblings(id: string, includeSelf: boolean = false): Promise<HierarchyStructure[]> {
    this.validateUUID(id);

    const node = await this.findById(id);
    if (!node) {
      throw new NotFoundError('Hierarchy node', id);
    }

    const where: WhereCondition[] = [
      { field: 'parent_id', operator: node.parent_id ? '=' : 'IS', value: node.parent_id },
      { field: 'is_active', operator: '=', value: true }
    ];

    if (!includeSelf) {
      where.push({ field: 'id', operator: '!=', value: id });
    }

    return this.findMany<HierarchyStructure>(this.TABLE_NAME, {
      where,
      orderBy: [
        { field: 'sort_order', direction: 'ASC' },
        { field: 'name', direction: 'ASC' }
      ]
    });
  }

  /**
   * Get root nodes (nodes with no parent)
   * @returns Promise<HierarchyStructure[]>
   */
  async findRoots(): Promise<HierarchyStructure[]> {
    return this.findChildren(null);
  }

  /**
   * Get leaf nodes (nodes with no children)
   * @returns Promise<HierarchyStructure[]>
   */
  async findLeaves(): Promise<HierarchyStructure[]> {
    const query = `
      SELECT h.*
      FROM hierarchy_structures h
      WHERE h.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM hierarchy_structures child 
          WHERE child.parent_id = h.id AND child.is_active = true
        )
      ORDER BY h.path
    `;

    const result = await this.query(query);
    return result.rows;
  }

  /**
   * Get nodes at a specific level
   * @param level - Hierarchy level (0 = root, 1 = first level, etc.)
   * @param parentPath - Optional parent path to filter within
   * @returns Promise<HierarchyStructure[]>
   */
  async findAtLevel(level: number, parentPath?: string): Promise<HierarchyStructure[]> {
    if (level < 0) {
      throw new ValidationError('Level must be non-negative');
    }

    const where: WhereCondition[] = [
      { field: 'level', operator: '=', value: level },
      { field: 'is_active', operator: '=', value: true }
    ];

    if (parentPath) {
      where.push({ field: 'path', operator: '<@', value: parentPath });
    }

    return this.findMany<HierarchyStructure>(this.TABLE_NAME, {
      where,
      orderBy: [
        { field: 'sort_order', direction: 'ASC' },
        { field: 'name', direction: 'ASC' }
      ]
    });
  }

  /**
   * Update a hierarchy node
   * @param id - Node ID
   * @param data - Data to update
   * @returns Promise<HierarchyStructure | null>
   */
  async update(id: string, data: {
    name?: string;
    sort_order?: number;
    metadata?: Record<string, any>;
  }): Promise<HierarchyStructure | null> {
    this.validateUUID(id);

    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);

    if (Object.keys(updateData).length === 1) { // Only updated_at
      throw new ValidationError('No data provided for update');
    }

    return this.updateById<HierarchyStructure>(this.TABLE_NAME, id, updateData);
  }

  /**
   * Move a hierarchy node to a new parent
   * This is a complex operation that updates paths for the node and all descendants
   * @param nodeId - ID of node to move
   * @param newParentId - ID of new parent (null for root)
   * @returns Promise<HierarchyStructure>
   */
  async move(nodeId: string, newParentId: string | null): Promise<HierarchyStructure> {
    this.validateUUID(nodeId);
    if (newParentId) {
      this.validateUUID(newParentId);
    }

    return this.executeInTransaction(async (executor) => {
      // Get the node to move
      const node = await this.findById(nodeId);
      if (!node) {
        throw new NotFoundError('Hierarchy node', nodeId);
      }

      // Validate new parent exists and isn't a descendant
      let newParent: HierarchyStructure | null = null;
      if (newParentId) {
        newParent = await this.findById(newParentId);
        if (!newParent) {
          throw new NotFoundError('Parent hierarchy node', newParentId);
        }

        // Check for circular reference
        if (newParent.path.startsWith(node.path + '.') || newParent.path === node.path) {
          throw new ValidationError('Cannot move node to its own descendant');
        }
      }

      // Calculate new path and level
      const newPath = newParent ? `${newParent.path}.${node.code}` : node.code;
      const newLevel = newParent ? newParent.level + 1 : 0;

      // Update the node itself
      const updatedNode = await this.updateById<HierarchyStructure>(
        this.TABLE_NAME,
        nodeId,
        {
          parent_id: newParentId,
          path: newPath,
          level: newLevel,
          updated_at: new Date()
        }
      );

      // Update all descendants' paths
      const oldPath = node.path;
      if (oldPath !== newPath) {
        const updateDescendantsQuery = `
          UPDATE hierarchy_structures 
          SET 
            path = $1 || subpath(path, nlevel($2)),
            level = level + $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE path <@ $2 AND path != $2 AND is_active = true
        `;

        await executor.query(updateDescendantsQuery, [
          newPath,
          oldPath,
          newLevel - node.level
        ]);
      }

      return updatedNode!;
    }) as Promise<HierarchyStructure>;
  }

  /**
   * Soft delete a hierarchy node and all its descendants
   * @param id - Node ID
   * @returns Promise<number> - Number of deleted nodes
   */
  async delete(id: string): Promise<number> {
    this.validateUUID(id);

    const node = await this.findById(id);
    if (!node) {
      return 0;
    }

    // Soft delete the node and all descendants
    const query = `
      UPDATE hierarchy_structures 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE path <@ $1 AND is_active = true
    `;

    const result = await this.query(query, [node.path]);
    return result.rowCount || 0;
  }

  /**
   * Get hierarchy statistics
   * @returns Promise<object> - Statistics about the hierarchy
   */
  async getStatistics(): Promise<{
    totalNodes: number;
    rootNodes: number;
    leafNodes: number;
    maxDepth: number;
    avgDepth: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_nodes,
        COUNT(*) FILTER (WHERE parent_id IS NULL) as root_nodes,
        COUNT(*) FILTER (WHERE NOT EXISTS (
          SELECT 1 FROM hierarchy_structures child 
          WHERE child.parent_id = hierarchy_structures.id AND child.is_active = true
        )) as leaf_nodes,
        MAX(level) as max_depth,
        AVG(level) as avg_depth
      FROM hierarchy_structures 
      WHERE is_active = true
    `;

    const result = await this.query(query);
    const row = result.rows[0];

    return {
      totalNodes: parseInt(row.total_nodes),
      rootNodes: parseInt(row.root_nodes),
      leafNodes: parseInt(row.leaf_nodes),
      maxDepth: parseInt(row.max_depth || '0'),
      avgDepth: parseFloat(row.avg_depth || '0')
    };
  }

  /**
   * Validate hierarchy integrity
   * @returns Promise<Array> - Array of integrity issues found
   */
  async validateIntegrity(): Promise<Array<{
    issueType: string;
    nodeId: string;
    nodeName: string;
    description: string;
  }>> {
    const query = `
      WITH hierarchy_issues AS (
        -- Check for orphaned nodes
        SELECT 
          'orphaned_node' as issue_type,
          h.id as node_id,
          h.name as node_name,
          'Parent node does not exist' as description
        FROM hierarchy_structures h
        LEFT JOIN hierarchy_structures p ON h.parent_id = p.id
        WHERE h.parent_id IS NOT NULL AND p.id IS NULL AND h.is_active = true
        
        UNION ALL
        
        -- Check for level inconsistencies
        SELECT 
          'level_inconsistency' as issue_type,
          h.id as node_id,
          h.name as node_name,
          'Level does not match parent level + 1' as description
        FROM hierarchy_structures h
        JOIN hierarchy_structures p ON h.parent_id = p.id
        WHERE h.level != p.level + 1 AND h.is_active = true AND p.is_active = true
        
        UNION ALL
        
        -- Check for path inconsistencies
        SELECT 
          'path_inconsistency' as issue_type,
          h.id as node_id,
          h.name as node_name,
          'Path does not match parent path + code' as description
        FROM hierarchy_structures h
        JOIN hierarchy_structures p ON h.parent_id = p.id
        WHERE h.path != (p.path || '.' || h.code)::ltree 
          AND h.is_active = true AND p.is_active = true
      )
      SELECT * FROM hierarchy_issues
      ORDER BY issue_type, node_name
    `;

    const result = await this.query(query);
    return result.rows.map(row => ({
      issueType: row.issue_type,
      nodeId: row.node_id,
      nodeName: row.node_name,
      description: row.description
    }));
  }
}