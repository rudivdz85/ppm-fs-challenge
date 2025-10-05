/**
 * SQL Query Builder Utilities
 * Provides helper functions for building dynamic SQL queries safely
 */

export interface WhereCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'NOT IN' | 'IS' | 'IS NOT' | '<@' | '@>' | '~';
  value: any;
}

export interface OrderByClause {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Builds a WHERE clause from conditions array
 * @param conditions - Array of where conditions
 * @returns Object with SQL clause and parameters
 */
export function buildWhereClause(conditions: WhereCondition[]): {
  clause: string;
  params: any[];
} {
  if (conditions.length === 0) {
    return { clause: '', params: [] };
  }

  const clauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const condition of conditions) {
    const { field, operator, value } = condition;
    
    // Validate field name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }

    if (operator === 'IN' || operator === 'NOT IN') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`${operator} requires non-empty array value`);
      }
      const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
      clauses.push(`${field} ${operator} (${placeholders})`);
      params.push(...value);
    } else if (operator === 'IS' || operator === 'IS NOT') {
      // Handle IS NULL / IS NOT NULL specially
      if (value === null) {
        clauses.push(`${field} ${operator} NULL`);
      } else {
        clauses.push(`${field} ${operator} $${paramIndex++}`);
        params.push(value);
      }
    } else {
      clauses.push(`${field} ${operator} $${paramIndex++}`);
      params.push(value);
    }
  }

  return {
    clause: `WHERE ${clauses.join(' AND ')}`,
    params
  };
}

/**
 * Builds an ORDER BY clause from order specifications
 * @param orderBy - Array of order by clauses
 * @returns SQL ORDER BY clause
 */
export function buildOrderByClause(orderBy: OrderByClause[]): string {
  if (orderBy.length === 0) {
    return '';
  }

  const clauses = orderBy.map(({ field, direction }) => {
    // Validate field name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }
    return `${field} ${direction}`;
  });

  return `ORDER BY ${clauses.join(', ')}`;
}

/**
 * Builds LIMIT and OFFSET clause for pagination
 * @param pagination - Pagination options
 * @param paramStartIndex - Starting index for parameters
 * @returns Object with SQL clause and parameters
 */
export function buildPaginationClause(
  pagination: PaginationOptions,
  paramStartIndex: number = 1
): {
  clause: string;
  params: any[];
} {
  const clauses: string[] = [];
  const params: any[] = [];
  let paramIndex = paramStartIndex;

  if (pagination.limit !== undefined) {
    clauses.push(`LIMIT $${paramIndex++}`);
    params.push(pagination.limit);
  }

  if (pagination.offset !== undefined) {
    clauses.push(`OFFSET $${paramIndex++}`);
    params.push(pagination.offset);
  }

  return {
    clause: clauses.join(' '),
    params
  };
}

/**
 * Builds a complete SELECT query with WHERE, ORDER BY, and pagination
 * @param options - Query building options
 * @returns Object with complete query and parameters
 */
export function buildSelectQuery(options: {
  select: string[];
  from: string;
  joins?: string[];
  where?: WhereCondition[];
  orderBy?: OrderByClause[];
  pagination?: PaginationOptions;
}): {
  query: string;
  params: any[];
} {
  const { select, from, joins = [], where = [], orderBy = [], pagination = {} } = options;

  // Build SELECT clause
  const selectClause = `SELECT ${select.join(', ')}`;
  
  // Build FROM clause
  const fromClause = `FROM ${from}`;
  
  // Build JOIN clauses
  const joinClause = joins.length > 0 ? joins.join(' ') : '';
  
  // Build WHERE clause
  const whereResult = buildWhereClause(where);
  
  // Build ORDER BY clause
  const orderByClause = buildOrderByClause(orderBy);
  
  // Build pagination clause
  const paginationResult = buildPaginationClause(
    pagination, 
    whereResult.params.length + 1
  );

  // Combine all clauses
  const queryParts = [
    selectClause,
    fromClause,
    joinClause,
    whereResult.clause,
    orderByClause,
    paginationResult.clause
  ].filter(part => part.length > 0);

  return {
    query: queryParts.join(' '),
    params: [...whereResult.params, ...paginationResult.params]
  };
}

/**
 * Builds an INSERT query with proper parameter handling
 * @param table - Table name
 * @param data - Object with field names and values
 * @param returning - Fields to return after insert
 * @returns Object with query and parameters
 */
export function buildInsertQuery(
  table: string,
  data: Record<string, any>,
  returning: string[] = ['*']
): {
  query: string;
  params: any[];
} {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) {
    throw new Error('No data provided for insert');
  }

  // Validate table and field names
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  fields.forEach(field => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }
  });

  const fieldsList = fields.join(', ');
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
  const returningClause = returning.length > 0 ? `RETURNING ${returning.join(', ')}` : '';

  const query = `INSERT INTO ${table} (${fieldsList}) VALUES (${placeholders}) ${returningClause}`.trim();

  return {
    query,
    params: values
  };
}

/**
 * Builds an UPDATE query with proper parameter handling
 * @param table - Table name
 * @param data - Object with field names and new values
 * @param where - Where conditions for the update
 * @param returning - Fields to return after update
 * @returns Object with query and parameters
 */
export function buildUpdateQuery(
  table: string,
  data: Record<string, any>,
  where: WhereCondition[],
  returning: string[] = ['*']
): {
  query: string;
  params: any[];
} {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) {
    throw new Error('No data provided for update');
  }

  if (where.length === 0) {
    throw new Error('WHERE clause required for update operations');
  }

  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  // Build SET clause
  const setClause = fields.map((field, index) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }
    return `${field} = $${index + 1}`;
  }).join(', ');

  // Build WHERE clause
  const whereResult = buildWhereClause(where);
  // Adjust parameter indices in WHERE clause
  const adjustedWhereClause = whereResult.clause.replace(
    /\$(\d+)/g,
    (match, num) => `$${parseInt(num) + values.length}`
  );

  const returningClause = returning.length > 0 ? `RETURNING ${returning.join(', ')}` : '';

  const query = `UPDATE ${table} SET ${setClause} ${adjustedWhereClause} ${returningClause}`.trim();

  return {
    query,
    params: [...values, ...whereResult.params]
  };
}

/**
 * Escapes string values for LIKE queries
 * @param value - String value to escape
 * @returns Escaped string safe for LIKE queries
 */
export function escapeLikeValue(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/**
 * Builds a search condition for text fields
 * @param fields - Array of field names to search
 * @param searchTerm - Search term
 * @param caseSensitive - Whether search should be case sensitive
 * @returns WhereCondition for search
 */
export function buildSearchCondition(
  fields: string[],
  searchTerm: string,
  caseSensitive: boolean = false
): WhereCondition[] {
  if (!searchTerm.trim()) {
    return [];
  }

  const operator = caseSensitive ? 'LIKE' : 'ILIKE';
  const escapedTerm = `%${escapeLikeValue(searchTerm.trim())}%`;

  return fields.map(field => ({
    field,
    operator,
    value: escapedTerm
  }));
}