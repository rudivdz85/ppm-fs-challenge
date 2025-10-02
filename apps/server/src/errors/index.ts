/**
 * Custom error classes for service layer
 * Provides specific error types for different business scenarios
 */

/**
 * Base error class for all application errors
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;

  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error for business rule violations
 * Used when input data doesn't meet business requirements
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly field?: string,
    public readonly details?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR');
  }
}

/**
 * Not found error for missing resources
 * Used when requested entity doesn't exist
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;

  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND');
  }
}

/**
 * Unauthorized error for authentication failures
 * Used when user credentials are invalid
 */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly isOperational = true;

  constructor(message: string = 'Authentication required') {
    super(message, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden error for authorization failures
 * Used when user doesn't have permission for an action
 */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly isOperational = true;

  constructor(
    message: string = 'Access denied',
    public readonly requiredPermission?: string
  ) {
    super(message, 'FORBIDDEN');
  }
}

/**
 * Conflict error for duplicate or conflicting resources
 * Used when creating resources that already exist or conflict
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly conflictField?: string,
    public readonly conflictValue?: string
  ) {
    super(message, 'CONFLICT');
  }
}

/**
 * Business rule error for domain-specific violations
 * Used when operations violate business rules
 */
export class BusinessRuleError extends AppError {
  readonly statusCode = 422;
  readonly isOperational = true;

  constructor(
    message: string,
    public readonly rule?: string,
    public readonly context?: Record<string, any>
  ) {
    super(message, 'BUSINESS_RULE_VIOLATION');
  }
}

/**
 * Internal server error for unexpected failures
 * Used for unhandled errors that shouldn't be exposed to users
 */
export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(message: string = 'Internal server error', originalError?: Error) {
    super(message, 'INTERNAL_ERROR');
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * Rate limit error for too many requests
 * Used when user exceeds rate limits
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly isOperational = true;

  constructor(
    message: string = 'Too many requests',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Service unavailable error for external dependencies
 * Used when external services are down
 */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly isOperational = true;

  constructor(
    message: string = 'Service temporarily unavailable',
    public readonly service?: string
  ) {
    super(message, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Error handler utility functions
 */
export class ErrorHandler {
  /**
   * Check if error is an operational error (safe to expose to users)
   */
  static isOperationalError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Convert unknown error to AppError
   */
  static handleUnknownError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new InternalServerError(error.message, error);
    }

    return new InternalServerError('An unknown error occurred');
  }

  /**
   * Create error response object
   */
  static createErrorResponse(error: AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        ...(error instanceof ValidationError && error.field && { field: error.field }),
        ...(error instanceof ValidationError && error.details && { details: error.details }),
        ...(error instanceof ForbiddenError && error.requiredPermission && { 
          requiredPermission: error.requiredPermission 
        }),
        ...(error instanceof ConflictError && error.conflictField && { 
          conflictField: error.conflictField,
          conflictValue: error.conflictValue
        }),
        ...(error instanceof BusinessRuleError && error.rule && { rule: error.rule }),
        ...(error instanceof BusinessRuleError && error.context && { context: error.context })
      }
    };
  }
}

/**
 * Result wrapper for service operations
 * Provides consistent success/error handling
 */
export type ServiceResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: AppError;
};

/**
 * Create success result
 */
export function createSuccessResult<T>(data: T): ServiceResult<T> {
  return {
    success: true,
    data
  };
}

/**
 * Create error result
 */
export function createErrorResult<T>(error: AppError): ServiceResult<T> {
  return {
    success: false,
    error
  };
}

/**
 * Async result wrapper for handling promise-based operations
 */
export async function handleAsync<T>(
  operation: () => Promise<T>
): Promise<ServiceResult<T>> {
  try {
    const data = await operation();
    return createSuccessResult(data);
  } catch (error) {
    const appError = ErrorHandler.handleUnknownError(error);
    return createErrorResult(appError);
  }
}