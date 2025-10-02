/**
 * Validation middleware factory using Zod
 * Validates request data format, types, and constraints before hitting services
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from '../errors';

/**
 * Validation target types
 */
export type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Validation schema configuration
 */
export interface ValidationConfig {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Validated request data interface
 */
export interface ValidatedData {
  body?: any;
  params?: any;
  query?: any;
}

/**
 * Extended Express Request with validated data
 */
export interface ValidatedRequest extends Request {
  validatedData: ValidatedData;
}

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: string;
}

/**
 * Format Zod error into user-friendly validation errors
 */
function formatZodError(error: ZodError, target: ValidationTarget): ValidationErrorDetail[] {
  return error.errors.map(err => {
    const field = err.path.length > 0 ? err.path.join('.') : target;
    
    let message = err.message;
    let code = err.code;
    
    // Customize messages for better UX
    switch (err.code) {
      case 'invalid_type':
        if (err.expected === 'string' && err.received === 'undefined') {
          message = 'This field is required';
          code = 'required';
        } else {
          message = `Expected ${err.expected}, received ${err.received}`;
        }
        break;
      
      case 'too_small':
        if (err.type === 'string') {
          message = `Must be at least ${err.minimum} characters long`;
        } else if (err.type === 'number') {
          message = `Must be at least ${err.minimum}`;
        }
        break;
      
      case 'too_big':
        if (err.type === 'string') {
          message = `Must be no more than ${err.maximum} characters long`;
        } else if (err.type === 'number') {
          message = `Must be no more than ${err.maximum}`;
        }
        break;
      
      case 'invalid_string':
        if (err.validation === 'email') {
          message = 'Must be a valid email address';
        } else if (err.validation === 'uuid') {
          message = 'Must be a valid UUID';
        }
        break;
      
      case 'invalid_enum_value':
        message = `Must be one of: ${err.options?.join(', ')}`;
        break;
      
      default:
        message = err.message;
    }

    return {
      field: field,
      message,
      code,
      received: ('received' in err) ? err.received : undefined,
      expected: ('expected' in err) ? err.expected : undefined
    };
  });
}

/**
 * Create validation middleware for a single target (body, params, or query)
 */
export function validateTarget(schema: ZodSchema, target: ValidationTarget) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[target];
      const validatedData = schema.parse(dataToValidate);
      
      // Initialize validatedData if not exists
      if (!(req as ValidatedRequest).validatedData) {
        (req as ValidatedRequest).validatedData = {};
      }
      
      // Store validated data
      (req as ValidatedRequest).validatedData[target] = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodError(error, target);
        const validationError = new ValidationError(
          `Validation failed for ${target}`,
          target,
          {
            target,
            errors: validationErrors
          }
        );
        
        return res.status(400).json({
          success: false,
          error: {
            message: validationError.message,
            code: validationError.code,
            statusCode: 400,
            details: {
              target,
              errors: validationErrors
            }
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Handle unexpected errors
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal validation error',
          code: 'VALIDATION_ERROR',
          statusCode: 500
        },
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Create comprehensive validation middleware
 * Supports validating body, params, query, or combination
 */
export function validate(config: ValidationConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData: ValidatedData = {};
      const allErrors: ValidationErrorDetail[] = [];
      
      // Validate each configured target
      for (const [target, schema] of Object.entries(config)) {
        if (schema) {
          try {
            const dataToValidate = req[target as ValidationTarget];
            const validated = schema.parse(dataToValidate);
            validatedData[target as ValidationTarget] = validated;
          } catch (error) {
            if (error instanceof ZodError) {
              const targetErrors = formatZodError(error, target as ValidationTarget);
              allErrors.push(...targetErrors);
            }
          }
        }
      }
      
      // If there are validation errors, return them
      if (allErrors.length > 0) {
        const validationError = new ValidationError(
          'Request validation failed',
          'request',
          {
            errors: allErrors,
            errorCount: allErrors.length
          }
        );
        
        return res.status(400).json({
          success: false,
          error: {
            message: validationError.message,
            code: validationError.code,
            statusCode: 400,
            details: {
              errors: allErrors,
              errorCount: allErrors.length
            }
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Attach validated data to request
      (req as ValidatedRequest).validatedData = validatedData;
      
      next();
    } catch (error) {
      // Handle unexpected errors
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal validation error',
          code: 'VALIDATION_ERROR',
          statusCode: 500
        },
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Validate only request body
 */
export function validateBody(schema: ZodSchema) {
  return validate({ body: schema });
}

/**
 * Validate only request params
 */
export function validateParams(schema: ZodSchema) {
  return validate({ params: schema });
}

/**
 * Validate only query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return validate({ query: schema });
}

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  // UUID parameter validation
  uuidParam: z.object({
    id: z.string().uuid('Must be a valid UUID')
  }),
  
  // Pagination query validation
  pagination: z.object({
    page: z.string()
      .optional()
      .transform(val => val ? parseInt(val, 10) : 1)
      .pipe(z.number().int().min(1, 'Page must be at least 1')),
    limit: z.string()
      .optional()
      .transform(val => val ? parseInt(val, 10) : 20)
      .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100'))
  }),
  
  // Search query validation
  search: z.object({
    search: z.string()
      .max(100, 'Search term cannot exceed 100 characters')
      .optional()
      .transform(val => val?.trim())
  }),
  
  // Sort parameters validation
  sort: z.object({
    sortBy: z.enum(['name', 'email', 'createdAt', 'updatedAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
  })
};

/**
 * Helper to create typed validation middleware
 * Provides TypeScript type inference for validated data
 */
export function createTypedValidator<
  TBody = any,
  TParams = any,
  TQuery = any
>(config: {
  body?: z.ZodType<TBody>;
  params?: z.ZodType<TParams>;
  query?: z.ZodType<TQuery>;
}) {
  return validate(config);
}

/**
 * Validation error response helper
 */
export function createValidationErrorResponse(
  message: string,
  errors: ValidationErrorDetail[]
) {
  return {
    success: false,
    error: {
      message,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: {
        errors,
        errorCount: errors.length
      }
    },
    timestamp: new Date().toISOString()
  };
}