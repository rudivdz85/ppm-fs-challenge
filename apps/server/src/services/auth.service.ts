/**
 * AuthService - Authentication and authorization logic
 * Handles login, token management, and password operations
 */

import { UserRepository } from '../repositories';
import { User } from '../types/temp-types';
import { 
  UnauthorizedError, 
  ValidationError, 
  NotFoundError,
  ServiceResult,
  createSuccessResult,
  handleAsync
} from '../errors';
import { Validator } from './utils/validator';
import { createServiceLogger } from './utils/logger';
import logger from '../utils/logger';
import * as bcrypt from 'bcrypt';
const jwt = require('jsonwebtoken');

/**
 * Login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  expires_at: Date;
  refresh_token?: string;
}

/**
 * Token payload
 */
export interface TokenPayload {
  user_id: string;
  email: string;
  hierarchy_id: string;
  hierarchy_path?: string;
  iat: number;
  exp: number;
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  refresh_token: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  isValid: boolean;
  payload?: TokenPayload;
  error?: string;
}

/**
 * Password validation request
 */
export interface PasswordValidationRequest {
  user_id: string;
  password: string;
}

/**
 * AuthService class
 */
export class AuthService {
  private logger = createServiceLogger('AuthService');
  private readonly BCRYPT_ROUNDS = 12;
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly REFRESH_TOKEN_EXPIRES_IN: string;

  constructor(private userRepo: UserRepository) {
    // Get JWT configuration from environment
    this.JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
    this.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

    // Warn if using default secret in production
    if (this.JWT_SECRET === 'development-secret-key' && process.env.NODE_ENV === 'production') {
      this.logger.warn('Using default JWT secret in production environment');
    }
  }

  /**
   * Authenticate user and return token/session
   */
  async login(request: LoginRequest): Promise<ServiceResult<LoginResponse>> {
    return handleAsync(async () => {
      this.logger.info('User login attempt', {
        operation: 'login',
        email: request.email
      });

      // Validate input
      this.validateLoginRequest(request);

      // Sanitize email
      const email = request.email.toLowerCase().trim();

      // Find user by email
      const user = await this.userRepo.findByEmail(email, false);
      if (!user) {
        logger.warn('Failed login attempt - user not found', { email });
        this.logger.warn('Login failed - user not found', {
          operation: 'login',
          email
        });
        throw new UnauthorizedError('Invalid email or password');
      }

      // Check if user is active
      if (!user.is_active) {
        this.logger.warn('Login failed - user inactive', {
          operation: 'login',
          email,
          userId: user.id
        });
        throw new UnauthorizedError('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await this.comparePassword(request.password, user.password_hash || '');
      if (!isPasswordValid) {
        logger.warn('Failed login attempt - invalid password', { email, userId: user.id });
        this.logger.warn('Login failed - invalid password', {
          operation: 'login',
          email,
          userId: user.id
        });
        throw new UnauthorizedError('Invalid email or password');
      }

      // Get user with hierarchy information
      const userWithHierarchy = await this.userRepo.findById(user.id, true);
      if (!userWithHierarchy) {
        throw new NotFoundError('User', user.id);
      }

      // Generate tokens
      const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
        user_id: user.id,
        email: user.email,
        hierarchy_id: user.base_hierarchy_id,
        hierarchy_path: userWithHierarchy.hierarchy_path
      };

      const token = this.generateAccessToken(tokenPayload);
      const refreshToken = this.generateRefreshToken(tokenPayload);

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + this.parseJwtExpiration(this.JWT_EXPIRES_IN));

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = userWithHierarchy;

      const loginResponse: LoginResponse = {
        user: userResponse as User,
        token,
        expires_at: expiresAt,
        refresh_token: refreshToken
      };

      logger.info('User logged in successfully', { email: user.email, userId: user.id });
      this.logger.auth('User logged in successfully', {
        operation: 'login',
        userId: user.id,
        email: user.email,
        hierarchy_id: user.base_hierarchy_id
      });

      return loginResponse;
    });
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(request: RefreshTokenRequest): Promise<ServiceResult<LoginResponse>> {
    return handleAsync(async () => {
      this.logger.info('Token refresh attempt', {
        operation: 'refreshToken'
      });

      // Validate and decode refresh token
      const validation = this.validateToken(request.refresh_token);
      if (!validation.isValid || !validation.payload) {
        this.logger.warn('Token refresh failed - invalid token', {
          operation: 'refreshToken',
          error: validation.error
        });
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Get current user data
      const user = await this.userRepo.findById(validation.payload.user_id, true);
      if (!user || !user.is_active) {
        this.logger.warn('Token refresh failed - user not found or inactive', {
          operation: 'refreshToken',
          userId: validation.payload.user_id
        });
        throw new UnauthorizedError('User not found or inactive');
      }

      // Generate new tokens
      const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
        user_id: user.id,
        email: user.email,
        hierarchy_id: user.base_hierarchy_id,
        hierarchy_path: user.hierarchy_path
      };

      const newToken = this.generateAccessToken(tokenPayload);
      const newRefreshToken = this.generateRefreshToken(tokenPayload);

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + this.parseJwtExpiration(this.JWT_EXPIRES_IN));

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = user;

      const refreshResponse: LoginResponse = {
        user: userResponse as User,
        token: newToken,
        expires_at: expiresAt,
        refresh_token: newRefreshToken
      };

      this.logger.auth('Token refreshed successfully', {
        operation: 'refreshToken',
        userId: user.id
      });

      return refreshResponse;
    });
  }

