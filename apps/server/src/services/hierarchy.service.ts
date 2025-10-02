/**
 * HierarchyService - Business logic for hierarchy structure management
 * Handles creation, validation, and manipulation of organizational hierarchies
 */

import { HierarchyRepository, UserRepository, PermissionRepository } from '../repositories';
import { HierarchyStructure, CreateHierarchyData, UpdateHierarchyData } from '@ppm/types';
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
import { 
  HierarchyCalculator, 
  HierarchyTreeNode, 
  PathUtils 
} from './utils/hierarchy-calculator';
import { createServiceLogger } from './utils/logger';

/**
 * Structure creation request
 */
export interface CreateStructureRequest {
  name: string;
  code: string;
  parent_id?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
}

/**
 * Structure update request
 */
export interface UpdateStructureRequest {
  name?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
}

/**
 * Hierarchy validation result
 */
export interface HierarchyValidationResult {
  isValid: boolean;
  issues: Array<{
    type: string;
    nodeId: string;
    nodeName: string;
    description: string;
    severity: 'error' | 'warning';
  }>;
}

/**
 * HierarchyService class
 */
export class HierarchyService {
  private logger = createServiceLogger('HierarchyService');

  constructor(
    private hierarchyRepo: HierarchyRepository,
    private userRepo: UserRepository,
    private permissionRepo: PermissionRepository
  ) {}

  /**
   * Create new hierarchy structure with validation
   */
  async createStructure(
    request: CreateStructureRequest,
    createdBy: string
  ): Promise<ServiceResult<HierarchyStructure>> {
    return handleAsync(async () => {
      this.logger.info('Creating hierarchy structure', {
        operation: 'createStructure',
        userId: createdBy,
        structureName: request.name
      });

      // Validate input
      await this.validateCreateRequest(request);

      // Sanitize input
      const sanitizedRequest = await this.sanitizeCreateRequest(request);

      // Calculate path and level
      const { path, level } = await this.calculatePathAndLevel(sanitizedRequest.parent_id, sanitizedRequest.code);

      // Validate business rules
      await this.validateCreateBusinessRules(sanitizedRequest, path, level);

      // Create the structure
      const createData: CreateHierarchyData = {
        name: sanitizedRequest.name,
        code: sanitizedRequest.code,
        parent_id: sanitizedRequest.parent_id || null,
        sort_order: sanitizedRequest.sort_order || 0,
        metadata: sanitizedRequest.metadata || {}
      };

      const structure = await this.hierarchyRepo.create(createData);

      this.logger.audit('Hierarchy structure created', {
        operation: 'createStructure',
        userId: createdBy,
        entityType: 'hierarchy_structure',
        entityId: structure.id,
        metadata: {
          name: structure.name,
          path: structure.path,
          level: structure.level
        }
      });

      return structure;
    });
  }

  /**
   * Get single structure with full details
   */
  async getStructure(id: string): Promise<ServiceResult<HierarchyStructure>> {
    return handleAsync(async () => {
      Validator.validateUUID(id);

      const structure = await this.hierarchyRepo.findById(id);
      if (!structure) {
        throw new NotFoundError('Hierarchy structure', id);
      }

      return structure;
    });
  }

  /**
   * Get complete hierarchy tree formatted as tree structure
   */
  async getAllStructures(): Promise<ServiceResult<HierarchyTreeNode[]>> {
    return handleAsync(async () => {
      this.logger.debug('Fetching all hierarchy structures');

      const structures = await this.hierarchyRepo.findAll({ includeInactive: false });
      const tree = HierarchyCalculator.buildHierarchyTree(structures);

      this.logger.debug('Built hierarchy tree', {
        operation: 'getAllStructures',
        totalNodes: structures.length,
        rootNodes: tree.length
      });

      return tree;
    });
  }

  /**
   * Get immediate children of a structure
   */
  async getChildren(parentId: string | null): Promise<ServiceResult<HierarchyStructure[]>> {
    return handleAsync(async () => {
      if (parentId) {
        Validator.validateUUID(parentId);
        
        // Verify parent exists
        const parent = await this.hierarchyRepo.findById(parentId);
        if (!parent) {
          throw new NotFoundError('Parent hierarchy structure', parentId);
        }
      }

      const children = await this.hierarchyRepo.findChildren(parentId);
      return children;
    });
  }

  /**
   * Get all descendants with their relationships
   */
  async getDescendants(structureId: string): Promise<ServiceResult<{
    structure: HierarchyStructure;
    descendants: HierarchyStructure[];
    tree: HierarchyTreeNode[];
  }>> {
    return handleAsync(async () => {
      Validator.validateUUID(structureId);

      const structure = await this.hierarchyRepo.findById(structureId);
      if (!structure) {
        throw new NotFoundError('Hierarchy structure', structureId);
      }

      const descendants = await this.hierarchyRepo.findDescendants(structure.path, false);
      
      // Build tree including the root structure
      const allStructures = [structure, ...descendants];
      const tree = HierarchyCalculator.buildHierarchyTree(allStructures);

      return {
        structure,
        descendants,
        tree
      };
    });
  }

