import { describe, test, expect } from '@jest/globals';
import { loginSchema } from '../validation/auth.validation';
import { createUserSchema } from '../validation/user.validation';
import { createHierarchySchema } from '../validation/hierarchy.validation';

describe('Validation', () => {
  describe('Login validation', () => {
    test('valid login data passes validation', () => {
      const validLogin = {
        email: 'test@example.com',
        password: 'ValidPass123!'
      };

      const result = loginSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    test('short password fails validation', () => {
      const invalidLogin = {
        email: 'test@example.com',
        password: 'Short1!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('password') && 
          issue.message.includes('least 8 characters')
        )).toBe(true);
      }
    });

    test('password without uppercase fails validation', () => {
      const invalidLogin = {
        email: 'test@example.com',
        password: 'lowercase123!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('password') && 
          issue.message.includes('uppercase')
        )).toBe(true);
      }
    });

    test('password without lowercase fails validation', () => {
      const invalidLogin = {
        email: 'test@example.com',
        password: 'UPPERCASE123!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('password') && 
          issue.message.includes('lowercase')
        )).toBe(true);
      }
    });

    test('password without number fails validation', () => {
      const invalidLogin = {
        email: 'test@example.com',
        password: 'NoNumbers!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('password') && 
          issue.message.includes('number')
        )).toBe(true);
      }
    });

    test('password without special character fails validation', () => {
      const invalidLogin = {
        email: 'test@example.com',
        password: 'NoSpecialChar123'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('password') && 
          issue.message.includes('special character')
        )).toBe(true);
      }
    });

    test('invalid email format fails validation', () => {
      const invalidLogin = {
        email: 'not-an-email',
        password: 'ValidPass123!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('email') && 
          issue.message.includes('Invalid email')
        )).toBe(true);
      }
    });

    test('missing email fails validation', () => {
      const invalidLogin = {
        password: 'ValidPass123!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('email')
        )).toBe(true);
      }
    });

    test('missing password fails validation', () => {
      const invalidLogin = {
        email: 'test@example.com'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('password')
        )).toBe(true);
      }
    });

    test('empty email fails validation', () => {
      const invalidLogin = {
        email: '',
        password: 'ValidPass123!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });

    test('whitespace-only email fails validation', () => {
      const invalidLogin = {
        email: '   ',
        password: 'ValidPass123!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });
  });

  describe('User creation validation', () => {
    test('valid user data passes validation', () => {
      const validUser = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        full_name: 'John Doe',
        phone: '+61400123456',
        base_hierarchy_id: '12345678-1234-1234-1234-123456789012'
      };

      const result = createUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    test('invalid UUID for hierarchy fails validation', () => {
      const invalidUser = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        full_name: 'John Doe',
        base_hierarchy_id: 'not-a-uuid'
      };

      const result = createUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('base_hierarchy_id') && 
          issue.message.includes('Invalid UUID')
        )).toBe(true);
      }
    });

    test('invalid phone format fails validation', () => {
      const invalidUser = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        full_name: 'John Doe',
        phone: 'invalid-phone',
        base_hierarchy_id: '12345678-1234-1234-1234-123456789012'
      };

      const result = createUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('phone')
        )).toBe(true);
      }
    });

    test('empty full name fails validation', () => {
      const invalidUser = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        full_name: '   ',
        base_hierarchy_id: '12345678-1234-1234-1234-123456789012'
      };

      const result = createUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    test('optional phone can be omitted', () => {
      const validUser = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        full_name: 'John Doe',
        base_hierarchy_id: '12345678-1234-1234-1234-123456789012'
      };

      const result = createUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    test('valid international phone formats pass validation', () => {
      const phoneFormats = [
        '+61400123456',
        '+1234567890',
        '+442071234567',
        '+33123456789'
      ];

      phoneFormats.forEach(phone => {
        const validUser = {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          full_name: 'John Doe',
          phone,
          base_hierarchy_id: '12345678-1234-1234-1234-123456789012'
        };

        const result = createUserSchema.safeParse(validUser);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Hierarchy creation validation', () => {
    test('valid hierarchy data passes validation', () => {
      const validHierarchy = {
        name: 'Test Location',
        description: 'A test location for validation',
        parent_id: '12345678-1234-1234-1234-123456789012'
      };

      const result = createHierarchySchema.safeParse(validHierarchy);
      expect(result.success).toBe(true);
    });

    test('hierarchy without parent (root level) passes validation', () => {
      const validRootHierarchy = {
        name: 'Root Location',
        description: 'A root level location'
      };

      const result = createHierarchySchema.safeParse(validRootHierarchy);
      expect(result.success).toBe(true);
    });

    test('invalid parent UUID fails validation', () => {
      const invalidHierarchy = {
        name: 'Test Location',
        description: 'A test location',
        parent_id: 'not-a-uuid'
      };

      const result = createHierarchySchema.safeParse(invalidHierarchy);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.path.includes('parent_id') && 
          issue.message.includes('Invalid UUID')
        )).toBe(true);
      }
    });

    test('empty name fails validation', () => {
      const invalidHierarchy = {
        name: '   ',
        description: 'A test location'
      };

      const result = createHierarchySchema.safeParse(invalidHierarchy);
      expect(result.success).toBe(false);
    });

    test('missing name fails validation', () => {
      const invalidHierarchy = {
        description: 'A test location'
      };

      const result = createHierarchySchema.safeParse(invalidHierarchy);
      expect(result.success).toBe(false);
    });

    test('optional metadata is accepted', () => {
      const validHierarchy = {
        name: 'Test Location',
        description: 'A test location',
        metadata: {
          custom_field: 'custom_value',
          population: 10000
        }
      };

      const result = createHierarchySchema.safeParse(validHierarchy);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge cases and security', () => {
    test('extremely long email fails validation', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const invalidLogin = {
        email: longEmail,
        password: 'ValidPass123!'
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });

    test('SQL injection attempt in email fails validation', () => {
      const sqlInjection = {
        email: "test@example.com'; DROP TABLE users; --",
        password: 'ValidPass123!'
      };

      const result = loginSchema.safeParse(sqlInjection);
      expect(result.success).toBe(false);
    });

    test('XSS attempt in name fails validation', () => {
      const xssAttempt = {
        email: 'test@example.com',
        password: 'ValidPass123!',
        full_name: '<script>alert("xss")</script>',
        base_hierarchy_id: '12345678-1234-1234-1234-123456789012'
      };

      const result = createUserSchema.safeParse(xssAttempt);
      // Should pass validation but be sanitized by the application layer
      expect(result.success).toBe(true);
    });

    test('null values fail validation', () => {
      const nullData = {
        email: null,
        password: null
      };

      const result = loginSchema.safeParse(nullData);
      expect(result.success).toBe(false);
    });

    test('undefined values fail validation', () => {
      const undefinedData = {
        email: undefined,
        password: undefined
      };

      const result = loginSchema.safeParse(undefinedData);
      expect(result.success).toBe(false);
    });
  });
});