import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import request from 'supertest';
import { models } from '@models/index.ts';
import app from './app.ts';
import { connectDb, disconnectDb, insertFromFile } from './db.ts';

describe('User', () => {
  beforeAll(async () => {
    await connectDb();
    await insertFromFile('test/users.example.json', models.User);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  describe('GET requests', () => {
    it('/api/users/:uid', async () => {
      const res = await request(app)
        .get('/api/users/00000001-0001-0000-0000-000000000000')
        .set({ uid: '00000001-0001-0000-0000-000000000000' })
        .expect(200);
      expect(res.body._id).toBe('00000001-0001-0000-0000-000000000000');
    });

    it('/api/users/myself', async () => {
      const res = await request(app)
        .get('/api/users/myself')
        .set({ uid: '00000001-0001-0000-0000-000000000000' })
        .expect(200);
      expect(res.body._id).toBe('00000001-0001-0000-0000-000000000000');
    });
  });
});
