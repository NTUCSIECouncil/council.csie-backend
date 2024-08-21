import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { ArticleSearchQueryParam, PaginationQueryParam } from '@models/util-schema.ts';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  await insertFromFile('Article');
  await insertFromFile('User');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/articles', () => {
  it('should return the first page', async () => {
    const res = await request(app)
      .get('/api/articles/')
      .expect(200);
    expect(res.body.data).toHaveLength(10);
  });

  it('should support controlling the offset of page', async () => {
    let res = await request(app)
      .get('/api/articles?' + qs.stringify({ offset: 1 }))
      .expect(200);
    expect(res.body.data).toHaveLength(10);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ offset: 20 }))
      .expect(200);
    expect(res.body.data).toHaveLength(1);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ offset: 21 }))
      .expect(400);
  });

  it('should support controlling the limit size of page', async () => {
    let res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 1 }))
      .expect(200);
    expect(res.body.data).toHaveLength(1);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 5 }))
      .expect(200);
    expect(res.body.data).toHaveLength(5);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 20 }))
      .expect(200);
    expect(res.body.data).toHaveLength(20);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 21 }))
      .expect(200);
    expect(res.body.data).toHaveLength(21);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 50 }))
      .expect(200);
    expect(res.body.data).toHaveLength(21);
  });

  it('should support controlling both the offset and the limit size of page', async () => {
    let res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 1, offset: 1 }))
      .expect(200);
    expect(res.body.data).toHaveLength(1);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 1, offset: 20 }))
      .expect(200);
    expect(res.body.data).toHaveLength(1);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 5, offset: 1 }))
      .expect(200);
    expect(res.body.data).toHaveLength(5);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 5, offset: 19 }))
      .expect(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /api/articles/search', () => {
  it('should return the search result', async () => {
    const query: ArticleSearchQueryParam | PaginationQueryParam = {
      tag: ['德邦讚'],
    };
    const res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);

    expect(res.body.data).toHaveLength(10);
  });

  it('should support pagination', async () => {
    let query: ArticleSearchQueryParam | PaginationQueryParam = {
      tag: ['德邦讚'],
      offset: 10,
    };
    let res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);
    expect(res.body.data).toHaveLength(4);

    query = {
      tag: ['德邦讚'],
      limit: 14,
    };
    res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);
    expect(res.body.data).toHaveLength(14);

    query = {
      tag: ['德邦讚'],
      limit: 15,
    };
    res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);
    expect(res.body.data).toHaveLength(14);

    query = {
      tag: ['德邦讚'],
      offset: 10,
      limit: 3,
    };
    res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);
    expect(res.body.data).toHaveLength(3);
  });
});
