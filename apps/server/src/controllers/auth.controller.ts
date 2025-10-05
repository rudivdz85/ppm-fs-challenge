/**
 * AuthController - Authentication and registration endpoints
 * Handles login, registration, token refresh, and password operations
 */

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { UserRepository, HierarchyRepository, PermissionRepository } from '../repositories';
import { generateTokenPair } from '../utils/jwt.util';
import { success, error, created, handleServiceResult } from '../utils/response.util';
import { createServiceLogger } from '../services/utils/logger';
import { AuthenticatedRequest, ValidatedRequest, AuthenticatedValidatedRequest } from '../types/express';

const logger = createServiceLogger('AuthController');

/**
 * AuthController class
 */
export class AuthController {
  private authService: AuthService;
  private userService: UserService;

  constructor() {
    const userRepo = new UserRepository();
    const hierarchyRepo = new HierarchyRepository();
    const permissionRepo = new PermissionRepository();
    
    this.authService = new AuthService(userRepo);
    this.userService = new UserService(userRepo, hierarchyRepo, permissionRepo);
  }

  /**
   * User login
   * POST /api/auth/login
   * 
   * @example
   * Request body:
   * {
   *   "email": "user@example.com",
   *   "password": "SecurePass123!"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "user": { ... },
   *     "token": "jwt-token",
   *     "refreshToken": "refresh-token",
   *     "expiresAt": "2024-01-02T12:00:00.000Z"
   *   }
   * }
   */
  public login = async (req: ValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Login attempt', {
        operation: 'login',
        email: req.validatedData.body.email,
        ip: req.clientIp,
        userAgent: req.userAgent
      });

      // Call auth service to authenticate user
      const loginResult = await this.authService.login(req.validatedData.body);

      if (!loginResult.success) {
        logger.warn('Login failed', {
          operation: 'login',
          email: req.validatedData.body.email,
          error: loginResult.error.message,
          ip: req.clientIp
        });

        error(res, loginResult.error);
        return;
      }

      // Generate additional token pair if needed
      const tokenPair = generateTokenPair({
        user_id: loginResult.data.user.id,
        email: loginResult.data.user.email,
        hierarchy_id: loginResult.data.user.base_hierarchy_id,
        hierarchy_path: loginResult.data.user.hierarchy_path
      });

      // Successful login response
      const responseData = {
        user: loginResult.data.user,
        token: loginResult.data.token,
        refreshToken: loginResult.data.refresh_token,
        expiresAt: loginResult.data.expires_at
      };

      logger.auth('User logged in successfully', {
        operation: 'login',
        userId: loginResult.data.user.id,
        email: loginResult.data.user.email,
        hierarchyId: loginResult.data.user.base_hierarchy_id,
        ip: req.clientIp,
        userAgent: req.userAgent
      });

      success(res, responseData, 200);
    } catch (err) {
      logger.error('Login error', {
        operation: 'login',
        email: req.validatedData?.body?.email,
        ip: req.clientIp
      }, err as Error);

      error(res, 'Login failed due to internal error', 500);
    }
  };

  /**
   * User registration
   * POST /api/auth/register
   * 
   * @example
   * Request body:
   * {
   *   "email": "newuser@example.com",
   *   "password": "SecurePass123!",
   *   "full_name": "John Doe",
   *   "base_hierarchy_id": "hierarchy-uuid",
   *   "phone": "+1234567890"
   * }
   */
  public register = async (req: ValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Registration attempt', {
        operation: 'register',
        email: req.validatedData.body.email,
        fullName: req.validatedData.body.full_name,
        hierarchyId: req.validatedData.body.base_hierarchy_id,
        ip: req.clientIp
      });

      // Create user through user service
      const createUserResult = await this.userService.createUser(
        req.validatedData.body,
        'system' // System user for registration
      );

      if (!createUserResult.success) {
        logger.warn('Registration failed', {
          operation: 'register',
          email: req.validatedData.body.email,
          error: createUserResult.error.message,
          ip: req.clientIp
        });

        error(res, createUserResult.error);
        return;
      }

      // Generate tokens for the new user
      const tokenPair = generateTokenPair({
        user_id: createUserResult.data.id,
        email: createUserResult.data.email,
        hierarchy_id: createUserResult.data.base_hierarchy_id,
        hierarchy_path: createUserResult.data.hierarchy_path
      });

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = createUserResult.data;

      const responseData = {
        user: userResponse,
        token: tokenPair.accessToken.token,
        refreshToken: tokenPair.refreshToken.token,
        expiresAt: tokenPair.accessToken.expiresAt
      };

      logger.auth('User registered successfully', {
        operation: 'register',
        userId: createUserResult.data.id,
        email: createUserResult.data.email,
        hierarchyId: createUserResult.data.base_hierarchy_id,
        ip: req.clientIp
      });

      created(res, responseData);
    } catch (err) {
      logger.error('Registration error', {
        operation: 'register',
        email: req.validatedData?.body?.email,
        ip: req.clientIp
      }, err as Error);

      error(res, 'Registration failed due to internal error', 500);
    }
  };

  /**
   * Refresh access token
   * POST /api/auth/refresh
   * 
   * @example
   * Request body:
   * {
   *   "refresh_token": "refresh-jwt-token"
   * }
   */
  public refreshToken = async (req: ValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Token refresh attempt', {
        operation: 'refreshToken',
        ip: req.clientIp
      });

      const refreshResult = await this.authService.refreshToken(req.validatedData.body);

      if (!refreshResult.success) {
        logger.warn('Token refresh failed', {
          operation: 'refreshToken',
          error: refreshResult.error.message,
          ip: req.clientIp
        });

        error(res, refreshResult.error);
        return;
      }

      const responseData = {
        user: refreshResult.data.user,
        token: refreshResult.data.token,
        refreshToken: refreshResult.data.refresh_token,
        expiresAt: refreshResult.data.expires_at
      };

      logger.auth('Token refreshed successfully', {
        operation: 'refreshToken',
        userId: refreshResult.data.user.id,
        ip: req.clientIp
      });

      success(res, responseData);
    } catch (err) {
      logger.error('Token refresh error', {
        operation: 'refreshToken',
        ip: req.clientIp
      }, err as Error);

      error(res, 'Token refresh failed due to internal error', 500);
    }
  };

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  public getCurrentUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Get current user', {
        operation: 'getCurrentUser',
        userId: req.user.id,
        ip: req.clientIp
      });

      // Get full user profile from token
      const userResult = await this.authService.getCurrentUser(
        req.headers.authorization?.substring(7) || ''
      );

      handleServiceResult(res, userResult);
    } catch (err) {
      logger.error('Get current user error', {
        operation: 'getCurrentUser',
        userId: req.user?.id,
        ip: req.clientIp
      }, err as Error);

      error(res, 'Failed to get current user', 500);
    }
  };

  /**
   * Change password
   * POST /api/auth/change-password
   * 
   * @example
   * Request body:
   * {
   *   "current_password": "oldpassword",
   *   "new_password": "NewSecurePass123!",
   *   "confirm_password": "NewSecurePass123!"
   * }
   */
  public changePassword = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Password change attempt', {
        operation: 'changePassword',
        userId: req.user.id,
        ip: req.clientIp
      });

      // Verify current password first
      const verifyResult = await this.authService.verifyUserPassword({
        user_id: req.user.id,
        password: req.validatedData.body.current_password
      });

      if (!verifyResult.success || !verifyResult.data.isValid) {
        logger.warn('Password change failed - invalid current password', {
          operation: 'changePassword',
          userId: req.user.id,
          ip: req.clientIp
        });

        error(res, 'Current password is incorrect', 400, { 
          field: 'current_password' 
        });
        return;
      }

      // Change password through user service
      const changeResult = await this.userService.changePassword(
        req.user.id,
        {
          currentPassword: req.validatedData.body.current_password,
          newPassword: req.validatedData.body.new_password,
          confirm_password: req.validatedData.body.confirm_password
        } as any,
        req.user.id
      );

      if (!changeResult.success) {
        error(res, changeResult.error);
        return;
      }

      logger.auth('Password changed successfully', {
        operation: 'changePassword',
        userId: req.user.id,
        ip: req.clientIp
      });

      success(res, { message: 'Password changed successfully' });
    } catch (err) {
      logger.error('Password change error', {
        operation: 'changePassword',
        userId: req.user?.id,
        ip: req.clientIp
      }, err as Error);

      error(res, 'Password change failed due to internal error', 500);
    }
  };

  /**
   * Logout user
   * POST /api/auth/logout
   * 
   * Note: In a stateless JWT system, logout is typically handled client-side
   * by removing the token. This endpoint is for logging purposes.
   */
  public logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      logger.auth('User logged out', {
        operation: 'logout',
        userId: req.user.id,
        email: req.user.email,
        ip: req.clientIp,
        userAgent: req.userAgent
      });

      success(res, { message: 'Logged out successfully' });
    } catch (err) {
      logger.error('Logout error', {
        operation: 'logout',
        userId: req.user?.id,
        ip: req.clientIp
      }, err as Error);

      error(res, 'Logout failed', 500);
    }
  };

  /**
   * Verify password for sensitive operations
   * POST /api/auth/verify-password
   * 
   * @example
   * Request body:
   * {
   *   "password": "current-password"
   * }
   */
  public verifyPassword = async (req: AuthenticatedValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Password verification attempt', {
        operation: 'verifyPassword',
        userId: req.user.id,
        ip: req.clientIp
      });

      const verifyResult = await this.authService.verifyUserPassword({
        user_id: req.user.id,
        password: req.validatedData.body.password
      });

      if (!verifyResult.success) {
        error(res, verifyResult.error);
        return;
      }

      logger.auth('Password verification completed', {
        operation: 'verifyPassword',
        userId: req.user.id,
        isValid: verifyResult.data.isValid,
        ip: req.clientIp
      });

      success(res, { 
        isValid: verifyResult.data.isValid,
        message: verifyResult.data.isValid ? 'Password is correct' : 'Password is incorrect'
      });
    } catch (err) {
      logger.error('Password verification error', {
        operation: 'verifyPassword',
        userId: req.user?.id,
        ip: req.clientIp
      }, err as Error);

      error(res, 'Password verification failed', 500);
    }
  };

  /**
   * Generate password reset token
   * POST /api/auth/forgot-password
   * 
   * @example
   * Request body:
   * {
   *   "email": "user@example.com"
   * }
   */
  public forgotPassword = async (req: ValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Password reset request', {
        operation: 'forgotPassword',
        email: req.validatedData.body.email,
        ip: req.clientIp
      });

      const resetResult = await this.authService.generatePasswordResetToken(
        req.validatedData.body.email
      );

      if (!resetResult.success) {
        error(res, resetResult.error);
        return;
      }

      // Note: In production, you would send this token via email
      // For security, we don't return the actual token in the response
      logger.auth('Password reset token generated', {
        operation: 'forgotPassword',
        email: req.validatedData.body.email,
        ip: req.clientIp
      });

      success(res, { 
        message: 'If an account with that email exists, a password reset link has been sent.',
        expiresAt: resetResult.data.expires_at
      });
    } catch (err) {
      logger.error('Forgot password error', {
        operation: 'forgotPassword',
        email: req.validatedData?.body?.email,
        ip: req.clientIp
      }, err as Error);

      error(res, 'Password reset request failed', 500);
    }
  };

  /**
   * Reset password using token
   * POST /api/auth/reset-password
   * 
   * @example
   * Request body:
   * {
   *   "token": "reset-token",
   *   "new_password": "NewSecurePass123!",
   *   "confirm_password": "NewSecurePass123!"
   * }
   */
  public resetPassword = async (req: ValidatedRequest, res: Response): Promise<void> => {
    try {
      logger.info('Password reset attempt', {
        operation: 'resetPassword',
        ip: req.clientIp
      });

      // Validate reset token
      const tokenValidation = await this.authService.validatePasswordResetToken(
        req.validatedData.body.token
      );

      if (!tokenValidation.success) {
        error(res, tokenValidation.error);
        return;
      }

      // Reset password
      const resetResult = await this.userService.changePassword(
        tokenValidation.data.user_id,
        {
          currentPassword: '', // Not required for reset
          newPassword: req.validatedData.body.new_password,
          confirm_password: req.validatedData.body.confirm_password
        } as any,
        'system' // System user for password reset
      );

      if (!resetResult.success) {
        error(res, resetResult.error);
        return;
      }

      logger.auth('Password reset successfully', {
        operation: 'resetPassword',
        userId: tokenValidation.data.user_id,
        email: tokenValidation.data.email,
        ip: req.clientIp
      });

      success(res, { message: 'Password reset successfully' });
    } catch (err) {
      logger.error('Password reset error', {
        operation: 'resetPassword',
        ip: req.clientIp
      }, err as Error);

      error(res, 'Password reset failed', 500);
    }
  };
}