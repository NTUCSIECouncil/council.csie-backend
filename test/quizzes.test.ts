import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import qs from 'qs';
import request from 'supertest';
import { models } from '@models/index.ts';
import app from './app.ts';
import { connectDb, disconnectDb, insertFromFile } from './db.ts';

describe('Quiz', function () {
  beforeAll(async () => {
    await connectDb();
    await insertFromFile('test/courses.example.json', models.Course);
    await insertFromFile('test/quizzes.example.json', models.Quiz);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  describe('GET requests', () => {
    it('/api/quizzes/', async () => {
      const res = await request(app)
        .get('/api/quizzes/')
        .expect(200);
      expect(res.body.result).toHaveLength(5);
    });

    it('/api/quizzes/:uuid', async () => {
      const res = await request(app)
        .get('/api/quizzes/00000004-0002-0000-0000-000000000000')
        .expect(200);
      expect(res.body.result.title).toBe('普通物理學');
    });

    it('/api/quizzes/search', async () => {
      const query = {
        course: '00000003-0001-0000-0000-000000000000',
      };
      const res = await request(app)
        .get('/api/quizzes/search?' + qs.stringify(query))
        .expect(200);

      expect(res.body.result).toHaveLength(3);
    });

    it('/api/quizzes/search', async () => {
      const query = {
        course: '00000003-0001-0000-0000-000000000000',
        keyword: '111-2',
      };
      const res = await request(app)
        .get('/api/quizzes/search?' + qs.stringify(query))
        .expect(200);

      expect(res.body.result).toHaveLength(1);
    });
  });
});
