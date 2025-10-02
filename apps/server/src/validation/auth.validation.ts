/**
 * Authentication validation schemas
 * Validates login and registration requests
 */

import { z } from 'zod';

/**
 * Password requirements schema
 * Must contain: uppercase, lowercase, number, special character
 * Length: 8-72 characters
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(72, 'Password cannot exceed 72 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Email validation schema
 * Must be valid email format and lowercase
 */
const emailSchema = z
  .string()
  .email('Must be a valid email address')
  .max(254, 'Email cannot exceed 254 characters')
  .transform(email => email.toLowerCase().trim());

/**
 * Full name validation schema
 * Supports alphanumeric characters, spaces, hyphens, apostrophes
 */
const fullNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters long')
  .max(100, 'Name cannot exceed 100 characters')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .transform(name => name.trim());

/**
 * UUID validation schema
 */
const uuidSchema = z
  .string()
  .uuid('Must be a valid UUID');

/**
 * Login request validation schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Password is required')
    .max(72, 'Password cannot exceed 72 characters')
});

/**
 * User registration validation schema
 */
export const registerSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  base_hierarchy_id: uuidSchema,
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Must be a valid phone number')
    .optional(),
  metadata: z
    .record(z.any())
    .optional()
});

/**
 * Refresh token request validation schema
 */
export const refreshTokenSchema = z.object({
  refresh_token: z
    .string()
    .min(1, 'Refresh token is required')
});

/**
 * Password change request validation schema
 */
export const changePasswordSchema = z.object({
  current_password: z
    .string()
    .min(1, 'Current password is required'),
  new_password: passwordSchema,
  confirm_password: z
    .string()
    .min(1, 'Password confirmation is required')
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password']
});

/**
 * Password reset request validation schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema
});

/**
 * Password reset confirmation validation schema
 */
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(1, 'Reset token is required'),
  new_password: passwordSchema,
  confirm_password: z
    .string()
    .min(1, 'Password confirmation is required')
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password']
});

/**
 * Password validation request schema (for verification)
 */
export const verifyPasswordSchema = z.object({
  password: z
    .string()
    .min(1, 'Password is required')
});

/**
 * User ID parameter validation schema
 */
export const userIdParamSchema = z.object({
  userId: uuidSchema
});

/**
 * Token validation schema
 */
export const tokenSchema = z.object({
  token: z
    .string()
    .min(1, 'Token is required')
});

/**
 * TypeScript types inferred from schemas
 */
export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type VerifyPasswordRequest = z.infer<typeof verifyPasswordSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type TokenRequest = z.infer<typeof tokenSchema>;

/**
 * Authentication validation error messages
 */
export const authValidationMessages = {
  email: {
    required: 'Email address is required',
    invalid: 'Please enter a valid email address',
    format: 'Email address format is invalid'
  },
  password: {
    required: 'Password is required',
    minLength: 'Password must be at least 8 characters long',
    maxLength: 'Password cannot exceed 72 characters',
    uppercase: 'Password must contain at least one uppercase letter',
    lowercase: 'Password must contain at least one lowercase letter',
    number: 'Password must contain at least one number',
    special: 'Password must contain at least one special character',
    mismatch: 'Passwords do not match'
  },
  name: {
    required: 'Full name is required',
    minLength: 'Name must be at least 2 characters long',
    maxLength: 'Name cannot exceed 100 characters',
    format: 'Name can only contain letters, spaces, hyphens, and apostrophes'
  },
  structureId: {
    required: 'Structure ID is required',
    invalid: 'Structure ID must be a valid UUID'
  },
  token: {
    required: 'Token is required',
    invalid: 'Token format is invalid'
  }
};

/**
 * Common validation utilities for authentication
 */
export const authValidationUtils = {
  /**
   * Check if password meets complexity requirements
   */
  isPasswordValid: (password: string): boolean => {
    try {
      passwordSchema.parse(password);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check if email is valid format
   */
  isEmailValid: (email: string): boolean => {
    try {
      emailSchema.parse(email);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Sanitize email input
   */
  sanitizeEmail: (email: string): string => {
    return email.toLowerCase().trim();
  },

  /**
   * Sanitize name input
   */
  sanitizeName: (name: string): string => {
    return name.trim().replace(/\s+/g, ' ');
  },

  /**
   * Generate password strength score (0-100)
   */
  getPasswordStrength: (password: string): number => {
    let score = 0;
    
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (/[A-Z]/.test(password)) score += 20;
    if (/[a-z]/.test(password)) score += 20;
    if (/[0-9]/.test(password)) score += 20;
    if (/[^A-Za-z0-9]/.test(password)) score += 20;
    if (password.length >= 16) score += 10;
    
    return Math.min(score, 100);
  },

  /**
   * Get password validation errors
   */
  getPasswordErrors: (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push(authValidationMessages.password.minLength);
    }
    if (password.length > 72) {
      errors.push(authValidationMessages.password.maxLength);
    }
    if (!/[A-Z]/.test(password)) {
      errors.push(authValidationMessages.password.uppercase);
    }
    if (!/[a-z]/.test(password)) {
      errors.push(authValidationMessages.password.lowercase);
    }
    if (!/[0-9]/.test(password)) {
      errors.push(authValidationMessages.password.number);
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push(authValidationMessages.password.special);
    }
    
    return errors;
  }
};