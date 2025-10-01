import { PoolClient } from 'pg';
import { db } from '../../database/connection';

/**
 * Transaction wrapper that provides automatic rollback on error
 * and proper resource cleanup
 */
export class Transaction {
  private client: PoolClient | null = null;
  private isCommitted = false;
  private isRolledBack = false;

  /**
   * Begin a new database transaction
   * @returns Promise<Transaction> - The transaction instance
   */
  static async begin(): Promise<Transaction> {
    const transaction = new Transaction();
    transaction.client = await db.connect();
    await transaction.client.query('BEGIN');
    return transaction;
  }

  /**
   * Get the underlying database client for queries
   * @returns PoolClient - The database client
   */
  getClient(): PoolClient {
    if (!this.client) {
      throw new Error('Transaction not initialized or already finished');
    }
    return this.client;
  }

  /**
   * Commit the transaction and release resources
   */
  async commit(): Promise<void> {
    if (!this.client) {
      throw new Error('Transaction not initialized');
    }
    if (this.isCommitted || this.isRolledBack) {
      throw new Error('Transaction already finished');
    }

    try {
      await this.client.query('COMMIT');
      this.isCommitted = true;
    } finally {
      this.client.release();
      this.client = null;
    }
  }

  /**
   * Rollback the transaction and release resources
   */
  async rollback(): Promise<void> {
    if (!this.client) {
      throw new Error('Transaction not initialized');
    }
    if (this.isCommitted || this.isRolledBack) {
      throw new Error('Transaction already finished');
    }

    try {
      await this.client.query('ROLLBACK');
      this.isRolledBack = true;
    } finally {
      this.client.release();
      this.client = null;
    }
  }

  /**
   * Execute a function within this transaction with automatic rollback on error
   * @param fn - Function to execute within the transaction
   * @returns Promise<T> - Result of the function
   */
  async execute<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      const result = await fn(this.getClient());
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

/**
 * Execute a function within a new transaction with automatic cleanup
 * @param fn - Function to execute within the transaction
 * @returns Promise<T> - Result of the function
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const transaction = await Transaction.begin();
  return transaction.execute(fn);
}

/**
 * Transaction-aware query executor
 * Executes queries within a transaction if provided, otherwise uses the pool
 */
export class QueryExecutor {
  constructor(private clientOrPool: PoolClient | typeof db) {}

  /**
   * Execute a query with parameters
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Promise<QueryResult>
   */
  async query(query: string, params?: any[]) {
    return this.clientOrPool.query(query, params);
  }

  /**
   * Create a new QueryExecutor for a transaction
   * @param client - Transaction client
   * @returns QueryExecutor
   */
  static forTransaction(client: PoolClient): QueryExecutor {
    return new QueryExecutor(client);
  }

  /**
   * Create a new QueryExecutor for the connection pool
   * @returns QueryExecutor
   */
  static forPool(): QueryExecutor {
    return new QueryExecutor(db);
  }
}