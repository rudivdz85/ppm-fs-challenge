import { describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../index';
import { TEST_USERS } from './setup';

describe('Authentication', () => {
  beforeAll(async () => {
    // Ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('POST /api/auth/login', () => {
    test('login with valid credentials returns token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.NATIONAL_ADMIN.email,
          password: TEST_USERS.NATIONAL_ADMIN.password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(TEST_USERS.NATIONAL_ADMIN.email);
      expect(response.body.data.user.password_hash).toBeUndefined();
    });

    test('login with invalid credentials returns 401', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.NATIONAL_ADMIN.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('login with non-existent email returns 401', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('login with invalid email format returns 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('login without password returns 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.NATIONAL_ADMIN.email
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('login without email returns 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    test('authenticated request returns user info', async () => {
      // First login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.SYDNEY_MANAGER.email,
          password: TEST_USERS.SYDNEY_MANAGER.password
        });

      const token = loginResponse.body.data.token;

      // Then get user info
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(TEST_USERS.SYDNEY_MANAGER.email);
      expect(response.body.data.password_hash).toBeUndefined();
      expect(response.body.data.hierarchy_name).toBeDefined();
    });

    test('request without token returns 401', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('request with invalid token returns 401', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('request with malformed authorization header returns 401', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Multiple user login scenarios', () => {
    test('all test users can login successfully', async () => {
      const testUsers = [
        TEST_USERS.NATIONAL_ADMIN,
        TEST_USERS.SYDNEY_MANAGER,
        TEST_USERS.MELBOURNE_MANAGER,
        TEST_USERS.BONDI_STAFF,
        TEST_USERS.TEST_USER
      ];

      for (const user of testUsers) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.password
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
        expect(response.body.data.user.email).toBe(user.email);
      }
    });

    test('tokens are unique for different users', async () => {
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.NATIONAL_ADMIN.email,
          password: TEST_USERS.NATIONAL_ADMIN.password
        });

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.SYDNEY_MANAGER.email,
          password: TEST_USERS.SYDNEY_MANAGER.password
        });

      expect(response1.body.data.token).not.toBe(response2.body.data.token);
    });
  });
});