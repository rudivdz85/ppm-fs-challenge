/**
 * Response utilities for consistent API responses
 * Provides standardized success and error response formats
 */

import { Response } from 'express';
import { AppError, ServiceResult } from '../errors';
import { createServiceLogger } from '../services/utils/logger';

const logger = createServiceLogger('ResponseUtil');

/**
 * Standard API response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    statusCode: number;
    details?: any;
    stack?: string;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    executionTime?: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Success response utility
 * 
 * @param res - Express response object
 * @param data - Response data
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Additional metadata
 * 
 * @example
 * ```typescript
 * success(res, { id: 1, name: 'John' }, 201);
 * success(res, users, 200, { 
 *   pagination: { page: 1, limit: 20, total: 100, pages: 5 }
 * });
 * ```
 */
export function success<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    requestId?: string;
    executionTime?: number;
    [key: string]: any;
  }
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: meta?.requestId || (res.req as any)?.requestId,
      executionTime: meta?.executionTime || calculateExecutionTime(res.req),
      ...meta
    }
  };

  if (meta?.pagination) {
    response.pagination = meta.pagination;
  }

  res.status(statusCode).json(response);
}

/**
 * Error response utility
 * 
 * @param res - Express response object
 * @param error - Error message or Error object
 * @param statusCode - HTTP status code (default: 500)
 * @param details - Additional error details
 * 
 * @example
 * ```typescript
 * error(res, 'User not found', 404);
 * error(res, new ValidationError('Invalid email'));
 * error(res, 'Access denied', 403, { requiredRole: 'admin' });
 * ```
 */
export function error(
  res: Response,
  error: string | Error | AppError,
  statusCode?: number,
  details?: any
): void {
  let errorMessage: string;
  let errorCode: string;
  let errorStatusCode: number;
  let errorDetails: any;
  let stack: string | undefined;

  if (typeof error === 'string') {
    errorMessage = error;
    errorCode = 'GENERIC_ERROR';
    errorStatusCode = statusCode || 500;
    errorDetails = details;
  } else if (error instanceof AppError) {
    errorMessage = error.message;
    errorCode = error.code || error.constructor.name.replace('Error', '').toUpperCase();
    errorStatusCode = error.statusCode;
    errorDetails = error.details || details;
    stack = error.stack;
  } else {
    errorMessage = error.message || 'An unexpected error occurred';
    errorCode = 'INTERNAL_ERROR';
    errorStatusCode = statusCode || 500;
    errorDetails = details;
    stack = error.stack;
  }

  const response: ApiResponse = {
    success: false,
    error: {
      message: errorMessage,
      code: errorCode,
      statusCode: errorStatusCode,
      details: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? stack : undefined
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (res.req as any)?.requestId,
      executionTime: calculateExecutionTime(res.req)
    }
  };

  // Log error for monitoring
  logger.error('API Error Response', {
    operation: 'errorResponse',
    statusCode: errorStatusCode,
    errorCode,
    message: errorMessage,
    path: res.req?.path,
    method: res.req?.method,
    userId: (res.req as any)?.user?.id,
    requestId: (res.req as any)?.requestId,
    details: errorDetails
  }, error instanceof Error ? error : new Error(errorMessage));

  res.status(errorStatusCode).json(response);
}

/**
 * Handle service result utility
 * Automatically converts ServiceResult to appropriate HTTP response
 * 
 * @param res - Express response object
 * @param result - Service result object
 * @param successStatusCode - Status code for successful responses (default: 200)
 * @param meta - Additional metadata for successful responses
 * 
 * @example
 * ```typescript
 * const result = await userService.createUser(userData);
 * handleServiceResult(res, result, 201);
 * ```
 */
export function handleServiceResult<T>(
  res: Response,
  result: ServiceResult<T>,
  successStatusCode: number = 200,
  meta?: any
): void {
  if (result.success) {
    success(res, result.data, successStatusCode, meta);
  } else {
    error(res, result.error);
  }
}

/**
 * No content response utility
 * 
 * @param res - Express response object
 * 
 * @example
 * ```typescript
 * // For DELETE operations
 * await userService.deleteUser(userId);
 * noContent(res);
 * ```
 */
export function noContent(res: Response): void {
  res.status(204).send();
}

/**
 * Created response utility
 * 
 * @param res - Express response object
 * @param data - Created resource data
 * @param meta - Additional metadata
 * 
 * @example
 * ```typescript
 * const newUser = await userService.createUser(userData);
 * created(res, newUser);
 * ```
 */
