import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  await insertFromFile('Course');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/courses/:uuid', () => {
  it('should response the course with uuid', async () => {
    const res = await request(app)
      .get('/api/courses/00000003-0000-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000003-0000-0000-0000-000000000000',
      curriculum: 'CHIN8012',
      lecturer: '汪詩珮',
      class: '01',
      names: ['大學國文：文學鑑賞與寫作（一）'],
      credit: 3,
      categories: [],
    });

    await request(app)
      .get('/api/courses/00000004-0000-0000-0000-000000000000')
      .expect(404);

    await request(app)
      .get('/api/courses/00000004-0000-0000-0000')
      .expect(400);
  });
});
