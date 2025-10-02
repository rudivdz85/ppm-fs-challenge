/**
 * Authentication middleware
 * Verifies JWT tokens and attaches user information to requests
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractUserIdFromToken } from '../utils/jwt.util';
import { AuthenticatedUser } from '../types/express';
import { createServiceLogger } from '../services/utils/logger';

const logger = createServiceLogger('AuthMiddleware');

/**
 * Authentication middleware
 * Extracts and verifies JWT token from Authorization header
 * Attaches user information to req.user for use in controllers
 * 
 * @example
 * ```typescript
 * // Protect a route
 * app.get('/protected', authenticate, (req, res) => {
 *   console.log(req.user.id); // User ID from token
 *   res.json({ message: 'Authenticated!' });
 * });
 * ```
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Authentication failed - no authorization header', {
        operation: 'authenticate',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      res.status(401).json({
        success: false,
        error: {
          message: 'Access denied. No token provided.',
          code: 'NO_TOKEN',
          statusCode: 401
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if token starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed - invalid token format', {
        operation: 'authenticate',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      res.status(401).json({
        success: false,
        error: {
          message: 'Access denied. Invalid token format.',
          code: 'INVALID_TOKEN_FORMAT',
          statusCode: 401
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      logger.warn('Authentication failed - empty token', {
        operation: 'authenticate',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      res.status(401).json({
        success: false,
        error: {
          message: 'Access denied. Empty token.',
          code: 'EMPTY_TOKEN',
          statusCode: 401
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Verify token
    const verificationResult = verifyToken(token);
    
    if (!verificationResult.success || !verificationResult.payload) {
      logger.warn('Authentication failed - token verification failed', {
        operation: 'authenticate',
        error: verificationResult.error,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        userId: extractUserIdFromToken(token) // Safe extraction for logging
      });
      
      res.status(401).json({
        success: false,
        error: {
          message: 'Access denied. Invalid or expired token.',
          code: 'INVALID_TOKEN',
          statusCode: 401,
          details: {
            reason: verificationResult.error
          }
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Create authenticated user object
    const authenticatedUser: AuthenticatedUser = {
      id: verificationResult.payload.user_id,
      email: verificationResult.payload.email,
      hierarchy_id: verificationResult.payload.hierarchy_id,
      hierarchy_path: verificationResult.payload.hierarchy_path,
      tokenPayload: verificationResult.payload,
      iat: verificationResult.payload.iat,
      exp: verificationResult.payload.exp
    };

    // Attach user to request
    req.user = authenticatedUser;

    // Add request metadata for logging
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.startTime = Date.now();
    req.clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    req.userAgent = req.get('User-Agent') || 'unknown';

    logger.info('User authenticated successfully', {
      operation: 'authenticate',
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      hierarchyId: authenticatedUser.hierarchy_id,
      requestId: req.requestId,
      ip: req.clientIp,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Authentication error', {
      operation: 'authenticate',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    }, error as Error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Internal authentication error.',
        code: 'AUTH_ERROR',
        statusCode: 500
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Optional authentication middleware
 * Similar to authenticate but doesn't fail if no token is provided
 * Useful for endpoints that work both with and without authentication
 * 
 * @example
 * ```typescript
 * // Optional authentication
 * app.get('/public-or-private', optionalAuthenticate, (req, res) => {
 *   if (req.user) {
 *     res.json({ message: 'Hello ' + req.user.email });
 *   } else {
 *     res.json({ message: 'Hello anonymous' });
 *   }
 * });
 * ```
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      next();
      return;
    }

    // Verify token
    const verificationResult = verifyToken(token);
    
    if (verificationResult.success && verificationResult.payload) {
      // Create authenticated user object
      const authenticatedUser: AuthenticatedUser = {
        id: verificationResult.payload.user_id,
        email: verificationResult.payload.email,
        hierarchy_id: verificationResult.payload.hierarchy_id,
        hierarchy_path: verificationResult.payload.hierarchy_path,
        tokenPayload: verificationResult.payload,
        iat: verificationResult.payload.iat,
        exp: verificationResult.payload.exp
      };

      req.user = authenticatedUser;
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.startTime = Date.now();
      req.clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      req.userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Optional authentication successful', {
        operation: 'optionalAuthenticate',
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        requestId: req.requestId,
        path: req.path
      });
    } else {
      logger.debug('Optional authentication failed - invalid token', {
        operation: 'optionalAuthenticate',
        error: verificationResult.error,
        path: req.path
      });
    }

    next();
  } catch (error) {
    logger.warn('Optional authentication error', {
      operation: 'optionalAuthenticate',
      path: req.path
    }, error as Error);

    // Continue without authentication on error
    next();
  }
};

/**
 * Require fresh authentication middleware
 * Requires a token that was issued within the last specified minutes
 * Useful for sensitive operations like password changes
 * 
 * @param maxAgeMinutes - Maximum age of token in minutes (default: 30)
 * 
 * @example
 * ```typescript
 * // Require fresh token (issued within last 30 minutes)
 * app.post('/change-password', 
 *   authenticate, 
 *   requireFreshAuth(30), 
 *   changePassword
 * );
 * ```
 */
export const requireFreshAuth = (maxAgeMinutes: number = 30) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required.',
          code: 'AUTH_REQUIRED',
          statusCode: 401
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    const tokenIssuedAt = req.user.iat * 1000; // Convert to milliseconds
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    const tokenAge = Date.now() - tokenIssuedAt;

    if (tokenAge > maxAge) {
      logger.warn('Fresh authentication required', {
        operation: 'requireFreshAuth',
        userId: req.user.id,
        tokenAge: Math.round(tokenAge / 1000 / 60), // Age in minutes
        maxAgeMinutes,
        path: req.path
      });

      res.status(401).json({
        success: false,
        error: {
          message: 'Fresh authentication required. Please log in again.',
          code: 'FRESH_AUTH_REQUIRED',
          statusCode: 401,
          details: {
            maxAgeMinutes,
            tokenAgeMinutes: Math.round(tokenAge / 1000 / 60)
          }
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.debug('Fresh authentication check passed', {
      operation: 'requireFreshAuth',
      userId: req.user.id,
      tokenAge: Math.round(tokenAge / 1000 / 60),
      maxAgeMinutes
    });

    next();
  };
};

/**
 * Extract user ID from request
 * Utility function to safely get user ID from authenticated request
 */
export const getUserIdFromRequest = (req: Request): string | null => {
  return req.user?.id || null;
};

/**
 * Check if request is authenticated
 * Type guard function
 */
export const isAuthenticated = (req: Request): req is Request & { user: AuthenticatedUser } => {
  return req.user !== undefined;
};

/**
 * Authentication status check endpoint middleware
 * Returns authentication status without failing
 */
export const checkAuthStatus = (req: Request, res: Response): void => {
  if (req.user) {
    res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        hierarchy_id: req.user.hierarchy_id,
        hierarchy_path: req.user.hierarchy_path
      },
      tokenExpiry: req.user.exp * 1000 // Convert to milliseconds
    });
  } else {
    res.json({
      success: true,
      authenticated: false,
      user: null
    });
  }
};