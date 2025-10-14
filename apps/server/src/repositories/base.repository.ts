import { PoolClient } from 'pg';
import { db } from '../database/connection';
import { QueryExecutor } from './utils/transaction';
import { 
  buildSelectQuery, 
  buildInsertQuery, 
  buildUpdateQuery,
  WhereCondition,
  OrderByClause,
  PaginationOptions
} from './utils/query-builder';
import { DatabaseError, NotFoundError, ValidationError } from '../models';

/**
 * Base Repository class providing common database operations
 * All specific repositories should extend this class
 */
export abstract class BaseRepository {
  protected executor: QueryExecutor;

  constructor(clientOrPool?: PoolClient) {
    this.executor = clientOrPool 
      ? QueryExecutor.forTransaction(clientOrPool)
      : QueryExecutor.forPool();
  }

  /**
   * Execute a raw SQL query with parameters
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Promise<QueryResult>
   */
  protected async query(query: string, params?: any[]) {
    try {
      return await this.executor.query(query, params);
    } catch (error: any) {
      throw this.handleDatabaseError(error);
    }
  }

  /**
   * Find a single record by conditions
   * @param table - Table name
   * @param where - Where conditions
   * @param select - Fields to select
   * @returns Promise<T | null>
   */
  protected async findOne<T>(
    table: string,
    where: WhereCondition[],
    select: string[] = ['*']
  ): Promise<T | null> {
    const { query, params } = buildSelectQuery({
      select,
      from: table,
      where,
      pagination: { limit: 1 }
    });

    const result = await this.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Find multiple records by conditions
   * @param table - Table name
   * @param options - Query options
   * @returns Promise<T[]>
   */
  protected async findMany<T>(
    table: string,
    options: {
      where?: WhereCondition[];
      orderBy?: OrderByClause[];
      pagination?: PaginationOptions;
      select?: string[];
      joins?: string[];
    } = {}
  ): Promise<T[]> {
    const { select = ['*'], where = [], orderBy = [], pagination = {}, joins = [] } = options;

    const { query, params } = buildSelectQuery({
      select,
      from: table,
      joins,
      where,
      orderBy,
      pagination
    });

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Count records matching conditions
   * @param table - Table name
   * @param where - Where conditions
   * @returns Promise<number>
   */
  protected async count(
    table: string,
    where: WhereCondition[] = []
  ): Promise<number> {
    const { query, params } = buildSelectQuery({
      select: ['COUNT(*) as count'],
      from: table,
      where
    });

    const result = await this.query(query, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Insert a new record
   * @param table - Table name
   * @param data - Data to insert
   * @param returning - Fields to return
   * @returns Promise<T>
   */
  protected async insertOne<T>(
    table: string,
    data: Record<string, any>,
    returning: string[] = ['*']
  ): Promise<T> {
    const { query, params } = buildInsertQuery(table, data, returning);
    const result = await this.query(query, params);
    return result.rows[0];
  }

  /**
   * Update records matching conditions
   * @param table - Table name
   * @param data - Data to update
   * @param where - Where conditions
   * @param returning - Fields to return
   * @returns Promise<T[]>
   */
  protected async updateMany<T>(
    table: string,
    data: Record<string, any>,
    where: WhereCondition[],
    returning: string[] = ['*']
  ): Promise<T[]> {
    const { query, params } = buildUpdateQuery(table, data, where, returning);
    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Update a single record by ID
   * @param table - Table name
   * @param id - Record ID
   * @param data - Data to update
   * @param returning - Fields to return
   * @returns Promise<T | null>
   */
  protected async updateById<T>(
    table: string,
    id: string,
    data: Record<string, any>,
    returning: string[] = ['*']
  ): Promise<T | null> {
    const where: WhereCondition[] = [{ field: 'id', operator: '=', value: id }];
    const results = await this.updateMany<T>(table, data, where, returning);
    return results[0] || null;
  }

  /**
   * Soft delete a record by setting is_active = false
   * @param table - Table name
   * @param id - Record ID
   * @returns Promise<boolean>
   */
  protected async softDelete(table: string, id: string): Promise<boolean> {
    const result = await this.updateById(
      table, 
      id, 
      { is_active: false, updated_at: new Date() }
    );
    return result !== null;
  }

  /**
   * Hard delete a record
   * @param table - Table name
   * @param where - Where conditions
   * @returns Promise<number> - Number of deleted records
   */
  protected async hardDelete(
    table: string,
    where: WhereCondition[]
  ): Promise<number> {
    if (where.length === 0) {
      throw new ValidationError('WHERE clause required for delete operations');
    }

    const { clause, params } = require('./utils/query-builder').buildWhereClause(where);
    const query = `DELETE FROM ${table} ${clause}`;
    
    const result = await this.query(query, params);
    return result.rowCount || 0;
  }

  /**
   * Check if a record exists
   * @param table - Table name
   * @param where - Where conditions
   * @returns Promise<boolean>
   */
  protected async exists(
    table: string,
    where: WhereCondition[]
  ): Promise<boolean> {
    const count = await this.count(table, where);
    return count > 0;
  }

  /**
   * Execute multiple queries in a transaction
   * @param queries - Array of query functions to execute
   * @returns Promise<T[]>
   */
  protected async executeInTransaction<T>(
    queries: ((executor: QueryExecutor) => Promise<T>)[]
  ): Promise<T[]> {
    // If we're already in a transaction, just execute queries
    if (this.executor instanceof QueryExecutor && 'client' in this.executor) {
      const results: T[] = [];
      for (const queryFn of queries) {
        results.push(await queryFn(this.executor));
      }
      return results;
    }

    // Otherwise, create a new transaction
    const { withTransaction } = await import('./utils/transaction');
    return withTransaction(async (client) => {
      const transactionExecutor = QueryExecutor.forTransaction(client);
      const results: T[] = [];
      for (const queryFn of queries) {
        results.push(await queryFn(transactionExecutor));
      }
      return results;
    });
  }

  /**
   * Transform database errors into application-specific errors
   * @param error - Database error
   * @returns DatabaseError
   */
  protected handleDatabaseError(error: any): DatabaseError {
    // PostgreSQL error codes
    const pgErrorCodes = {
      '23505': 'UNIQUE_VIOLATION',
      '23503': 'FOREIGN_KEY_VIOLATION',
      '23502': 'NOT_NULL_VIOLATION',
      '23514': 'CHECK_VIOLATION'
    };

    if (error.code && pgErrorCodes[error.code]) {
      switch (error.code) {
        case '23505':
          return new DatabaseError(
            'Record already exists',
            'DUPLICATE',
            error.constraint,
            error.detail
          );
        case '23503':
          return new DatabaseError(
            'Referenced record does not exist',
            'FOREIGN_KEY_VIOLATION',
            error.constraint,
            error.detail
          );
        case '23502':
          return new ValidationError(
            'Required field is missing',
            error.column
          );
        case '23514':
          return new ValidationError(
            'Invalid field value',
            error.constraint
          );
      }
    }

    // Log the original error for debugging
    console.error('Database error:', error);

    return new DatabaseError(
      error.message || 'Database operation failed',
      error.code,
      error.constraint,
      error.detail
    );
  }

  /**
   * Validate UUID format
   * @param id - UUID string to validate
   * @throws ValidationError if invalid
   */
  protected validateUUID(id: string): void {
    // More lenient UUID validation that accepts any valid UUID format including test UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new ValidationError(`Invalid UUID format: ${id}`);
    }
  }

  /**
   * Validate email format
   * @param email - Email string to validate
   * @throws ValidationError if invalid
   */
  protected validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError(`Invalid email format: ${email}`);
    }
  }

  /**
   * Validate required fields are present
   * @param data - Data object to validate
   * @param requiredFields - Array of required field names
   * @throws ValidationError if any required field is missing
   */
  protected validateRequiredFields(
    data: Record<string, any>,
    requiredFields: string[]
  ): void {
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw new ValidationError(`Required field '${field}' is missing or empty`);
      }
    }
  }
}