/**
 * Validation utilities for service layer
 * Provides input validation and business rule validation functions
 */

import { ValidationError } from '../../errors';

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * UUID validation regex - more lenient to accept test UUIDs
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Password complexity requirements
 */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false
};

/**
 * Core validation functions
 */
export class Validator {
  /**
   * Validate required fields are present and not empty
   */
  static validateRequired(data: Record<string, any>, fields: string[]): void {
    for (const field of fields) {
      const value = data[field];
      if (value === undefined || value === null || value === '') {
        throw new ValidationError(`${field} is required`, field);
      }
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string, fieldName: string = 'email'): void {
    if (!email || typeof email !== 'string') {
      throw new ValidationError(`${fieldName} must be a valid string`, fieldName);
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      throw new ValidationError(`${fieldName} must be a valid email address`, fieldName);
    }

    if (email.length > 255) {
      throw new ValidationError(`${fieldName} must be less than 255 characters`, fieldName);
    }
  }

  /**
   * Validate UUID format
   */
  static validateUUID(id: string, fieldName: string = 'id'): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError(`${fieldName} must be a valid UUID string`, fieldName);
    }

    if (!UUID_REGEX.test(id)) {
      throw new ValidationError(`${fieldName} must be a valid UUID format`, fieldName);
    }
  }

  /**
   * Validate string length constraints
   */
  static validateStringLength(
    value: string, 
    fieldName: string, 
    minLength: number = 0, 
    maxLength: number = 255
  ): void {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }

    const trimmed = value.trim();
    
    if (trimmed.length < minLength) {
      throw new ValidationError(
        `${fieldName} must be at least ${minLength} characters long`, 
        fieldName
      );
    }

    if (trimmed.length > maxLength) {
      throw new ValidationError(
        `${fieldName} must be no more than ${maxLength} characters long`, 
        fieldName
      );
    }
  }

  /**
   * Validate password complexity
   */
  static validatePassword(
    password: string, 
    requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
  ): void {
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password must be a valid string', 'password');
    }

    if (password.length < requirements.minLength) {
      throw new ValidationError(
        `Password must be at least ${requirements.minLength} characters long`, 
        'password'
      );
    }

    if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter', 
        'password'
      );
    }

    if (requirements.requireLowercase && !/[a-z]/.test(password)) {
      throw new ValidationError(
        'Password must contain at least one lowercase letter', 
        'password'
      );
    }

    if (requirements.requireNumbers && !/\d/.test(password)) {
      throw new ValidationError(
        'Password must contain at least one number', 
        'password'
      );
    }

    if (requirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new ValidationError(
        'Password must contain at least one special character', 
        'password'
      );
    }
  }

  /**
   * Validate hierarchy code format
   */
  static validateHierarchyCode(code: string): void {
    if (!code || typeof code !== 'string') {
      throw new ValidationError('Hierarchy code must be a valid string', 'code');
    }

    const trimmed = code.trim();
    
    // Must be alphanumeric with underscores/hyphens, no spaces
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      throw new ValidationError(
        'Hierarchy code must contain only letters, numbers, underscores, and hyphens', 
        'code'
      );
    }

    if (trimmed.length < 2 || trimmed.length > 50) {
      throw new ValidationError(
        'Hierarchy code must be between 2 and 50 characters long', 
        'code'
      );
    }

    // Cannot start or end with special characters
    if (/^[_-]|[_-]$/.test(trimmed)) {
      throw new ValidationError(
        'Hierarchy code cannot start or end with underscores or hyphens', 
        'code'
      );
    }
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(limit?: number, offset?: number): void {
    if (limit !== undefined) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new ValidationError('Limit must be an integer between 1 and 1000', 'limit');
      }
    }

    if (offset !== undefined) {
      if (!Number.isInteger(offset) || offset < 0) {
        throw new ValidationError('Offset must be a non-negative integer', 'offset');
      }
    }
  }

  /**
   * Validate search term
   */
  static validateSearchTerm(searchTerm: string): void {
    if (typeof searchTerm !== 'string') {
      throw new ValidationError('Search term must be a string', 'searchTerm');
    }

    const trimmed = searchTerm.trim();
    
    if (trimmed.length < 2) {
      throw new ValidationError('Search term must be at least 2 characters long', 'searchTerm');
    }

    if (trimmed.length > 100) {
      throw new ValidationError('Search term must be no more than 100 characters long', 'searchTerm');
    }

    // Prevent potential injection attacks
    if (/[<>'"\\]/.test(trimmed)) {
      throw new ValidationError('Search term contains invalid characters', 'searchTerm');
    }
  }

  /**
   * Validate hierarchy name
   */
  static validateHierarchyName(name: string): void {
    this.validateStringLength(name, 'name', 2, 255);
    
    // Allow letters, numbers, spaces, and common punctuation
    if (!/^[a-zA-Z0-9\s\-_.,&()]+$/.test(name.trim())) {
      throw new ValidationError(
        'Hierarchy name contains invalid characters', 
        'name'
      );
    }
  }

  /**
   * Validate user name fields
   */
  static validateUserName(firstName: string, lastName: string): void {
    this.validateStringLength(firstName, 'firstName', 1, 100);
    this.validateStringLength(lastName, 'lastName', 1, 100);

    // Allow letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    
    if (!nameRegex.test(firstName.trim())) {
      throw new ValidationError(
        'First name can only contain letters, spaces, hyphens, and apostrophes', 
        'firstName'
      );
    }

    if (!nameRegex.test(lastName.trim())) {
      throw new ValidationError(
        'Last name can only contain letters, spaces, hyphens, and apostrophes', 
        'lastName'
      );
    }
  }

  /**
   * Validate sort direction
   */
  static validateSortDirection(direction?: string): void {
    if (direction && !['ASC', 'DESC', 'asc', 'desc'].includes(direction)) {
      throw new ValidationError('Sort direction must be ASC or DESC', 'sortDirection');
    }
  }

  /**
   * Validate timezone
   */
  static validateTimezone(timezone: string): void {
    if (!timezone || typeof timezone !== 'string') {
      throw new ValidationError('Timezone must be a valid string', 'timezone');
    }

    // Basic timezone validation - in real app, you'd use a timezone library
    if (timezone.length > 100) {
      throw new ValidationError('Timezone string is too long', 'timezone');
    }

    // Common timezone formats
    if (!/^[A-Za-z_\/\-+0-9:]+$/.test(timezone)) {
      throw new ValidationError('Invalid timezone format', 'timezone');
    }
  }
}

