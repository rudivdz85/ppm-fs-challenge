/**
 * JWT utilities for token generation and verification
 * Handles JWT creation, validation, and user payload extraction
 */

const jwt = require('jsonwebtoken');
import { TokenPayload } from '../types/temp-types';

/**
 * JWT configuration interface
 */
interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

/**
 * Get JWT configuration from environment variables
 */
function getJWTConfig(): JWTConfig {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  };
}

/**
 * User payload for JWT token
 */
export interface JWTUserPayload {
  user_id: string;
  email: string;
  hierarchy_id: string;
  hierarchy_path?: string;
}

/**
 * Token generation result
 */
export interface TokenResult {
  token: string;
  expiresAt: Date;
}

/**
 * Token verification result
 */
export interface TokenVerificationResult {
  success: boolean;
  payload?: TokenPayload;
  error?: string;
}

/**
 * Generate JWT access token
 */
export function generateToken(payload: JWTUserPayload): TokenResult {
  try {
    const config = getJWTConfig();
    
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
      user_id: payload.user_id,
      email: payload.email,
      hierarchy_id: payload.hierarchy_id,
      hierarchy_path: payload.hierarchy_path
    };

    const token = jwt.sign(tokenPayload, config.secret, {
      expiresIn: config.expiresIn,
      issuer: 'ppm-server',
      audience: 'ppm-client'
    });

    // Calculate expiration date
    const expiresAt = new Date();
    const expirationMs = parseExpirationToMs(config.expiresIn);
    expiresAt.setTime(expiresAt.getTime() + expirationMs);

    return {
      token,
      expiresAt
    };
  } catch (error) {
    throw new Error(`Failed to generate token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(payload: JWTUserPayload): TokenResult {
  try {
    const config = getJWTConfig();
    
    const refreshPayload = {
      ...payload,
      type: 'refresh'
    };

    const token = jwt.sign(refreshPayload, config.secret, {
      expiresIn: config.refreshExpiresIn,
      issuer: 'ppm-server',
      audience: 'ppm-client'
    });

    // Calculate expiration date
    const expiresAt = new Date();
    const expirationMs = parseExpirationToMs(config.refreshExpiresIn);
    expiresAt.setTime(expiresAt.getTime() + expirationMs);

    return {
      token,
      expiresAt
    };
  } catch (error) {
    throw new Error(`Failed to generate refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenVerificationResult {
  try {
    const config = getJWTConfig();
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/, '');
    
    const decoded = jwt.verify(cleanToken, config.secret, {
      issuer: 'ppm-server',
      audience: 'ppm-client'
    }) as TokenPayload;

    return {
      success: true,
      payload: decoded
    };
  } catch (error) {
    let errorMessage = 'Invalid token';
    
    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token has expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Token is malformed';
    } else if (error instanceof jwt.NotBeforeError) {
      errorMessage = 'Token is not active yet';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Decode token without verification (for logging/debugging)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const cleanToken = token.replace(/^Bearer\s+/, '');
    const decoded = jwt.decode(cleanToken) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired without throwing
 */
export function isTokenExpired(token: string): boolean {
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

/**
 * Extract user ID from token without full verification
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    const decoded = decodeToken(token);
    return decoded?.user_id || null;
  } catch {
    return null;
  }
}

/**
 * Generate token pair (access + refresh)
 */
export function generateTokenPair(payload: JWTUserPayload): {
  accessToken: TokenResult;
  refreshToken: TokenResult;
} {
  return {
    accessToken: generateToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
}

/**
 * Validate token format without verification
 */
export function isValidTokenFormat(token: string): boolean {
  const cleanToken = token.replace(/^Bearer\s+/, '');
  
  // JWT should have 3 parts separated by dots
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    return false;
  }

  // Each part should be valid base64
  try {
    parts.forEach(part => {
      if (!part) throw new Error('Empty part');
      Buffer.from(part, 'base64');
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse expiration string to milliseconds
 */
function parseExpirationToMs(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/);
  if (!match) {
    // Default to 24 hours if can't parse
    return 24 * 60 * 60 * 1000;
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
      return 24 * 60 * 60 * 1000;
  }
}

/**
 * Validate JWT configuration
 */
export function validateJWTConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET environment variable is required');
  } else if (process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters long');
  }

  if (process.env.JWT_SECRET === 'development-secret-key' && process.env.NODE_ENV === 'production') {
    errors.push('Using default JWT secret in production is not secure');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * JWT utility class for organized access
 */
export class JWTUtils {
  static generate = generateToken;
  static generateRefresh = generateRefreshToken;
  static generatePair = generateTokenPair;
  static verify = verifyToken;
  static decode = decodeToken;
  static isExpired = isTokenExpired;
  static extractUserId = extractUserIdFromToken;
  static isValidFormat = isValidTokenFormat;
  static validateConfig = validateJWTConfig;
}