import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  await insertFromFile('User');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/users/:uuid', () => {
  it('should response user with uuid', async () => {
    const res = await request(app)
      .get('/api/users/00000001-0001-0000-0000-000000000000')
      .set({ uid: '00000001-0001-0000-0000-000000000000' })
      .expect(200);
    expect(res.body.item._id).toBe('00000001-0001-0000-0000-000000000000');
  });

  it('should have alias, GET /api/users/myself', async () => {
    const res = await request(app)
      .get('/api/users/myself')
      .set({ uid: '00000001-0001-0000-0000-000000000000' })
      .expect(200);
    expect(res.body.item._id).toBe('00000001-0001-0000-0000-000000000000');

    await request(app)
      .get('/api/users/myself')
      .expect(400);
  });

  it('should deny request for other users\' info', async () => {
    await request(app)
      .get('/api/users/00000001-0001-0000-0000-000000000000')
      .set({ uid: '00000001-0002-0000-0000-000000000000' })
      .expect(403);
  });
});

describe('POST /api/users/:uuid', () => {
  it('should create a user', async () => {
    let res = await request(app)
      .post('/api/users/00000001-0004-0000-0000-000000000000')
      .set({ uid: '00000001-0004-0000-0000-000000000000' })
      .expect(201);

    res = await request(app)
      .get('/api/users/00000001-0004-0000-0000-000000000000')
      .set({ uid: '00000001-0004-0000-0000-000000000000' })
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000001-0004-0000-0000-000000000000',
      name: 'Mock Person',
      email: 'mock-email@gail.com',
    });
  });

  it('should have alias, POST /api/users/myself', async () => {
    let res = await request(app)
      .post('/api/users/myself')
      .set({ uid: '00000001-0004-0000-0000-000000000000' })
      .expect(201);

    res = await request(app)
      .get('/api/users/myself')
      .set({ uid: '00000001-0004-0000-0000-000000000000' })
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000001-0004-0000-0000-000000000000',
      name: 'Mock Person',
      email: 'mock-email@gail.com',
    });
  });
});