export function created<T>(
  res: Response,
  data: T,
  meta?: any
): void {
  success(res, data, 201, meta);
}

/**
 * Accepted response utility (for async operations)
 * 
 * @param res - Express response object
 * @param data - Response data (typically operation ID or status)
 * @param meta - Additional metadata
 * 
 * @example
 * ```typescript
 * const operationId = await bulkOperationService.startBulkUpdate(data);
 * accepted(res, { operationId, status: 'processing' });
 * ```
 */
export function accepted<T>(
  res: Response,
  data: T,
  meta?: any
): void {
  success(res, data, 202, meta);
}

/**
 * Paginated response utility
 * 
 * @param res - Express response object
 * @param items - Array of items
 * @param pagination - Pagination information
 * @param meta - Additional metadata
 * 
 * @example
 * ```typescript
 * const { items, total, page, limit, pages } = await userService.getUsers(filters);
 * paginated(res, items, { page, limit, total, pages });
 * ```
 */
export function paginated<T>(
  res: Response,
  items: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  },
  meta?: any
): void {
  success(res, items, 200, {
    ...meta,
    pagination
  });
}

/**
 * Not found response utility
 * 
 * @param res - Express response object
 * @param resource - Resource that was not found
 * @param details - Additional details
 * 
 * @example
 * ```typescript
 * notFound(res, 'User');
 * notFound(res, 'Permission', { userId, hierarchyId });
 * ```
 */
export function notFound(
  res: Response,
  resource: string = 'Resource',
  details?: any
): void {
  error(res, `${resource} not found`, 404, details);
}

/**
 * Unauthorized response utility
 * 
 * @param res - Express response object
 * @param message - Custom unauthorized message
 * @param details - Additional details
 */
export function unauthorized(
  res: Response,
  message: string = 'Access denied. Authentication required.',
  details?: any
): void {
  error(res, message, 401, details);
}

/**
 * Forbidden response utility
 * 
 * @param res - Express response object
 * @param message - Custom forbidden message
 * @param details - Additional details
 */
export function forbidden(
  res: Response,
  message: string = 'Access denied. Insufficient permissions.',
  details?: any
): void {
  error(res, message, 403, details);
}

/**
 * Bad request response utility
 * 
 * @param res - Express response object
 * @param message - Error message
 * @param details - Additional details (e.g., validation errors)
 */
export function badRequest(
  res: Response,
  message: string = 'Bad request',
  details?: any
): void {
  error(res, message, 400, details);
}

/**
 * Conflict response utility
 * 
 * @param res - Express response object
 * @param message - Conflict message
 * @param details - Additional details
 */
export function conflict(
  res: Response,
  message: string = 'Resource conflict',
  details?: any
): void {
  error(res, message, 409, details);
}

/**
 * Internal server error response utility
 * 
 * @param res - Express response object
 * @param message - Error message
 * @param originalError - Original error for logging
 */
export function internalServerError(
  res: Response,
  message: string = 'Internal server error',
  originalError?: Error
): void {
  if (originalError) {
    logger.error('Internal server error', {
      operation: 'internalServerError',
      path: res.req?.path,
      method: res.req?.method,
      userId: (res.req as any)?.user?.id
    }, originalError);
  }

  error(res, message, 500);
}

/**
 * Calculate execution time from request start
 */
function calculateExecutionTime(req: any): number | undefined {
  if (req?.startTime) {
    return Date.now() - req.startTime;
  }
  return undefined;
}

/**
 * Map service error to HTTP status code
 */
export function mapErrorToStatusCode(error: Error | AppError): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }

  // Map by error name/type
  const errorName = error.constructor.name;
  
  switch (errorName) {
    case 'ValidationError':
      return 400;
    case 'NotFoundError':
      return 404;
    case 'UnauthorizedError':
      return 401;
    case 'ForbiddenError':
      return 403;
    case 'ConflictError':
      return 409;
    case 'BusinessRuleError':
      return 400;
    default:
      return 500;
  }
}

/**
 * Response utility class for organized access
 */
export class ResponseUtils {
  static success = success;
  static error = error;
  static handleServiceResult = handleServiceResult;
  static noContent = noContent;
  static created = created;
  static accepted = accepted;
  static paginated = paginated;
  static notFound = notFound;
  static unauthorized = unauthorized;
  static forbidden = forbidden;
  static badRequest = badRequest;
  static conflict = conflict;
  static internalServerError = internalServerError;
  static mapErrorToStatusCode = mapErrorToStatusCode;
}