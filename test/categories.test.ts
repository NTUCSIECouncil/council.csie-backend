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

describe('GET /api/categories', () => {
  it('should response the list of all categories', async () => {
    const res = await request(app)
      .get('/api/categories')
      .expect(200);
    expect(res.body.categories).not.toBeFalsy();
  });
});
