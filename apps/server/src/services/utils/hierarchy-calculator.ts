/**
 * Hierarchy calculation utilities
 * Provides functions for path calculations, access scope determination, and tree formatting
 */

import { HierarchyStructure } from '@ppm/types';
import { ValidationError, BusinessRuleError } from '../../errors';

/**
 * Tree node structure for hierarchy representation
 */
export interface HierarchyTreeNode {
  id: string;
  name: string;
  code: string;
  path: string;
  level: number;
  parent_id: string | null;
  sort_order: number;
  metadata: Record<string, any>;
  children: HierarchyTreeNode[];
  userCount?: number;
  totalUserCount?: number;
  isExpanded?: boolean;
}

/**
 * Access scope calculation result
 */
export interface AccessScope {
  hierarchyId: string;
  hierarchyPath: string;
  hierarchyName: string;
  accessLevel: 'direct' | 'inherited';
  permissionSource: 'direct' | 'role';
  inheritToDescendants: boolean;
  descendantPaths: string[];
}

/**
 * Path ancestry information
 */
export interface PathAncestry {
  nodeId: string;
  path: string;
  ancestors: Array<{
    id: string;
    name: string;
    path: string;
    level: number;
  }>;
  descendants: Array<{
    id: string;
    name: string;
    path: string;
    level: number;
  }>;
}

/**
 * Hierarchy calculation utilities
 */
export class HierarchyCalculator {
  /**
   * Calculate ltree path for a new hierarchy node
   */
  static calculatePath(parentPath: string | null, nodeCode: string): string {
    if (!nodeCode) {
      throw new ValidationError('Node code is required for path calculation');
    }

    // Validate code format for ltree compatibility
    if (!/^[a-zA-Z0-9_]+$/.test(nodeCode)) {
      throw new ValidationError('Node code must contain only letters, numbers, and underscores');
    }

    if (parentPath) {
      return `${parentPath}.${nodeCode}`;
    } else {
      return nodeCode;
    }
  }

  /**
   * Calculate hierarchy level from path
   */
  static calculateLevel(path: string): number {
    if (!path) {
      throw new ValidationError('Path is required for level calculation');
    }

    return path.split('.').length - 1;
  }

  /**
   * Extract parent path from node path
   */
  static getParentPath(path: string): string | null {
    if (!path || !path.includes('.')) {
      return null; // Root node
    }

    const parts = path.split('.');
    parts.pop(); // Remove last segment
    return parts.join('.');
  }

  /**
   * Extract node code from path
   */
  static getNodeCode(path: string): string {
    if (!path) {
      throw new ValidationError('Path is required to extract node code');
    }

    const parts = path.split('.');
    return parts[parts.length - 1];
  }

  /**
   * Check if one path is an ancestor of another
   */
  static isAncestor(ancestorPath: string, descendantPath: string): boolean {
    if (!ancestorPath || !descendantPath) {
      return false;
    }

    if (ancestorPath === descendantPath) {
      return false; // Same node, not ancestor
    }

    return descendantPath.startsWith(ancestorPath + '.');
  }

  /**
   * Check if one path is a descendant of another
   */
  static isDescendant(descendantPath: string, ancestorPath: string): boolean {
    return this.isAncestor(ancestorPath, descendantPath);
  }

  /**
   * Get all ancestor paths for a given path
   */
  static getAncestorPaths(path: string): string[] {
    if (!path) {
      return [];
    }

    const parts = path.split('.');
    const ancestors: string[] = [];

    for (let i = 1; i < parts.length; i++) {
      ancestors.push(parts.slice(0, i).join('.'));
    }

    return ancestors;
  }

  /**
   * Build hierarchy tree from flat structure list
   */
  static buildHierarchyTree(structures: HierarchyStructure[]): HierarchyTreeNode[] {
    // Create node map for quick lookup
    const nodeMap = new Map<string, HierarchyTreeNode>();
    
    // Convert structures to tree nodes
    for (const structure of structures) {
      const node: HierarchyTreeNode = {
        id: structure.id,
        name: structure.name,
        code: structure.code,
        path: structure.path,
        level: structure.level,
        parent_id: structure.parent_id,
        sort_order: structure.sort_order,
        metadata: structure.metadata || {},
        children: []
      };
      nodeMap.set(structure.id, node);
    }

    // Build parent-child relationships
    const rootNodes: HierarchyTreeNode[] = [];
    
    for (const node of nodeMap.values()) {
      if (node.parent_id) {
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          // Orphaned node - add as root for now
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    }

    // Sort children by sort_order and name
    const sortChildren = (nodes: HierarchyTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.name.localeCompare(b.name);
      });

      nodes.forEach(node => sortChildren(node.children));
    };

