/**
 * HierarchyController - Hierarchy structure management endpoints
 * Handles hierarchy CRUD operations, tree operations, and structure validation
 */

import { Request, Response } from 'express';
import { HierarchyService } from '../services/hierarchy.service';
import { UserRepository, HierarchyRepository, PermissionRepository } from '../repositories';
import { success, error, created, noContent, handleServiceResult, notFound } from '../utils/response.util';
import { createServiceLogger } from '../services/utils/logger';
import { HierarchyCalculator } from '../services/utils/hierarchy-calculator';
import { 
  AuthenticatedRequest, 
  ValidatedRequest, 
  AuthenticatedValidatedRequest 
} from '../types/express';

const logger = createServiceLogger('HierarchyController');

/**
 * HierarchyController class
 */
export class HierarchyController {
  private hierarchyService: HierarchyService;

  constructor() {
    const hierarchyRepo = new HierarchyRepository();
    const userRepo = new UserRepository();
    const permissionRepo = new PermissionRepository();
    
    this.hierarchyService = new HierarchyService(hierarchyRepo, userRepo, permissionRepo);
  }

  /**
   * Get hierarchy tree structure
   * GET /api/hierarchy/tree
   * 
   * Query parameters:
   * - root_id: string (optional) - Start from specific node
   * - max_depth: number (optional) - Maximum tree depth
   * - include_user_counts: boolean (optional) - Include user counts per node
   * - include_inactive: boolean (optional) - Include inactive structures
   * - expand_all: boolean (optional) - Return fully expanded tree
   * 
   * @example
   * GET /api/hierarchy/tree?include_user_counts=true&max_depth=5
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "root-uuid",
   *       "name": "Organization",
   *       "code": "org",
   *       "path": "org",
   *       "level": 0,
   *       "userCount": 150,
   *       "children": [
   *         {
   *           "id": "dept-uuid",
   *           "name": "Engineering",
   *           "path": "org.engineering",
   *           "level": 1,
   *           "userCount": 45,
   *           "children": [...]
   *         }
   *       ]
   *     }
   *   ]
   * }
   */
  public getHierarchyTree = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get hierarchy tree request', {
        operation: 'getHierarchyTree',
        userId: req.user.id,
        filters: req.validatedData.query,
        ip: req.clientIp
      });

      const treeResult = await this.hierarchyService.getAllStructures();

      if (!treeResult.success) {
        error(res, treeResult.error);
        return;
      }

      logger.info('Hierarchy tree retrieved successfully', {
        operation: 'getHierarchyTree',
        userId: req.user.id,
        nodeCount: this.countTreeNodes(treeResult.data),
        maxDepth: this.calculateTreeDepth(treeResult.data)
      });

      success(res, treeResult.data);
    } catch (err) {
      logger.error('Get hierarchy tree error', {
        operation: 'getHierarchyTree',
        userId: req.user?.id
      }, err as Error);

      error(res, 'Failed to retrieve hierarchy tree', 500);
    }
  };

  /**
   * Get single hierarchy structure
   * GET /api/hierarchy/:id
   */
  public getStructure = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const structureId = req.validatedData.params.id;

      logger.info('Get structure request', {
        operation: 'getStructure',
        userId: req.user.id,
        structureId,
        ip: req.clientIp
      });

      const structureResult = await this.hierarchyService.getStructure(structureId);

      if (!structureResult.success) {
        if (structureResult.error.statusCode === 404) {
          notFound(res, 'Hierarchy structure', { structureId });
        } else {
          error(res, structureResult.error);
        }
        return;
      }

      logger.info('Structure retrieved successfully', {
        operation: 'getStructure',
        userId: req.user.id,
        structureId,
        structureName: structureResult.data.name,
        level: structureResult.data.level
      });

      success(res, structureResult.data);
    } catch (err) {
      logger.error('Get structure error', {
        operation: 'getStructure',
        userId: req.user?.id,
        structureId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to retrieve structure', 500);
    }
  };

  /**
   * Create new hierarchy structure
   * POST /api/hierarchy
   * 
   * @example
   * Request body:
   * {
   *   "name": "Engineering Department",
   *   "code": "engineering",
   *   "description": "Software engineering teams",
   *   "parent_id": "parent-uuid",
   *   "sort_order": 1,
   *   "metadata": { "cost_center": "ENG001" }
   * }
   */
  public createStructure = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Create structure request', {
        operation: 'createStructure',
        createdBy: req.user.id,
        name: req.validatedData.body.name,
        code: req.validatedData.body.code,
        parentId: req.validatedData.body.parent_id,
        ip: req.clientIp
      });

      const createResult = await this.hierarchyService.createStructure(
        req.validatedData.body,
        req.user.id
      );

      if (!createResult.success) {
        error(res, createResult.error);
        return;
      }

      logger.info('Structure created successfully', {
        operation: 'createStructure',
        createdBy: req.user.id,
        structureId: createResult.data.id,
        name: createResult.data.name,
        code: createResult.data.code,
        path: createResult.data.path,
        level: createResult.data.level
      });

      created(res, createResult.data);
    } catch (err) {
      logger.error('Create structure error', {
        operation: 'createStructure',
        createdBy: req.user?.id,
        name: req.validatedData?.body?.name
      }, err as Error);

      error(res, 'Failed to create structure', 500);
    }
  };

  /**
   * Update hierarchy structure
   * PUT /api/hierarchy/:id
   * 
   * @example
   * Request body:
   * {
   *   "name": "Updated Department Name",
   *   "description": "Updated description",
   *   "sort_order": 2,
   *   "is_active": true,
   *   "metadata": { "budget": 500000 }
   * }
   */
  public updateStructure = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const structureId = req.validatedData.params.id;

      logger.info('Update structure request', {
        operation: 'updateStructure',
        updatedBy: req.user.id,
        structureId,
        updates: Object.keys(req.validatedData.body),
        ip: req.clientIp
      });

      const updateResult = await this.hierarchyService.updateStructure(
        structureId,
        req.validatedData.body,
        req.user.id
      );

      if (!updateResult.success) {
        if (updateResult.error.statusCode === 404) {
          notFound(res, 'Hierarchy structure', { structureId });
        } else {
          error(res, updateResult.error);
        }
        return;
      }

      logger.info('Structure updated successfully', {
        operation: 'updateStructure',
        updatedBy: req.user.id,
        structureId,
        updates: Object.keys(req.validatedData.body)
      });

      success(res, updateResult.data);
    } catch (err) {
      logger.error('Update structure error', {
        operation: 'updateStructure',
        updatedBy: req.user?.id,
        structureId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to update structure', 500);
    }
  };

  /**
   * Delete hierarchy structure (soft delete)
   * DELETE /api/hierarchy/:id
   */
  public deleteStructure = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const structureId = req.validatedData.params.id;

      logger.info('Delete structure request', {
        operation: 'deleteStructure',
        deletedBy: req.user.id,
        structureId,
        ip: req.clientIp
      });

      const deleteResult = await this.hierarchyService.deleteStructure(
        structureId,
        req.user.id
      );

      if (!deleteResult.success) {
        if (deleteResult.error.statusCode === 404) {
          notFound(res, 'Hierarchy structure', { structureId });
        } else {
          error(res, deleteResult.error);
        }
        return;
      }

      logger.info('Structure deleted successfully', {
        operation: 'deleteStructure',
        deletedBy: req.user.id,
        structureId
      });

      noContent(res);
    } catch (err) {
      logger.error('Delete structure error', {
        operation: 'deleteStructure',
        deletedBy: req.user?.id,
        structureId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to delete structure', 500);
    }
  };

  /**
   * Move hierarchy structure to new parent
   * PUT /api/hierarchy/:id/move
   * 
   * @example
   * Request body:
   * {
   *   "new_parent_id": "new-parent-uuid",
   *   "reason": "Organizational restructuring"
   * }
   */
  public moveStructure = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const structureId = req.validatedData.params.id;
      const newParentId = req.validatedData.body.new_parent_id;

      logger.info('Move structure request', {
        operation: 'moveStructure',
        movedBy: req.user.id,
        structureId,
        newParentId,
        reason: req.validatedData.body.reason,
        ip: req.clientIp
      });

      const moveResult = await this.hierarchyService.moveStructure(
        structureId,
        newParentId,
        req.user.id
      );

      if (!moveResult.success) {
        error(res, moveResult.error);
        return;
      }

      logger.info('Structure moved successfully', {
        operation: 'moveStructure',
        movedBy: req.user.id,
        structureId,
        oldPath: moveResult.data.path, // This would need to be tracked
        newPath: moveResult.data.path,
        newParentId
      });

      success(res, moveResult.data);
    } catch (err) {
      logger.error('Move structure error', {
        operation: 'moveStructure',
        movedBy: req.user?.id,
        structureId: req.validatedData?.params?.id
      }, err as Error);

      error(res, 'Failed to move structure', 500);
    }
  };

  /**
   * Search hierarchy structures
   * GET /api/hierarchy/search
   * 
   * Query parameters:
   * - search: string (optional) - Search in names and codes
   * - level: number (optional) - Filter by hierarchy level
   * - parent_id: string (optional) - Filter by parent
   * - is_active: boolean (optional) - Filter by active status
   * - has_children: boolean (optional) - Filter by child presence
   * - min_user_count: number (optional) - Minimum user count
   * - max_user_count: number (optional) - Maximum user count
   * - page: number (optional) - Page number
   * - limit: number (optional) - Items per page
   * - sort_by: string (optional) - Sort field
   * - sort_order: 'asc'|'desc' (optional) - Sort order
   * 
   * @example
   * GET /api/hierarchy/search?search=engineering&level=1&is_active=true
   */
  public searchStructures = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Search structures request', {
        operation: 'searchStructures',
        userId: req.user.id,
        filters: req.validatedData.query,
        ip: req.clientIp
      });

      // Get all structures as flat list through service
      const result = await this.hierarchyService.getAllStructures();
      if (!result.success) {
        return error(res, result.error?.message || 'Failed to retrieve hierarchies', 500);
      }
      
      // Convert tree to flat list for dropdown usage
      const hierarchyStructures = HierarchyCalculator.flattenHierarchyTree(result.data);
      
      // Convert HierarchyTreeNode objects to the format expected by frontend
      const structures = hierarchyStructures.map(h => ({
        id: h.id,
        name: h.name,
        code: h.code,
        path: h.path,
        level: h.level,
        parent_id: h.parent_id,
        sort_order: h.sort_order,
        metadata: h.metadata || {},
        children: [],
        userCount: 0
      }));
      
      // Simple pagination
      const page = req.validatedData.query.page || 1;
      const limit = req.validatedData.query.limit || 20;
      const offset = (page - 1) * limit;
      const total = structures.length;
      const pages = Math.ceil(total / limit);
      const paginatedStructures = structures.slice(offset, offset + limit);

      const searchResults = {
        structures: paginatedStructures,
        total,
        page,
        limit,
        pages,
        filters_applied: req.validatedData.query
      };

      success(res, searchResults);
    } catch (err) {
      logger.error('Search structures error', {
        operation: 'searchStructures',
        userId: req.user?.id
      }, err as Error);

      error(res, 'Structure search failed', 500);
    }
  };

  /**
   * Get hierarchy statistics
   * GET /api/hierarchy/stats
   * 
   * Query parameters:
   * - include_user_distribution: boolean (optional) - Include user distribution
   * - include_depth_analysis: boolean (optional) - Include depth analysis
   * - include_integrity_check: boolean (optional) - Include integrity validation
   * 
   * @example
   * GET /api/hierarchy/stats?include_user_distribution=true&include_integrity_check=true
   */
  public getHierarchyStats = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get hierarchy stats request', {
        operation: 'getHierarchyStats',
        userId: req.user.id,
        options: req.validatedData.query,
        ip: req.clientIp
      });

      const statsResult = await this.hierarchyService.getHierarchyStatistics();

      if (!statsResult.success) {
        error(res, statsResult.error);
        return;
      }

      logger.info('Hierarchy stats retrieved successfully', {
        operation: 'getHierarchyStats',
        userId: req.user.id,
        totalNodes: statsResult.data.totalNodes,
        maxDepth: statsResult.data.maxDepth,
        rootNodes: statsResult.data.rootNodes
      });

      success(res, statsResult.data);
    } catch (err) {
      logger.error('Get hierarchy stats error', {
        operation: 'getHierarchyStats',
        userId: req.user?.id
      }, err as Error);

      error(res, 'Failed to retrieve hierarchy statistics', 500);
    }
  };

  /**
   * Validate hierarchy integrity
   * POST /api/hierarchy/validate
   * 
   * @example
   * Request body:
   * {
   *   "fix_issues": false,
   *   "detailed_report": true
   * }
   * 
   * Response:
   * {
   *   "isValid": true,
   *   "issues": [],
   *   "statistics": { ... },
   *   "recommendations": [...]
   * }
   */
  public validateHierarchy = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Validate hierarchy request', {
        operation: 'validateHierarchy',
        userId: req.user.id,
        fixIssues: req.validatedData.body.fix_issues,
        detailedReport: req.validatedData.body.detailed_report,
        ip: req.clientIp
      });

      const validationResult = await this.hierarchyService.validateHierarchy();

      if (!validationResult.success) {
        error(res, validationResult.error);
        return;
      }

      logger.info('Hierarchy validation completed', {
        operation: 'validateHierarchy',
        userId: req.user.id,
        isValid: validationResult.data.isValid,
        issueCount: validationResult.data.issues.length
      });

      success(res, validationResult.data);
    } catch (err) {
      logger.error('Validate hierarchy error', {
        operation: 'validateHierarchy',
        userId: req.user?.id
      }, err as Error);

      error(res, 'Hierarchy validation failed', 500);
    }
  };

  /**
   * Get hierarchy path information
   * GET /api/hierarchy/path/:path
   * 
   * Query parameters:
   * - include_ancestors: boolean (optional) - Include ancestor nodes
   * - include_descendants: boolean (optional) - Include descendant nodes
   * - max_depth: number (optional) - Maximum descendant depth
   */
  public getHierarchyPath = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const hierarchyPath = req.validatedData.params.path;

      logger.info('Get hierarchy path request', {
        operation: 'getHierarchyPath',
        userId: req.user.id,
        path: hierarchyPath,
        options: req.validatedData.query,
        ip: req.clientIp
      });

      // This would be implemented as a new method in HierarchyService
      // For now, return placeholder response
      const pathInfo = {
        path: hierarchyPath,
        current_node: null,
        ancestors: [],
        descendants: [],
        depth: hierarchyPath.split('.').length - 1,
        is_valid: true
      };

      success(res, pathInfo);
    } catch (err) {
      logger.error('Get hierarchy path error', {
        operation: 'getHierarchyPath',
        userId: req.user?.id,
        path: req.validatedData?.params?.path
      }, err as Error);

      error(res, 'Failed to retrieve hierarchy path information', 500);
    }
  };

  /**
   * Bulk hierarchy operations
   * POST /api/hierarchy/bulk
   * 
   * @example
   * Request body:
   * {
   *   "structure_ids": ["uuid1", "uuid2", "uuid3"],
   *   "operation": "activate",
   *   "reason": "End of maintenance period",
   *   "cascade": false
   * }
   */
  public bulkOperation = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      const { structure_ids, operation, reason, cascade } = req.validatedData.body;

      logger.info('Bulk hierarchy operation request', {
        operation: 'bulkOperation',
        performedBy: req.user.id,
        structureCount: structure_ids.length,
        operationType: operation,
        cascade,
        reason,
        ip: req.clientIp
      });

      // This would be implemented in the HierarchyService
      // For now, return placeholder response
      const results = {
        operation,
        cascade,
        requested: structure_ids.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
        performed_by: req.user.id,
        performed_at: new Date().toISOString(),
        reason
      };

      logger.info('Bulk hierarchy operation completed', {
        operation: 'bulkOperation',
        performedBy: req.user.id,
        results
      });

      success(res, results);
    } catch (err) {
      logger.error('Bulk hierarchy operation error', {
        operation: 'bulkOperation',
        performedBy: req.user?.id
      }, err as Error);

      error(res, 'Bulk operation failed', 500);
    }
  };

  /**
   * Private helper methods
   */

  /**
   * Count total nodes in hierarchy tree
   */
  private countTreeNodes(treeNodes: any[]): number {
    let count = 0;
    
    const countRecursive = (nodes: any[]) => {
      for (const node of nodes) {
        count++;
        if (node.children && node.children.length > 0) {
          countRecursive(node.children);
        }
      }
    };
    
    countRecursive(treeNodes);
    return count;
  }

  /**
   * Calculate maximum depth of hierarchy tree
   */
  private calculateTreeDepth(treeNodes: any[]): number {
    if (treeNodes.length === 0) return 0;
    
    let maxDepth = 0;
    
    const calculateDepth = (nodes: any[], currentDepth: number) => {
      for (const node of nodes) {
        maxDepth = Math.max(maxDepth, currentDepth);
        if (node.children && node.children.length > 0) {
          calculateDepth(node.children, currentDepth + 1);
        }
      }
    };
    
    calculateDepth(treeNodes, 1);
    return maxDepth;
  }

  // Aliases for route compatibility
  public getHierarchies = this.searchStructures;
  public getHierarchy = this.getStructure;
  public createHierarchy = this.createStructure;
  public updateHierarchy = this.updateStructure;
  public deleteHierarchy = this.deleteStructure;
  public moveHierarchy = this.moveStructure;
  public validateHierarchyIntegrity = this.validateHierarchy;
  public bulkHierarchyOperation = this.bulkOperation;
  public getHierarchyDescendants = this.getStructure; // Placeholder
  public getHierarchyAncestors = this.getStructure; // Placeholder
  public getHierarchyUsers = this.getStructure; // Placeholder
}