  /**
   * Get path from root to this structure (ancestors)
   */
  async getAncestors(structureId: string): Promise<ServiceResult<{
    structure: HierarchyStructure;
    ancestors: HierarchyStructure[];
    breadcrumb: HierarchyStructure[];
  }>> {
    return handleAsync(async () => {
      Validator.validateUUID(structureId);

      const structure = await this.hierarchyRepo.findById(structureId);
      if (!structure) {
        throw new NotFoundError('Hierarchy structure', structureId);
      }

      const ancestors = await this.hierarchyRepo.findAncestors(structure.path, false);
      
      // Create breadcrumb path (root to current)
      const breadcrumb = [...ancestors, structure].sort((a, b) => a.level - b.level);

      return {
        structure,
        ancestors,
        breadcrumb
      };
    });
  }

  /**
   * Update structure with path recalculation for children
   */
  async updateStructure(
    id: string,
    request: UpdateStructureRequest,
    updatedBy: string
  ): Promise<ServiceResult<HierarchyStructure>> {
    return handleAsync(async () => {
      this.logger.info('Updating hierarchy structure', {
        operation: 'updateStructure',
        userId: updatedBy,
        entityId: id
      });

      Validator.validateUUID(id);

      // Verify structure exists
      const existingStructure = await this.hierarchyRepo.findById(id);
      if (!existingStructure) {
        throw new NotFoundError('Hierarchy structure', id);
      }

      // Validate update request
      await this.validateUpdateRequest(request);

      // Sanitize input
      const sanitizedRequest = this.sanitizeUpdateRequest(request);

      // Validate business rules for update
      await this.validateUpdateBusinessRules(id, sanitizedRequest);

      // Perform update
      const updateData: UpdateHierarchyData = {};
      if (sanitizedRequest.name !== undefined) updateData.name = sanitizedRequest.name;
      if (sanitizedRequest.sort_order !== undefined) updateData.sort_order = sanitizedRequest.sort_order;
      if (sanitizedRequest.metadata !== undefined) updateData.metadata = sanitizedRequest.metadata;

      const updatedStructure = await this.hierarchyRepo.update(id, updateData);
      if (!updatedStructure) {
        throw new NotFoundError('Hierarchy structure', id);
      }

      this.logger.audit('Hierarchy structure updated', {
        operation: 'updateStructure',
        userId: updatedBy,
        entityType: 'hierarchy_structure',
        entityId: id,
        metadata: {
          changes: sanitizedRequest
        }
      });

      return updatedStructure;
    });
  }

  /**
   * Move structure to new parent with validation
   */
  async moveStructure(
    id: string,
    newParentId: string | null,
    movedBy: string
  ): Promise<ServiceResult<HierarchyStructure>> {
    return handleAsync(async () => {
      this.logger.info('Moving hierarchy structure', {
        operation: 'moveStructure',
        userId: movedBy,
        entityId: id,
        newParentId
      });

      Validator.validateUUID(id);
      if (newParentId) {
        Validator.validateUUID(newParentId);
      }

      // Get structure to move
      const structure = await this.hierarchyRepo.findById(id);
      if (!structure) {
        throw new NotFoundError('Hierarchy structure', id);
      }

      // Validate move operation
      await this.validateMoveOperation(id, newParentId);

      // Perform move
      const movedStructure = await this.hierarchyRepo.move(id, newParentId);

      this.logger.audit('Hierarchy structure moved', {
        operation: 'moveStructure',
        userId: movedBy,
        entityType: 'hierarchy_structure',
        entityId: id,
        metadata: {
          fromParent: structure.parent_id,
          toParent: newParentId,
          oldPath: structure.path,
          newPath: movedStructure.path
        }
      });

      return movedStructure;
    });
  }