    sortChildren(rootNodes);
    return rootNodes;
  }

  /**
   * Flatten hierarchy tree back to list
   */
  static flattenHierarchyTree(treeNodes: HierarchyTreeNode[]): HierarchyTreeNode[] {
    const flattened: HierarchyTreeNode[] = [];

    const flatten = (nodes: HierarchyTreeNode[]) => {
      for (const node of nodes) {
        flattened.push(node);
        flatten(node.children);
      }
    };

    flatten(treeNodes);
    return flattened;
  }

  /**
   * Calculate access scope for a user's permissions
   */
  static calculateAccessScope(
    userPermissions: Array<{
      hierarchy_id: string;
      hierarchy_path: string;
      hierarchy_name: string;
      inherit_to_descendants: boolean;
      source: 'direct' | 'role';
    }>,
    allHierarchies: HierarchyStructure[]
  ): AccessScope[] {
    const scopes: AccessScope[] = [];
    const hierarchyMap = new Map(allHierarchies.map(h => [h.id, h]));

    for (const permission of userPermissions) {
      const hierarchy = hierarchyMap.get(permission.hierarchy_id);
      if (!hierarchy) {
        continue;
      }

      // Calculate descendant paths if inheritance is enabled
      let descendantPaths: string[] = [];
      if (permission.inherit_to_descendants) {
        descendantPaths = allHierarchies
          .filter(h => this.isDescendant(h.path, hierarchy.path))
          .map(h => h.path);
      }

      const scope: AccessScope = {
        hierarchyId: permission.hierarchy_id,
        hierarchyPath: permission.hierarchy_path,
        hierarchyName: permission.hierarchy_name,
        accessLevel: 'direct',
        permissionSource: permission.source,
        inheritToDescendants: permission.inherit_to_descendants,
        descendantPaths
      };

      scopes.push(scope);
    }

    return scopes;
  }

  /**
   * Check if a target hierarchy is accessible based on access scopes
   */
  static isHierarchyAccessible(targetPath: string, accessScopes: AccessScope[]): boolean {
    return accessScopes.some(scope => {
      // Direct access to this hierarchy
      if (scope.hierarchyPath === targetPath) {
        return true;
      }

      // Inherited access (target is descendant of scope)
      if (scope.inheritToDescendants && this.isDescendant(targetPath, scope.hierarchyPath)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get all accessible hierarchy paths for given scopes
   */
  static getAccessiblePaths(accessScopes: AccessScope[]): string[] {
    const accessiblePaths = new Set<string>();

    for (const scope of accessScopes) {
      // Add direct access path
      accessiblePaths.add(scope.hierarchyPath);

      // Add descendant paths if inheritance is enabled
      if (scope.inheritToDescendants) {
        scope.descendantPaths.forEach(path => accessiblePaths.add(path));
      }
    }

    return Array.from(accessiblePaths);
  }

  /**
   * Calculate hierarchy statistics
   */
  static calculateHierarchyStats(structures: HierarchyStructure[]): {
    totalNodes: number;
    maxDepth: number;
    nodesByLevel: Record<number, number>;
    rootNodes: number;
    leafNodes: number;
  } {
    const stats = {
      totalNodes: structures.length,
      maxDepth: 0,
      nodesByLevel: {} as Record<number, number>,
      rootNodes: 0,
      leafNodes: 0
    };

    const childCounts = new Map<string, number>();

    for (const structure of structures) {
      // Update max depth
      stats.maxDepth = Math.max(stats.maxDepth, structure.level);

      // Count nodes by level
      stats.nodesByLevel[structure.level] = (stats.nodesByLevel[structure.level] || 0) + 1;

      // Count root nodes
      if (!structure.parent_id) {
        stats.rootNodes++;
      }

      // Count children for leaf calculation
      if (structure.parent_id) {
        childCounts.set(structure.parent_id, (childCounts.get(structure.parent_id) || 0) + 1);
      }
    }

    // Calculate leaf nodes (nodes with no children)
    for (const structure of structures) {
      if (!childCounts.has(structure.id)) {
        stats.leafNodes++;
      }
    }

    return stats;
  }

  /**
   * Validate hierarchy integrity
   */
  static validateHierarchyIntegrity(structures: HierarchyStructure[]): Array<{
    type: 'orphaned' | 'level_mismatch' | 'path_mismatch' | 'circular_reference';
    nodeId: string;
    nodeName: string;
    description: string;
  }> {
    const issues: Array<{
      type: 'orphaned' | 'level_mismatch' | 'path_mismatch' | 'circular_reference';
      nodeId: string;
      nodeName: string;
      description: string;
    }> = [];

    const nodeMap = new Map(structures.map(s => [s.id, s]));

    for (const structure of structures) {
      // Check for orphaned nodes
      if (structure.parent_id && !nodeMap.has(structure.parent_id)) {
        issues.push({
          type: 'orphaned',
          nodeId: structure.id,
          nodeName: structure.name,
          description: `Parent node ${structure.parent_id} does not exist`
        });
        continue;
      }

      // Check level consistency
      if (structure.parent_id) {
        const parent = nodeMap.get(structure.parent_id);
        if (parent && structure.level !== parent.level + 1) {
          issues.push({
            type: 'level_mismatch',
            nodeId: structure.id,
            nodeName: structure.name,
            description: `Level ${structure.level} should be ${parent.level + 1} (parent level + 1)`
          });
        }
      } else if (structure.level !== 0) {
        issues.push({
          type: 'level_mismatch',
          nodeId: structure.id,
          nodeName: structure.name,
          description: `Root node should have level 0, but has level ${structure.level}`
        });
      }

      // Check path consistency
      if (structure.parent_id) {
        const parent = nodeMap.get(structure.parent_id);
        if (parent) {
          const expectedPath = `${parent.path}.${structure.code}`;
          if (structure.path !== expectedPath) {
            issues.push({
              type: 'path_mismatch',
              nodeId: structure.id,
              nodeName: structure.name,
              description: `Path ${structure.path} should be ${expectedPath}`
            });
          }
        }
      } else if (structure.path !== structure.code) {
        issues.push({
          type: 'path_mismatch',
          nodeId: structure.id,
          nodeName: structure.name,
          description: `Root node path ${structure.path} should equal code ${structure.code}`
        });
      }

      // Check for circular references
      const ancestorPaths = this.getAncestorPaths(structure.path);
      if (ancestorPaths.includes(structure.path)) {
        issues.push({
          type: 'circular_reference',
          nodeId: structure.id,
          nodeName: structure.name,
          description: 'Circular reference detected in hierarchy path'
        });
      }
    }

    return issues;
  }

  /**
   * Find path between two hierarchy nodes
   */
  static findPathBetweenNodes(
    fromPath: string, 
    toPath: string, 
    structures: HierarchyStructure[]
  ): HierarchyStructure[] | null {
    const structureMap = new Map(structures.map(s => [s.path, s]));

    // Find common ancestor
    const fromParts = fromPath.split('.');
    const toParts = toPath.split('.');
    
    let commonAncestorPath = '';
    const minLength = Math.min(fromParts.length, toParts.length);
    
    for (let i = 0; i < minLength; i++) {
      if (fromParts[i] === toParts[i]) {
        if (commonAncestorPath) {
          commonAncestorPath += '.';
        }
        commonAncestorPath += fromParts[i];
      } else {
        break;
      }
    }

    if (!commonAncestorPath) {
      return null; // No common ancestor
    }

    // Build path from 'from' to common ancestor
    const pathUp: HierarchyStructure[] = [];
    let currentPath = fromPath;
    
    while (currentPath !== commonAncestorPath) {
      const structure = structureMap.get(currentPath);
      if (!structure) {
        return null;
      }
      pathUp.push(structure);
      currentPath = this.getParentPath(currentPath) || '';
    }

    // Add common ancestor
    const commonAncestor = structureMap.get(commonAncestorPath);
    if (!commonAncestor) {
      return null;
    }
    pathUp.push(commonAncestor);

    // Build path from common ancestor to 'to'
    const pathDown: HierarchyStructure[] = [];
    const toAncestors = this.getAncestorPaths(toPath);
    
    for (const ancestorPath of toAncestors) {
      if (this.isDescendant(ancestorPath, commonAncestorPath)) {
        const structure = structureMap.get(ancestorPath);
        if (structure) {
          pathDown.push(structure);
        }
      }
    }

    // Add target node
    const target = structureMap.get(toPath);
    if (target) {
      pathDown.push(target);
    }

    // Combine paths (reverse pathUp except common ancestor, then pathDown)
    const fullPath = [...pathUp.slice(0, -1).reverse(), ...pathDown];
    return fullPath;
  }
}

/**
 * Hierarchy path utilities for working with ltree paths
 */
export class PathUtils {
  /**
   * Join path segments safely
   */
  static joinPaths(...segments: string[]): string {
    return segments
      .filter(segment => segment && segment.length > 0)
      .join('.');
  }

  /**
   * Normalize path (remove empty segments, etc.)
   */
  static normalizePath(path: string): string {
    return path
      .split('.')
      .filter(segment => segment && segment.length > 0)
      .join('.');
  }

  /**
   * Get path depth
   */
  static getDepth(path: string): number {
    return HierarchyCalculator.calculateLevel(path);
  }

  /**
   * Check if path is valid ltree format
   */
  static isValidPath(path: string): boolean {
    if (!path || typeof path !== 'string') {
      return false;
    }

    // Check overall format
    if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(path)) {
      return false;
    }

    // Check segment length constraints
    const segments = path.split('.');
    for (const segment of segments) {
      if (segment.length === 0 || segment.length > 50) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate ltree query patterns
   */
  static generateQueryPatterns(path: string): {
    exact: string;
    descendants: string;
    ancestors: string;
    children: string;
  } {
    return {
      exact: path,
      descendants: `${path}.*`,
      ancestors: `*.${path}`,
      children: `${path}.*{1}`
    };
  }
}