  /**
   * Validate JWT token
   */
  validateToken(token: string): TokenValidationResult {
    try {
      if (!token) {
        return {
          isValid: false,
          error: 'Token is required'
        };
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace(/^Bearer\s+/, '');

      const decoded = jwt.verify(cleanToken, this.JWT_SECRET) as TokenPayload;
      
      return {
        isValid: true,
        payload: decoded
      };
    } catch (error: any) {
      let errorMessage = 'Invalid token';
      
      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Malformed token';
      } else if (error.name === 'NotBeforeError') {
        errorMessage = 'Token not active yet';
      }

      this.logger.debug('Token validation failed', {
        operation: 'validateToken',
        error: errorMessage
      });

      return {
        isValid: false,
        error: errorMessage
      };
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required');
    }

    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(plaintext: string, hash: string): Promise<boolean> {
    if (!plaintext || !hash) {
      return false;
    }

    try {
      return await bcrypt.compare(plaintext, hash);
    } catch (error) {
      this.logger.error('Password comparison failed', {
        operation: 'comparePassword'
      }, error as Error);
      return false;
    }
  }

  /**
   * Verify user password (for password change operations)
   */
  async verifyUserPassword(request: PasswordValidationRequest): Promise<ServiceResult<{ isValid: boolean }>> {
    return handleAsync(async () => {
      Validator.validateUUID(request.user_id);
      
      if (!request.password) {
        throw new ValidationError('Password is required');
      }

      const user = await this.userRepo.findById(request.user_id, false);
      if (!user) {
        throw new NotFoundError('User', request.user_id);
      }

      const isValid = await this.comparePassword(request.password, user.password_hash || '');

      this.logger.auth('Password verification', {
        operation: 'verifyUserPassword',
        userId: request.user_id,
        isValid
      });

      return { isValid };
    });
  }

  /**
   * Generate password reset token (placeholder for future implementation)
   */
  async generatePasswordResetToken(email: string): Promise<ServiceResult<{ token: string; expires_at: Date }>> {
    return handleAsync(async () => {
      Validator.validateEmail(email);

      const user = await this.userRepo.findByEmail(email.toLowerCase().trim());
      if (!user) {
        // Don't reveal whether email exists or not
        this.logger.warn('Password reset requested for non-existent email', {
          operation: 'generatePasswordResetToken',
          email
        });
      }

      // Generate a secure reset token
      const resetPayload = {
        user_id: user?.id || 'unknown',
        email: email.toLowerCase().trim(),
        type: 'password_reset',
        iat: Math.floor(Date.now() / 1000)
      };

      const resetToken = jwt.sign(resetPayload, this.JWT_SECRET, { 
        expiresIn: '1h' // Reset tokens expire in 1 hour
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      this.logger.auth('Password reset token generated', {
        operation: 'generatePasswordResetToken',
        email,
        userId: user?.id
      });

      return {
        token: resetToken,
        expires_at: expiresAt
      };
    });
  }

  /**
   * Validate password reset token (placeholder for future implementation)
   */
  async validatePasswordResetToken(token: string): Promise<ServiceResult<{ user_id: string; email: string }>> {
    return handleAsync(async () => {
      try {
        const decoded = jwt.verify(token, this.JWT_SECRET) as any;
        
        if (decoded.type !== 'password_reset') {
          throw new ValidationError('Invalid token type');
        }

        return {
          user_id: decoded.user_id,
          email: decoded.email
        };
      } catch (error) {
        this.logger.warn('Invalid password reset token', {
          operation: 'validatePasswordResetToken'
        });
        throw new UnauthorizedError('Invalid or expired reset token');
      }
    });
  }

  /**
   * Get current user from token
   */
  async getCurrentUser(token: string): Promise<ServiceResult<User>> {
    return handleAsync(async () => {
      const validation = this.validateToken(token);
      if (!validation.isValid || !validation.payload) {
        throw new UnauthorizedError(validation.error || 'Invalid token');
      }

      const user = await this.userRepo.findById(validation.payload.user_id, true);
      if (!user || !user.is_active) {
        throw new UnauthorizedError('User not found or inactive');
      }

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = user;
      return userResponse as User;
    });
  }

  // Private helper methods

  private validateLoginRequest(request: LoginRequest): void {
    Validator.validateRequired(request, ['email', 'password']);
    Validator.validateEmail(request.email);
    
    if (!request.password || request.password.length < 1) {
      throw new ValidationError('Password is required', 'password');
    }
  }

  private generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    });
  }

  private generateRefreshToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    const refreshPayload = {
      ...payload,
      type: 'refresh'
    };

    return jwt.sign(refreshPayload, this.JWT_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN
    });
  }

  private parseJwtExpiration(expiration: string): number {
    // Simple parser for common JWT expiration formats
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      // Default to 7 days if can't parse
      return 7 * 24 * 60 * 60 * 1000;
    }

    const [, amount, unit] = match;
    const num = parseInt(amount);

    switch (unit) {
      case 's':
        return num * 1000;
      case 'm':
        return num * 60 * 1000;
      case 'h':
        return num * 60 * 60 * 1000;
      case 'd':
        return num * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Extract user ID from token without full validation (for logging purposes)
   */
  extractUserIdFromToken(token: string): string | null {
    try {
      const cleanToken = token.replace(/^Bearer\s+/, '');
      const decoded = jwt.decode(cleanToken) as TokenPayload;
      return decoded?.user_id || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired without throwing
   */
  isTokenExpired(token: string): boolean {
    try {
      const cleanToken = token.replace(/^Bearer\s+/, '');
      const decoded = jwt.decode(cleanToken) as TokenPayload;
      
      if (!decoded || !decoded.exp) {
        return true;
      }

      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }
}