  /**
   * Delete structure with validation (check for users/permissions first)
   */
  async deleteStructure(
    id: string,
    deletedBy: string,
    force: boolean = false
  ): Promise<ServiceResult<{ deletedCount: number; affectedUsers: number }>> {
    return handleAsync(async () => {
      this.logger.info('Deleting hierarchy structure', {
        operation: 'deleteStructure',
        userId: deletedBy,
        entityId: id,
        force
      });

      Validator.validateUUID(id);

      const structure = await this.hierarchyRepo.findById(id);
      if (!structure) {
        throw new NotFoundError('Hierarchy structure', id);
      }

      // Check for dependent data
      const validationResult = await this.validateDeletion(id, force);
      if (!validationResult.canDelete) {
        throw new BusinessRuleError(validationResult.reason!, 'deletion_validation', {
          dependentUsers: validationResult.dependentUsers,
          dependentChildren: validationResult.dependentChildren
        });
      }

      // If not forced, ensure no users or children
      if (!force) {
        // Move or delete dependent users if any strategy is implemented
        // For now, we require force=true if there are dependencies
      }

      // Perform deletion
      const deletedCount = await this.hierarchyRepo.delete(id);

      this.logger.audit('Hierarchy structure deleted', {
        operation: 'deleteStructure',
        userId: deletedBy,
        entityType: 'hierarchy_structure',
        entityId: id,
        metadata: {
          structureName: structure.name,
          structurePath: structure.path,
          deletedCount,
          force
        }
      });

      return {
        deletedCount,
        affectedUsers: validationResult.dependentUsers
      };
    });
  }

  /**
   * Validate integrity of entire hierarchy
   */
  async validateHierarchy(): Promise<ServiceResult<HierarchyValidationResult>> {
    return handleAsync(async () => {
      this.logger.info('Validating hierarchy integrity', {
        operation: 'validateHierarchy'
      });

      const structures = await this.hierarchyRepo.findAll({ includeInactive: true });
      const issues = HierarchyCalculator.validateHierarchyIntegrity(structures);

      // Map issues to include severity
      const mappedIssues = issues.map(issue => ({
        ...issue,
        severity: (issue.type === 'circular_reference' ? 'error' : 'warning') as 'error' | 'warning'
      }));

      const result: HierarchyValidationResult = {
        isValid: mappedIssues.filter(issue => issue.severity === 'error').length === 0,
        issues: mappedIssues
      };

      this.logger.info('Hierarchy validation completed', {
        operation: 'validateHierarchy',
        isValid: result.isValid,
        totalIssues: result.issues.length,
        errors: result.issues.filter(i => i.severity === 'error').length,
        warnings: result.issues.filter(i => i.severity === 'warning').length
      });

      return result;
    });
  }

  /**
   * Get hierarchy statistics
   */
  async getHierarchyStatistics(): Promise<ServiceResult<{
    totalNodes: number;
    maxDepth: number;
    nodesByLevel: Record<number, number>;
    rootNodes: number;
    leafNodes: number;
    totalUsers: number;
    usersByLevel: Record<number, number>;
  }>> {
    return handleAsync(async () => {
      const [structures, repoStats, userStats] = await Promise.all([
        this.hierarchyRepo.findAll({ includeInactive: false }),
        this.hierarchyRepo.getStatistics(),
        this.userRepo.getUserStatistics()
      ]);

      const calculatedStats = HierarchyCalculator.calculateHierarchyStats(structures);

      return {
        ...calculatedStats,
        ...repoStats,
        totalUsers: userStats.totalUsers,
        usersByLevel: userStats.usersByLevel.reduce((acc, item) => {
          acc[item.level] = item.count;
          return acc;
        }, {} as Record<number, number>)
      };
    });
  }

  // Private validation methods

  private async validateCreateRequest(request: CreateStructureRequest): Promise<void> {
    Validator.validateRequired(request, ['name', 'code']);
    Validator.validateHierarchyName(request.name);
    Validator.validateHierarchyCode(request.code);

    if (request.parent_id) {
      Validator.validateUUID(request.parent_id);
    }

    if (request.sort_order !== undefined) {
      BusinessRuleValidator.validateSortOrder(request.sort_order);
    }

    if (request.metadata !== undefined) {
      BusinessRuleValidator.validateMetadata(request.metadata);
    }
  }

  private async validateUpdateRequest(request: UpdateStructureRequest): Promise<void> {
    if (request.name !== undefined) {
      Validator.validateHierarchyName(request.name);
    }

    if (request.sort_order !== undefined) {
      BusinessRuleValidator.validateSortOrder(request.sort_order);
    }

    if (request.metadata !== undefined) {
      BusinessRuleValidator.validateMetadata(request.metadata);
    }
  }

  private async sanitizeCreateRequest(request: CreateStructureRequest): Promise<CreateStructureRequest> {
    return {
      ...request,
      name: Sanitizer.sanitizeString(request.name),
      code: Sanitizer.sanitizeHierarchyCode(request.code)
    };
  }

  private sanitizeUpdateRequest(request: UpdateStructureRequest): UpdateStructureRequest {
    const sanitized: UpdateStructureRequest = {};

    if (request.name !== undefined) {
      sanitized.name = Sanitizer.sanitizeString(request.name);
    }

    if (request.sort_order !== undefined) {
      sanitized.sort_order = request.sort_order;
    }

    if (request.metadata !== undefined) {
      sanitized.metadata = request.metadata;
    }

    return sanitized;
  }

