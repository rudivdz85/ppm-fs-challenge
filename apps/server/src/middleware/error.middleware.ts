/**
 * Global error handling middleware
 * Catches all errors, maps custom errors to status codes, and returns consistent JSON format
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createServiceLogger } from '../services/utils/logger';

const logger = createServiceLogger('ErrorMiddleware');

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ValidationError extends Error implements CustomError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends Error implements CustomError {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error implements CustomError {
  statusCode = 401;
  code = 'UNAUTHORIZED';
  
  constructor(message: string = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error implements CustomError {
  statusCode = 403;
  code = 'FORBIDDEN';
  
  constructor(message: string = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error implements CustomError {
  statusCode = 409;
  code = 'CONFLICT';
  details: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ConflictError';
    this.details = details;
  }
}

export class BusinessLogicError extends Error implements CustomError {
  statusCode = 422;
  code = 'BUSINESS_LOGIC_ERROR';
  details: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'BusinessLogicError';
    this.details = details;
  }
}

/**
 * Maps Zod validation errors to a readable format
 */
function formatZodError(error: ZodError): { message: string; details: any } {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: err.received
  }));

  const firstError = error.errors[0];
  const fieldName = firstError.path.join('.');
  const message = fieldName 
    ? `Validation failed for field '${fieldName}': ${firstError.message}`
    : `Validation failed: ${firstError.message}`;

  return { message, details };
}

/**
 * Global error handling middleware
 * Must be placed after all routes to catch errors from controllers and middleware
 */
export const errorHandler = (
  err: Error | CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Don't handle if response already sent
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    const formatted = formatZodError(err);
    message = formatted.message;
    details = formatted.details;
  }
  // Handle custom application errors
  else if ('statusCode' in err && err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
    code = (err as CustomError).code || 'APPLICATION_ERROR';
    details = (err as CustomError).details;
  }
  // Handle known Express/Node errors
  else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  }
  else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
  }
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }
  else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }

  // Log error details for debugging
  const errorLog = {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode,
      code
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id
    },
    details
  };

  // Log as error for 5xx, warn for 4xx
  if (statusCode >= 500) {
    logger.error('Server error occurred', errorLog, err);
  } else if (statusCode >= 400) {
    logger.warn('Client error occurred', errorLog);
  }

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && statusCode >= 500) {
    message = 'An internal error occurred';
    details = undefined;
  }

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      message,
      code,
      statusCode,
      ...(details && { details })
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId,
      ...(req.path && { path: req.path }),
      ...(req.method && { method: req.method })
    }
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for undefined routes
 * Must be placed before the error handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
      statusCode: 404
    },
    meta: {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  });
};

/**
 * Request logging middleware
 * Logs all incoming requests for debugging
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Generate request ID for tracing
  (req as any).requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  (req as any).startTime = startTime;

  // Log request start
  logger.info('Request started', {
    requestId: (req as any).requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type')
  });

  // Log response when finished
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId: (req as any).requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || body?.length
    });

    return originalSend.call(this, body);
  };

  next();
};