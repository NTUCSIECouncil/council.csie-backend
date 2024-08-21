import mongoose from 'mongoose';
import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import qs from 'qs';
import request from 'supertest';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

describe('Article', function () {
  beforeEach(async () => {
    await insertFromFile('Article');
    await insertFromFile('User');
  });

  afterEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  describe('GET requests', () => {
    it('/api/articles', async () => {
      const res = await request(app)
        .get('/api/articles/')
        .expect(200);
      expect(res.body.data).toHaveLength(10);
    });

    it('/api/articles - portionNum', async () => {
      let res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionNum: 1 }))
        .expect(200);
      expect(res.body.data).toHaveLength(10);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionNum: 2 }))
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionNum: 3 }))
        .expect(400);
    });

    it('/api/articles - portionSize', async () => {
      let res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionSize: 20 }))
        .expect(200);
      expect(res.body.data).toHaveLength(20);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionSize: 50 }))
        .expect(200);
      expect(res.body.data).toHaveLength(21);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionSize: 100 }))
        .expect(200);
      expect(res.body.data).toHaveLength(21);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionSize: 21 }))
        .expect(400);
    });

    it('/api/articles/search', async () => {
      const queryOne = {
        tag: ['德邦讚'],
      };
      const resOne = await request(app)
        .get('/api/articles/search?' + qs.stringify(queryOne))
        .expect(200);

      expect(resOne.body.data).toHaveLength(10);
      const queryTwo = {
        tag: ['德邦讚'],
        portionNum: 1,
      };
      const resTwo = await request(app)
        .get('/api/articles/search?' + qs.stringify(queryTwo))
        .expect(200);

      expect(resTwo.body.data).toHaveLength(4);
    });
  });
});