  private async calculatePathAndLevel(parentId: string | undefined, code: string): Promise<{
    path: string;
    level: number;
  }> {
    if (!parentId) {
      return {
        path: code,
        level: 0
      };
    }

    const parent = await this.hierarchyRepo.findById(parentId);
    if (!parent) {
      throw new NotFoundError('Parent hierarchy structure', parentId);
    }

    const path = HierarchyCalculator.calculatePath(parent.path, code);
    const level = parent.level + 1;

    return { path, level };
  }

  private async validateCreateBusinessRules(
    request: CreateStructureRequest,
    path: string,
    level: number
  ): Promise<void> {
    // Validate path format
    if (!PathUtils.isValidPath(path)) {
      throw new ValidationError('Generated path is not valid ltree format');
    }

    // Check for duplicate codes at same level
    if (request.parent_id) {
      const siblings = await this.hierarchyRepo.findChildren(request.parent_id);
      const duplicateCode = siblings.find(sibling => sibling.code === request.code);
      if (duplicateCode) {
        throw new ConflictError(
          `Code '${request.code}' already exists at this hierarchy level`,
          'code',
          request.code
        );
      }
    } else {
      // Check root level codes
      const roots = await this.hierarchyRepo.findChildren(null);
      const duplicateCode = roots.find(root => root.code === request.code);
      if (duplicateCode) {
        throw new ConflictError(
          `Root code '${request.code}' already exists`,
          'code',
          request.code
        );
      }
    }

    // Validate hierarchy depth constraints
    BusinessRuleValidator.validateHierarchyLevel(level, 10); // Max 10 levels
  }

  private async validateUpdateBusinessRules(
    id: string,
    request: UpdateStructureRequest
  ): Promise<void> {
    // Add business rule validations for updates
    // For example, check if name changes conflict with siblings
    if (request.name) {
      const structure = await this.hierarchyRepo.findById(id);
      if (structure) {
        const siblings = await this.hierarchyRepo.findSiblings(id, false);
        const duplicateName = siblings.find(sibling => 
          sibling.name.toLowerCase() === request.name!.toLowerCase()
        );
        if (duplicateName) {
          throw new ConflictError(
            `Name '${request.name}' already exists at this hierarchy level`,
            'name',
            request.name
          );
        }
      }
    }
  }

  private async validateMoveOperation(id: string, newParentId: string | null): Promise<void> {
    const structure = await this.hierarchyRepo.findById(id);
    if (!structure) {
      throw new NotFoundError('Hierarchy structure', id);
    }

    if (newParentId) {
      const newParent = await this.hierarchyRepo.findById(newParentId);
      if (!newParent) {
        throw new NotFoundError('New parent hierarchy structure', newParentId);
      }

      // Prevent moving to descendant (circular reference)
      if (HierarchyCalculator.isDescendant(newParent.path, structure.path)) {
        throw new BusinessRuleError(
          'Cannot move structure to its own descendant',
          'circular_reference'
        );
      }

      // Check for code conflicts at new location
      const newSiblings = await this.hierarchyRepo.findChildren(newParentId);
      const codeConflict = newSiblings.find(sibling => sibling.code === structure.code);
      if (codeConflict) {
        throw new ConflictError(
          `Code '${structure.code}' already exists at target location`,
          'code',
          structure.code
        );
      }
    }
  }

  private async validateDeletion(id: string, force: boolean): Promise<{
    canDelete: boolean;
    reason?: string;
    dependentUsers: number;
    dependentChildren: number;
  }> {
    const structure = await this.hierarchyRepo.findById(id);
    if (!structure) {
      return { canDelete: false, reason: 'Structure not found', dependentUsers: 0, dependentChildren: 0 };
    }

    // Check for users in this structure and descendants
    const users = await this.userRepo.findByStructurePath(structure.path);
    const dependentUsers = users.length;

    // Check for child structures
    const children = await this.hierarchyRepo.findChildren(id);
    const dependentChildren = children.length;

    if (!force && (dependentUsers > 0 || dependentChildren > 0)) {
      const reasons: string[] = [];
      if (dependentUsers > 0) {
        reasons.push(`${dependentUsers} users`);
      }
      if (dependentChildren > 0) {
        reasons.push(`${dependentChildren} child structures`);
      }

      return {
        canDelete: false,
        reason: `Cannot delete structure with ${reasons.join(' and ')}. Use force=true to delete anyway.`,
        dependentUsers,
        dependentChildren
      };
    }

    return {
      canDelete: true,
      dependentUsers,
      dependentChildren
    };
  }
}