import { describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../index';
import { getAuthToken, TEST_USERS } from './setup';

describe('Permission Queries', () => {
  let nationalAdminToken: string;
  let sydneyManagerToken: string;
  let melbourneManagerToken: string;
  let bondiStaffToken: string;
  let testUserToken: string;

  beforeAll(async () => {
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get auth tokens for all test users
    nationalAdminToken = await getAuthToken(
      TEST_USERS.NATIONAL_ADMIN.email,
      TEST_USERS.NATIONAL_ADMIN.password
    );

    sydneyManagerToken = await getAuthToken(
      TEST_USERS.SYDNEY_MANAGER.email,
      TEST_USERS.SYDNEY_MANAGER.password
    );

    melbourneManagerToken = await getAuthToken(
      TEST_USERS.MELBOURNE_MANAGER.email,
      TEST_USERS.MELBOURNE_MANAGER.password
    );

    bondiStaffToken = await getAuthToken(
      TEST_USERS.BONDI_STAFF.email,
      TEST_USERS.BONDI_STAFF.password
    );

    testUserToken = await getAuthToken(
      TEST_USERS.TEST_USER.email,
      TEST_USERS.TEST_USER.password
    );
  });

  describe('GET /api/query/users', () => {
    test('national admin can query all users', async () => {
      const response = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${nationalAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(5); // Should see all users
      
      // Check that users from different hierarchies are included
      const emails = response.body.data.items.map((user: any) => user.email);
      expect(emails).toContain(TEST_USERS.SYDNEY_MANAGER.email);
      expect(emails).toContain(TEST_USERS.MELBOURNE_MANAGER.email);
      expect(emails).toContain(TEST_USERS.BONDI_STAFF.email);
    });

    test('sydney manager can query sydney and suburb users', async () => {
      const response = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${sydneyManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      
      const emails = response.body.data.items.map((user: any) => user.email);
      const hierarchyNames = response.body.data.items.map((user: any) => user.hierarchy_name);
      
      // Should include Sydney and its suburbs
      expect(emails).toContain(TEST_USERS.BONDI_STAFF.email); // Bondi is under Sydney
      
      // Should include Sydney-related hierarchies
      expect(hierarchyNames.some((name: string) => name.includes('Sydney') || name.includes('Bondi') || name.includes('Manly') || name.includes('Parramatta'))).toBe(true);
      
      // Should NOT include Melbourne users (different city)
      expect(emails).not.toContain(TEST_USERS.MELBOURNE_MANAGER.email);
    });

    test('melbourne manager can query melbourne and suburb users', async () => {
      const response = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${melbourneManagerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      
      const emails = response.body.data.items.map((user: any) => user.email);
      const hierarchyNames = response.body.data.items.map((user: any) => user.hierarchy_name);
      
      // Should include Melbourne-related hierarchies
      expect(hierarchyNames.some((name: string) => name.includes('Melbourne') || name.includes('St Kilda') || name.includes('Richmond'))).toBe(true);
      
      // Should NOT include Sydney users
      expect(emails).not.toContain(TEST_USERS.SYDNEY_MANAGER.email);
      expect(emails).not.toContain(TEST_USERS.BONDI_STAFF.email);
    });

    test('suburb user can only query their own suburb users', async () => {
      const response = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${bondiStaffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      
      const hierarchyNames = response.body.data.items.map((user: any) => user.hierarchy_name);
      
      // Should only see users from Bondi
      const allBondiUsers = hierarchyNames.every((name: string) => name === 'Bondi');
      expect(allBondiUsers).toBe(true);
      
      // Should be limited number of users
      expect(response.body.data.items.length).toBeLessThan(5);
    });

    test('test user with mixed permissions can query appropriately', async () => {
      const response = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      
      // Test user has specific permissions as defined in seed data
      // Should be able to access based on those permissions
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    test('unauthenticated request returns 401', async () => {
      const response = await request(app)
        .get('/api/query/users');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('invalid token returns 401', async () => {
      const response = await request(app)
        .get('/api/query/users')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Permission scope validation', () => {
    test('users cannot access hierarchies above their permission level', async () => {
      const bondiResponse = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${bondiStaffToken}`);

      const sydneyResponse = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${sydneyManagerToken}`);

      // Bondi staff should see fewer users than Sydney manager
      expect(bondiResponse.body.data.items.length).toBeLessThan(sydneyResponse.body.data.items.length);
    });

    test('inheritance permissions work correctly', async () => {
      // National admin should see more users than city managers
      const nationalResponse = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${nationalAdminToken}`);

      const sydneyResponse = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${sydneyManagerToken}`);

      expect(nationalResponse.body.data.items.length).toBeGreaterThan(sydneyResponse.body.data.items.length);
    });

    test('cross-city permissions are properly isolated', async () => {
      const sydneyResponse = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${sydneyManagerToken}`);

      const melbourneResponse = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${melbourneManagerToken}`);

      const sydneyEmails = sydneyResponse.body.data.items.map((user: any) => user.email);
      const melbourneEmails = melbourneResponse.body.data.items.map((user: any) => user.email);

      // No overlap between Sydney and Melbourne users
      const overlap = sydneyEmails.filter((email: string) => melbourneEmails.includes(email));
      expect(overlap.length).toBe(0);
    });
  });

  describe('Query filters and pagination', () => {
    test('pagination parameters work correctly', async () => {
      const page1Response = await request(app)
        .get('/api/query/users?page=1&limit=2')
        .set('Authorization', `Bearer ${nationalAdminToken}`);

      expect(page1Response.status).toBe(200);
      expect(page1Response.body.data.items.length).toBeLessThanOrEqual(2);
      expect(page1Response.body.data.page).toBe(1);
      expect(page1Response.body.data.limit).toBe(2);
    });

    test('search filter works', async () => {
      const searchResponse = await request(app)
        .get('/api/query/users?search=Sydney')
        .set('Authorization', `Bearer ${nationalAdminToken}`);

      expect(searchResponse.status).toBe(200);
      
      if (searchResponse.body.data.items.length > 0) {
        const results = searchResponse.body.data.items;
        const hasSearchTerm = results.some((user: any) => 
          user.full_name.includes('Sydney') || 
          user.email.includes('sydney') ||
          user.hierarchy_name.includes('Sydney')
        );
        expect(hasSearchTerm).toBe(true);
      }
    });

    test('hierarchy filter works', async () => {
      // First get a hierarchy ID from a user query
      const usersResponse = await request(app)
        .get('/api/query/users')
        .set('Authorization', `Bearer ${sydneyManagerToken}`);

      if (usersResponse.body.data.items.length > 0) {
        const hierarchyId = usersResponse.body.data.items[0].base_hierarchy_id;
        
        const filteredResponse = await request(app)
          .get(`/api/query/users?hierarchy_id=${hierarchyId}`)
          .set('Authorization', `Bearer ${sydneyManagerToken}`);

        expect(filteredResponse.status).toBe(200);
        
        // All results should have the same hierarchy ID
        if (filteredResponse.body.data.items.length > 0) {
          const allSameHierarchy = filteredResponse.body.data.items.every((user: any) => 
            user.base_hierarchy_id === hierarchyId
          );
          expect(allSameHierarchy).toBe(true);
        }
      }
    });
  });
});