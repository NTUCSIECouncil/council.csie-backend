import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

describe('Quiz', function () {
  beforeEach(async () => {
    await insertFromFile('Course');
    await insertFromFile('Quiz');
  });

  afterEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  describe('GET requests', () => {
    it('/api/quizzes/', async () => {
      const res = await request(app)
        .get('/api/quizzes/')
        .expect(200);
      expect(res.body.items).toHaveLength(5);
    });

    it('/api/quizzes/:uuid', async () => {
      const res = await request(app)
        .get('/api/quizzes/00000004-0002-0000-0000-000000000000')
        .expect(200);
      expect(res.body.item.title).toBe('普通物理學');
    });

    it('/api/quizzes/search', async () => {
      const query = {
        course: '00000003-0001-0000-0000-000000000000',
      };
      const res = await request(app)
        .get('/api/quizzes/search?' + qs.stringify(query))
        .expect(200);

      expect(res.body.items).toHaveLength(3);
    });

    it('/api/quizzes/search', async () => {
      const query = {
        course: '00000003-0001-0000-0000-000000000000',
        keyword: '111-2',
      };
      const res = await request(app)
        .get('/api/quizzes/search?' + qs.stringify(query))
        .expect(200);

      expect(res.body.items).toHaveLength(1);
    });
  });
});
