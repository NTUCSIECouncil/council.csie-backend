import { randomUUID } from 'crypto';

import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import z from 'zod';

import { ZUuidSchema } from '@/models/util-schema.ts';
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

const ZUserCreateResponse = z.object({ userId: ZUuidSchema });

const ZUserResponse = z.object({ user: ZUserResponseSchema });

const ZPrivateUserResponse = z.object({ user: ZPrivateUserResponseSchema });

const createTestUser = () => ({ nickname: 'Test User' });

beforeEach(async () => {
  await seedModelFromSamples('User');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('POST /api/users', () => {
  describe('Successful creation', () => {
    it('should create user and return user ID', async () => {
      const userData = createTestUser();

      const res = await request(app)
        .post('/api/users')
        .set('gid', 'GID_NEW_USER')
        .send(userData)
        .expect(201);

      parseAndExpectValid(ZUserCreateResponse, res.body);
    });

    it('should set authenticated user gid correctly', async () => {
      const userData = createTestUser();
      const gid = 'GID_CREATOR_TEST';

      await request(app)
        .post('/api/users')
        .set('gid', gid)
        .send(userData)
        .expect(201);

      // Verify the user was created with correct gid
      const res = await request(app)
        .get('/api/users/me/private')
        .set('gid', gid)
        .expect(200);

      const body = parseAndExpectValid(ZPrivateUserResponse, res.body);
      expect(body.user.gid).toBe(gid);
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

    it('should allow extra properties', async () => {
      const userData = { ...createTestUser(), extraField: 'should be ignored' };

      await request(app)
        .post('/api/users')
        .set('gid', 'GID_EXTRA_PROPS')
        .send(userData)
        .expect(201);
    });
  });

  describe('Input validation', () => {
    it('should require all mandatory fields', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('gid', 'GID_MISSING_FIELDS')
        .send({})
        .expect(400);

      expectValidErrorResponse(res.body);
    });

    it('should validate field data types', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('gid', 'GID_INVALID_TYPE')
        .send({ nickname: 123 })
        .expect(400);

      expectValidErrorResponse(res.body);
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const userData = createTestUser();

      const res = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(401);

      expectValidErrorResponse(res.body);
    });
  });

  describe('Conflict handling', () => {
    it('should return 409 if user already exists', async () => {
      const testUser = await getTestUser();
      const userData = createTestUser();

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
  describe('Successful retrieval', () => {
    it('should return single user', async () => {
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

      parseAndExpectValid(ZUserResponse, res.body);
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const res = await request(app).get('/api/users/invalid-uuid').expect(400);

      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent users', async () => {
      const nonExistentId = randomUUID();

      const res = await request(app)
        .get(`/api/users/${nonExistentId}`)
        .expect(404);

      expectValidErrorResponse(res.body);
    });
  });
});

describe('PATCH /api/users/:userId', () => {
  describe('Successful updates', () => {
    it('should update user profile', async () => {
      const testUser = await getTestUser();
      const newNickname = 'Updated Test User';

      await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', testUser.gid)
        .send({ nickname: newNickname })
        .expect(204);

      // Verify the update was applied
      const res = await request(app)
        .get(`/api/users/${testUser._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, res.body);
      expect(body.user.nickname).toBe(newNickname);
    });

    it('should handle empty updates', async () => {
      const testUser = await getTestUser();

      await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', testUser.gid)
        .send({})
        .expect(204);
    });

    it('should allow extra properties', async () => {
      const testUser = await getTestUser();

      await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', testUser.gid)
        .send({ nickname: 'Updated Nickname', extraField: 'should be ignored' })
        .expect(204);
    });
  });

  describe('Input validation', () => {
    it('should validate data type constraints', async () => {
      const testUser = await getTestUser();

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
      const nonExistentId = randomUUID();

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

      await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('gid', testUser.gid)
        .send({ nickname: 'Updated Test User' })
        .expect(204);
    });
  });
});

describe('GET /api/users/me', () => {
  describe('Successful retrieval', () => {
    it('should return current user profile', async () => {
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
    it('should require authentication', async () => {
      const res = await request(app).get('/api/users/me').expect(401);

      expectValidErrorResponse(res.body);
    });
  });
});

describe('PATCH /api/users/me', () => {
  describe('Successful updates', () => {
    it('should update current user profile', async () => {
      const testUser = await getTestUser();
      const newNickname = 'Updated via Me';

      await request(app)
        .patch('/api/users/me')
        .set('gid', testUser.gid)
        .send({ nickname: newNickname })
        .expect(204);

      // Verify the update was applied
      const res = await request(app)
        .get('/api/users/me')
        .set('gid', testUser.gid)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, res.body);
      expect(body.user.nickname).toBe(newNickname);
    });

    it('should be equivalent to PATCH /api/users/:userId', async () => {
      const testUser = await getTestUser();
      const newNickname = 'Test Equivalence';

      // Update via /me endpoint
      await request(app)
        .patch('/api/users/me')
        .set('gid', testUser.gid)
        .send({ nickname: newNickname })
        .expect(204);

      // Verify via direct endpoint
      const res = await request(app)
        .get(`/api/users/${testUser._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZUserResponse, res.body);
      expect(body.user.nickname).toBe(newNickname);
    });
  });

  describe('Input validation', () => {
    it('should validate data type constraints', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .patch('/api/users/me')
        .set('gid', testUser.gid)
        .send({ nickname: 123 })
        .expect(400);

      expectValidErrorResponse(res.body);
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .send({ nickname: 'Test' })
        .expect(401);

      expectValidErrorResponse(res.body);
    });
  });
});

describe('GET /api/users/me/private', () => {
  describe('Successful retrieval', () => {
    it('should return user with private details', async () => {
      const testUser = await getTestUser();

      const res = await request(app)
        .get('/api/users/me/private')
        .set('gid', testUser.gid)
        .expect(200);

      const body = parseAndExpectValid(ZPrivateUserResponse, res.body);
      expect(body.user).toEqual(testUser);
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/users/me/private').expect(401);

      expectValidErrorResponse(res.body);
    });

    it('should handle invalid authentication', async () => {
      const res = await request(app)
        .get('/api/users/me/private')
        .set('gid', 'invalid-gid')
        .expect(401);

      expectValidErrorResponse(res.body);
    });
  });
});
