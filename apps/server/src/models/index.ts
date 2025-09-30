// Export all model interfaces for easy importing
export * from './HierarchyStructure';
export * from './User';
export * from './Permission';

// Common database types
export interface DatabaseTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: any[];
}

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface SearchParams {
  searchTerm?: string;
  filters?: Record<string, any>;
}

export interface QueryParams extends PaginationParams, SortParams, SearchParams {}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

// Database error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public constraint?: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ''} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class DuplicateError extends DatabaseError {
  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`, 'DUPLICATE');
    this.name = 'DuplicateError';
  }
}

export class ForeignKeyError extends DatabaseError {
  constructor(message: string, constraint: string) {
    super(message, 'FOREIGN_KEY_VIOLATION', constraint);
    this.name = 'ForeignKeyError';
  }
}