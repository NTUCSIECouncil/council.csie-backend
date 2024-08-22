import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

describe('User', () => {
  beforeEach(async () => {
    await insertFromFile('User');
  });

  afterEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  describe('GET requests', () => {
    it('/api/users/:uid', async () => {
      const res = await request(app)
        .get('/api/users/00000001-0001-0000-0000-000000000000')
        .set({ uid: '00000001-0001-0000-0000-000000000000' })
        .expect(200);
      expect(res.body.item._id).toBe('00000001-0001-0000-0000-000000000000');
    });

    it('/api/users/myself', async () => {
      const res = await request(app)
        .get('/api/users/myself')
        .set({ uid: '00000001-0001-0000-0000-000000000000' })
        .expect(200);
      expect(res.body.item._id).toBe('00000001-0001-0000-0000-000000000000');
    });
  });
});
