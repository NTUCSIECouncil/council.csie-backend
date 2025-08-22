import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import z from 'zod';

import app from './app.ts';
import {
  ZPrivateUserResponseSchema,
  ZUserResponseSchema,
} from './response-schemas.ts';
import {
  expectValidErrorResponse,
  getTestUser,
  parseAndExpectValid,
  seedModelFromSamples,
} from './utils.ts';

const ZUserCreateResponse = z.object({ userId: z.string() });

const ZUserResponse = z.object({ user: ZUserResponseSchema });

const ZPrivateUserResponse = z.object({ user: ZPrivateUserResponseSchema });

const genUserCreate = () => {
  return { nickname: 'Test User' };
};

beforeEach(async () => {
  await seedModelFromSamples('User');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('POST /api/users', () => {
  describe('User creation', () => {
    it('should create user successfully and return userId', async () => {
      const userData = genUserCreate();

      const res = await request(app)
        .post('/api/users')
        .set('gid', 'GID_NEW_USER')
        .send(userData)
        .expect(201);

      parseAndExpectValid(ZUserCreateResponse, res.body);
    });

    it('should handle Unicode content correctly', async () => {
      const userData = { nickname: '測試用戶 🚀' };

      const res = await request(app)
        .post('/api/users')
        .set('gid', 'GID_UNICODE_USER')
        .send(userData)
        .expect(201);

      parseAndExpectValid(ZUserCreateResponse, res.body);
    });
  });

  describe('Input validation', () => {
    it('should validate all required fields are present', async () => {
      // Missing nickname
      const res = await request(app)
        .post('/api/users')
        .set('gid', 'GID_MISSING_FIELDS')
        .send({})
        .expect(400);

      expectValidErrorResponse(res.body);
    });

    it('should validate field data types', async () => {
      // Invalid nickname type
      const res = await request(app)
        .post('/api/users')
        .set('gid', 'GID_INVALID_TYPE')
        .send({ nickname: 123 })
        .expect(400);

      expectValidErrorResponse(res.body);
    });
  });

  describe('Authentication', () => {
    it('should require valid authentication', async () => {
      const userData = genUserCreate();

      // No auth header
      const res1 = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(401);
      expectValidErrorResponse(res1.body);
    });
  });

  describe('Conflict handling', () => {
    it('should return 409 if user already exists', async () => {
      const testUser = await getTestUser();
      const userData = genUserCreate();

      // Try to create user with existing gid
      const res = await request(app)
        .post('/api/users')
        .set('gid', testUser.gid)
        .send(userData)
        .expect(409);

      expectValidErrorResponse(res.body);
    });
  });
});

describe('GET /api/users/:userId', () => {
  describe('User retrieval', () => {
    it('should return user with correct response structure', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, res.body);
      expect(body.user._id).toBe(testUser._id);
      expect(body.user.nickname).toBe(testUser.nickname);
    });

    it('should only return public user information', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, res.body);
      expect(body.user).not.toHaveProperty('email');
      expect(body.user).not.toHaveProperty('gid');
      expect(body.user).not.toHaveProperty('name');
    });
  });

  describe('Input validation', () => {
    it('should validate UUID format', async () => {
      const res = await request(app).get('/api/users/invalid-uuid').expect(400);
      expectValidErrorResponse(res.body);
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const res = await request(app).get('/api/users/invalid-uuid').expect(400);

      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent users', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .get(`/api/users/${nonExistentId}`)
        .expect(404);

      expectValidErrorResponse(res.body);
    });
  });
});

