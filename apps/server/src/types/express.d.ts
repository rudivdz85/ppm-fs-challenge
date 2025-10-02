/**
 * Express type definitions extensions
 * Extends Express Request interface with custom properties
 */

import { User, TokenPayload } from '@ppm/types';
import { ValidatedData } from '../middleware/validate.middleware';

declare global {
  namespace Express {
    /**
     * Extended Request interface with authentication and validation data
     */
    interface Request {
      /**
       * Authenticated user information
       * Populated by authenticate middleware after JWT verification
       */
      user?: AuthenticatedUser;

      /**
       * Validated request data from validation middleware
       * Contains validated body, params, and query data
       */
      validatedData?: ValidatedData;

      /**
       * Request ID for tracing and logging
       */
      requestId?: string;

      /**
       * Request start time for performance monitoring
       */
      startTime?: number;

      /**
       * Client IP address (may be forwarded)
       */
      clientIp?: string;

      /**
       * User agent information
       */
      userAgent?: string;
    }
  }
}

/**
 * Authenticated user information attached to request
 */
export interface AuthenticatedUser {
  /**
   * User ID from JWT token
   */
  id: string;

  /**
   * User email from JWT token
   */
  email: string;

  /**
   * User's base hierarchy ID
   */
  hierarchy_id: string;

  /**
   * User's hierarchy path (optional)
   */
  hierarchy_path?: string;

  /**
   * Token payload information
   */
  tokenPayload: TokenPayload;

  /**
   * Token issued at timestamp
   */
  iat: number;

  /**
   * Token expiration timestamp
   */
  exp: number;
}

/**
 * Request with authenticated user
 */
export interface AuthenticatedRequest extends Express.Request {
  user: AuthenticatedUser;
}

/**
 * Request with validated data
 */
export interface ValidatedRequest extends Express.Request {
  validatedData: ValidatedData;
}

/**
 * Request with both authentication and validation
 */
export interface AuthenticatedValidatedRequest extends Express.Request {
  user: AuthenticatedUser;
  validatedData: ValidatedData;
}

/**
 * Response locals for additional data
 */
export interface ResponseLocals {
  /**
   * Request processing start time
   */
  startTime?: number;

  /**
   * Request ID for tracking
   */
  requestId?: string;

  /**
   * Additional context data
   */
  context?: Record<string, any>;
}

/**
 * Custom Response interface with locals
 */
export interface CustomResponse extends Express.Response {
  locals: ResponseLocals;
}

/**
 * Route handler with authenticated user
 */
export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Express.Response,
  next: Express.NextFunction
) => void | Promise<void>;

/**
 * Route handler with validated data
 */
export type ValidatedHandler = (
  req: ValidatedRequest,
  res: Express.Response,
  next: Express.NextFunction
) => void | Promise<void>;

/**
 * Route handler with both authentication and validation
 */
export type AuthenticatedValidatedHandler = (
  req: AuthenticatedValidatedRequest,
  res: Express.Response,
  next: Express.NextFunction
) => void | Promise<void>;

/**
 * Error handler with custom request
 */
export type ErrorHandler = (
  error: Error,
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) => void;

/**
 * Middleware function with custom request types
 */
export type CustomMiddleware = (
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) => void | Promise<void>;

/**
 * Type guard to check if request has authenticated user
 */
export function isAuthenticatedRequest(req: Express.Request): req is AuthenticatedRequest {
  return req.user !== undefined;
}

/**
 * Type guard to check if request has validated data
 */
export function isValidatedRequest(req: Express.Request): req is ValidatedRequest {
  return req.validatedData !== undefined;
}

/**
 * Type guard to check if request has both auth and validation
 */
export function isAuthenticatedValidatedRequest(req: Express.Request): req is AuthenticatedValidatedRequest {
  return req.user !== undefined && req.validatedData !== undefined;
}

/**
 * Controller method signature
 */
export type ControllerMethod = (
  req: Express.Request,
  res: Express.Response,
  next?: Express.NextFunction
) => Promise<void> | void;

/**
 * Authenticated controller method signature
 */
export type AuthenticatedControllerMethod = (
  req: AuthenticatedRequest,
  res: Express.Response,
  next?: Express.NextFunction
) => Promise<void> | void;

/**
 * Validated controller method signature
 */
export type ValidatedControllerMethod = (
  req: ValidatedRequest,
  res: Express.Response,
  next?: Express.NextFunction
) => Promise<void> | void;

/**
 * Fully typed controller method signature
 */
export type AuthenticatedValidatedControllerMethod = (
  req: AuthenticatedValidatedRequest,
  res: Express.Response,
  next?: Express.NextFunction
) => Promise<void> | void;