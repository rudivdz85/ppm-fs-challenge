import type { BaseEntity } from '../types/temp-types';

/**
 * Hierarchy Structure Model
 * Represents a node in the organizational hierarchy using materialized path pattern
 */
export interface HierarchyStructure extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  
  // Materialized path for efficient hierarchical queries
  path: string; // ltree format: 'national.city1.suburb1'
  
  // Denormalized parent reference for easier joins
  parentId?: string;
  
  // Hierarchy metadata
  level: number; // 0 = root, 1 = first level, etc.
  sortOrder: number;
  isActive: boolean;
  
  // Additional metadata
  metadata: Record<string, any>;
  
  // Audit fields
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Input model for creating new hierarchy structure
 */
export interface CreateHierarchyStructureInput {
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  metadata?: Record<string, any>;
}

/**
 * Input model for updating hierarchy structure
 */
export interface UpdateHierarchyStructureInput {
  name?: string;
  code?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Hierarchy tree node with children for tree representation
 */
export interface HierarchyTreeNode extends HierarchyStructure {
  children: HierarchyTreeNode[];
  depth: number;
  hasChildren: boolean;
  userCount?: number; // Number of users at this node
  descendantUserCount?: number; // Number of users in entire subtree
}

/**
 * Query options for hierarchy operations
 */
export interface HierarchyQueryOptions {
  includeInactive?: boolean;
  maxDepth?: number;
  parentId?: string;
  searchTerm?: string;
  sortBy?: 'name' | 'code' | 'level' | 'sortOrder' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  offset?: number;
  limit?: number;
}

/**
 * Result of hierarchy query with pagination
 */
export interface HierarchyQueryResult {
  nodes: HierarchyStructure[];
  total: number;
  hasMore: boolean;
}

/**
 * Path information for a hierarchy node
 */
export interface HierarchyPath {
  nodeId: string;
  path: string;
  ancestors: HierarchyStructure[];
  descendants: HierarchyStructure[];
  level: number;
}

/**
 * Hierarchy validation result
 */
export interface HierarchyValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Move operation for hierarchy restructuring
 */
export interface HierarchyMoveOperation {
  nodeId: string;
  newParentId?: string;
  newSortOrder?: number;
}

/**
 * Bulk operation result
 */
export interface HierarchyBulkResult {
  successful: string[];
  failed: Array<{
    nodeId: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}