describe('PATCH /api/users/:userId', () => {
  describe('User updates', () => {
    it('should support partial updates for nickname', async () => {
      const testUser = await getTestUser();
      const newNickname = 'Updated Test User';

      const res = await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', testUser.gid)
        .send({ nickname: newNickname })
        .expect(204);

      expect(res.body).toEqual({});

      // Verify the update was applied
      const verifyRes = await request(app)
        .get(`/api/users/${testUser._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, verifyRes.body);
      expect(body.user.nickname).toBe(newNickname);
    });

    it('should handle empty updates as no-op', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', testUser.gid)
        .send({})
        .expect(204);

      expect(res.body).toEqual({});
    });
  });

  describe('Input validation', () => {
    it('should validate data type constraints', async () => {
      const testUser = await getTestUser();

      // Invalid nickname type
      const res = await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', testUser.gid)
        .send({ nickname: 123 })
        .expect(400);

      expectValidErrorResponse(res.body);
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .patch('/api/users/invalid-uuid')
        .set('gid', testUser.gid)
        .send({ nickname: 'Test' })
        .expect(400);

      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent users', async () => {
      const testUser = await getTestUser();
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .patch(`/api/users/${nonExistentId}`)
        .set('gid', testUser.gid)
        .send({ nickname: 'Test' })
        .expect(404);

      expectValidErrorResponse(res.body);
    });
  });

  describe('Authentication and authorization', () => {
    it('should require authentication', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .patch(`/api/users/${testUser._id}`)
        .send({ nickname: 'Test' })
        .expect(401);

      expectValidErrorResponse(res.body);
    });

    it('should enforce user-only authorization', async () => {
      const testUser = await getTestUser();
      let otherUser = await getTestUser();
      while (otherUser._id === testUser._id) {
        otherUser = await getTestUser();
      }

      const res = await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', otherUser.gid)
        .send({ nickname: 'Test' })
        .expect(403);

      expectValidErrorResponse(res.body);
    });

    it('should allow user to update their own profile', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', testUser.gid)
        .send({ nickname: 'Updated Test User' })
        .expect(204);

      expect(res.body).toEqual({});
    });
  });
});

describe('GET /api/users/me', () => {
  describe('User retrieval (alias)', () => {
    it('should return current user with correct response structure', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .get('/api/users/me')
        .set('gid', testUser.gid)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, res.body);
      expect(body.user._id).toBe(testUser._id);
      expect(body.user.nickname).toBe(testUser.nickname);
    });

    it('should be equivalent to GET /api/users/:userId', async () => {
      const testUser = await getTestUser();

      const directRes = await request(app)
        .get(`/api/users/${testUser._id}`)
        .expect(200);

      const aliasRes = await request(app)
        .get('/api/users/me')
        .set('gid', testUser.gid)
        .expect(200);

      expect(aliasRes.body).toEqual(directRes.body);
    });
  });

  describe('Authentication', () => {
    it('should require valid authentication', async () => {
      const res = await request(app).get('/api/users/me').expect(401);

      expectValidErrorResponse(res.body);
    });
  });
});

describe('PATCH /api/users/me', () => {
  describe('User updates (alias)', () => {
    it('should update current user successfully', async () => {
      const testUser = await getTestUser();
      const newNickname = 'Updated via Alias';

      const res = await request(app)
        .patch('/api/users/me')
        .set('gid', testUser.gid)
        .send({ nickname: newNickname })
        .expect(204);

      expect(res.body).toEqual({});

      // Verify the update was applied
      const verifyRes = await request(app)
        .get('/api/users/me')
        .set('gid', testUser.gid)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, verifyRes.body);
      expect(body.user.nickname).toBe(newNickname);
    });

    it('should be equivalent to PATCH /api/users/:userId', async () => {
      const testUser = await getTestUser();

      // Update via alias
      await request(app)
        .patch('/api/users/me')
        .set('gid', testUser.gid)
        .send({ nickname: 'Test Alias' })
        .expect(204);

      // Verify via direct endpoint
      const verifyRes = await request(app)
        .get(`/api/users/${testUser._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, verifyRes.body);
      expect(body.user.nickname).toBe('Test Alias');
    });
  });

  describe('Authentication', () => {
    it('should require valid authentication', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .send({ nickname: 'Test' })
        .expect(401);

      expectValidErrorResponse(res.body);
    });
  });
});

describe('GET /api/users/me/private', () => {
  describe('Private user retrieval', () => {
    it('should return user with private details', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .get('/api/users/me/private')
        .set('gid', testUser.gid)
        .expect(200);

      const body = parseAndExpectValid(ZPrivateUserResponse, res.body);
      expect(body.user._id).toBe(testUser._id);
      expect(body.user.nickname).toBe(testUser.nickname);
      expect(body.user.email).toBeDefined();
      expect(body.user.name).toBeDefined();
      expect(body.user.gid).toBeDefined();
    });

    it('should include all private fields', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .get('/api/users/me/private')
        .set('gid', testUser.gid)
        .expect(200);

      const body = parseAndExpectValid(ZPrivateUserResponse, res.body);
      expect(body.user).toHaveProperty('_id');
      expect(body.user).toHaveProperty('nickname');
      expect(body.user).toHaveProperty('email');
      expect(body.user).toHaveProperty('name');
      expect(body.user).toHaveProperty('gid');
    });

    it('should return different data than public endpoint', async () => {
      const testUser = await getTestUser();

      const publicRes = await request(app)
        .get('/api/users/me')
        .set('gid', testUser.gid)
        .expect(200);

      const privateRes = await request(app)
        .get('/api/users/me/private')
        .set('gid', testUser.gid)
        .expect(200);

      const publicBody = parseAndExpectValid(ZUserResponse, publicRes.body);
      const privateBody = parseAndExpectValid(
        ZPrivateUserResponse,
        privateRes.body,
      );

      // Public response should not have private fields
      expect(publicBody.user).not.toHaveProperty('email');
      expect(publicBody.user).not.toHaveProperty('name');
      expect(publicBody.user).not.toHaveProperty('gid');

      // Private response should have all fields
      expect(privateBody.user).toHaveProperty('email');
      expect(privateBody.user).toHaveProperty('name');
      expect(privateBody.user).toHaveProperty('gid');
    });
  });

  describe('Authentication', () => {
    it('should require valid authentication', async () => {
      {
        const res = await request(app).get('/api/users/me/private').expect(401);
        expectValidErrorResponse(res.body);
      }

      {
        const res = await request(app)
          .get('/api/users/me/private')
          .set('gid', 'fake')
          .expect(401);
        expectValidErrorResponse(res.body);
      }
    });
  });
});
