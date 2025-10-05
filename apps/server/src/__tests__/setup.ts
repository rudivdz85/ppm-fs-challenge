import { beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../index';
import { db } from '../database/connection';

// Test database URL - should use separate test database
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

beforeAll(async () => {
  // Ensure we're using test database
  if (!TEST_DATABASE_URL?.includes('test')) {
    console.warn('⚠️  Warning: Using non-test database for testing!');
  }
  
  // Test database connection
  try {
    const connected = await db.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to test database');
    }
  } catch (error) {
    console.error('Test database setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  // Close database connections
  await db.close();
});

/**
 * Helper function to get authentication token for testing
 */
export async function getAuthToken(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
    
  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status} - ${response.body?.error?.message}`);
  }
  
  return response.body.data.token;
}

/**
 * Helper function to clear test data (if needed)
 */
export async function clearTestData(): Promise<void> {
  // Only allow clearing in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearTestData can only be used in test environment');
  }
  
  // This would clear test data - implement if needed
  // For now, we rely on seeded test data
}

/**
 * Test user credentials from seed data
 */
export const TEST_USERS = {
  NATIONAL_ADMIN: {
    email: 'admin@australia.gov.au',
    password: 'SecurePass123!'
  },
  SYDNEY_MANAGER: {
    email: 'manager@sydney.nsw.gov.au', 
    password: 'SydneyManager2024!'
  },
  MELBOURNE_MANAGER: {
    email: 'manager@melbourne.vic.gov.au',
    password: 'MelbManager2024!'
  },
  BONDI_STAFF: {
    email: 'staff@bondi.nsw.gov.au',
    password: 'BondiStaff2024!'
  },
  TEST_USER: {
    email: 'test@example.com',
    password: 'TestUser2024!'
  }
};