/**
 * Business rule validation functions
 */
export class BusinessRuleValidator {
  /**
   * Validate hierarchy level constraints
   */
  static validateHierarchyLevel(level: number, maxLevel: number = 10): void {
    if (!Number.isInteger(level) || level < 0) {
      throw new ValidationError('Hierarchy level must be a non-negative integer', 'level');
    }

    if (level > maxLevel) {
      throw new ValidationError(
        `Hierarchy level cannot exceed ${maxLevel}`, 
        'level'
      );
    }
  }

  /**
   * Validate sort order
   */
  static validateSortOrder(sortOrder: number): void {
    if (!Number.isInteger(sortOrder)) {
      throw new ValidationError('Sort order must be an integer', 'sortOrder');
    }

    if (sortOrder < 0 || sortOrder > 999999) {
      throw new ValidationError('Sort order must be between 0 and 999999', 'sortOrder');
    }
  }

  /**
   * Validate metadata object
   */
  static validateMetadata(metadata: any): void {
    if (metadata === null || metadata === undefined) {
      return; // Allow null/undefined
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new ValidationError('Metadata must be an object', 'metadata');
    }

    // Check for reasonable size limits
    const jsonString = JSON.stringify(metadata);
    if (jsonString.length > 10000) {
      throw new ValidationError('Metadata object is too large (max 10KB)', 'metadata');
    }

    // Validate keys are reasonable
    for (const key of Object.keys(metadata)) {
      if (typeof key !== 'string' || key.length > 100) {
        throw new ValidationError('Metadata keys must be strings under 100 characters', 'metadata');
      }
    }
  }

  /**
   * Validate permission scope constraints
   */
  static validatePermissionScope(
    userHierarchyLevel: number, 
    targetHierarchyLevel: number,
    permissionType: 'read' | 'write' | 'manage'
  ): boolean {
    // Users can only grant permissions at their level or below
    if (targetHierarchyLevel < userHierarchyLevel) {
      throw new ValidationError(
        'Cannot grant permissions at hierarchy levels above your own',
        'targetHierarchy'
      );
    }

    // Additional restrictions based on permission type
    switch (permissionType) {
      case 'manage':
        // Management permissions are more restrictive
        if (targetHierarchyLevel > userHierarchyLevel + 2) {
          throw new ValidationError(
            'Management permissions cannot be granted more than 2 levels below your position',
            'permissionType'
          );
        }
        break;
    }

    return true;
  }

  /**
   * Validate circular reference prevention
   */
  static validateNoCircularReference(nodeId: string, ancestorIds: string[]): void {
    if (ancestorIds.includes(nodeId)) {
      throw new ValidationError(
        'Cannot create circular reference in hierarchy',
        'parentId'
      );
    }
  }
}

/**
 * Sanitization utilities
 */
export class Sanitizer {
  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    return input.trim();
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    return this.sanitizeString(email).toLowerCase();
  }

  /**
   * Sanitize search term
   */
  static sanitizeSearchTerm(searchTerm: string): string {
    return this.sanitizeString(searchTerm)
      .replace(/[<>'"\\]/g, '') // Remove potentially dangerous characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Sanitize hierarchy code
   */
  static sanitizeHierarchyCode(code: string): string {
    return this.sanitizeString(code)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '') // Keep only allowed characters
      .replace(/^[_-]+|[_-]+$/g, ''); // Remove leading/trailing special chars
  }
}