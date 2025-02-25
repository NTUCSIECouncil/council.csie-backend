import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { type ArticleSearchQueryParam, type PaginationQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  await insertFromFile('Course');
  await insertFromFile('User');
  await insertFromFile('Article');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/articles', () => {
  it('should response the first page', async () => {
    const res = await request(app)
      .get('/api/articles/')
      .expect(200);
    expect(res.body.items).toHaveLength(10);
  });

  it('should support controlling the offset of page', async () => {
    let res = await request(app)
      .get('/api/articles')
      .query({ offset: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(10);

    res = await request(app)
      .get('/api/articles')
      .query({ offset: 20 })
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles')
      .query(({ offset: 21 }))
      .expect(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('should support controlling the limit size of page', async () => {
    let res = await request(app)
      .get('/api/articles')
      .query(({ limit: 1 }))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles')
      .query(({ limit: 5 }))
      .expect(200);
    expect(res.body.items).toHaveLength(5);

    res = await request(app)
      .get('/api/articles')
      .query(({ limit: 20 }))
      .expect(200);
    expect(res.body.items).toHaveLength(20);

    res = await request(app)
      .get('/api/articles')
      .query(({ limit: 21 }))
      .expect(200);
    expect(res.body.items).toHaveLength(21);

    res = await request(app)
      .get('/api/articles')
      .query(({ limit: 50 }))
      .expect(200);
    expect(res.body.items).toHaveLength(21);
  });

  it('should support controlling both the offset and the limit size of page', async () => {
    let res = await request(app)
      .get('/api/articles')
      .query(({ limit: 1, offset: 1 }))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles')
      .query(({ limit: 1, offset: 20 }))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles')
      .query({ limit: 5, offset: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(5);

    res = await request(app)
      .get('/api/articles')
      .query(qs.stringify({ limit: 5, offset: 19 }))
      .expect(200);
    expect(res.body.items).toHaveLength(2);
  });
});

describe('POST /api/articles', () => {
  it('should create an article', async () => {
    let res = await request(app)
      .post('/api/articles')
      .send({
        course: '00000003-0003-0000-0000-000000000000',
        creator: '00000001-0003-0000-0000-000000000000',
        semester: '113-2',
        title: '普通生物學',
        tags: ['耶'],
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/articles/${uuid}`)
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: uuid,
      course: '00000003-0003-0000-0000-000000000000',
      creator: '00000001-0003-0000-0000-000000000000',
      semester: '113-2',
      title: '普通生物學',
      tags: ['耶'],
    });

    res = await request(app)
      .post('/api/articles')
      .send({
        couse: '00000003-0003-0000-0000-000000000000',
        creator: '00000001-0003-0000-0000-000000000000',
        semester: '113-2',
        title: '普通生物學',
        tags: ['耶'],
      })
      .expect(400);
  });

  it('should ignore provided uuid', async () => {
    let res = await request(app)
      .post('/api/articles')
      .send({
        _id: '00000002-0022-0000-0000-000000000000',
        course: '00000003-0003-0000-0000-000000000000',
        creator: '00000001-0003-0000-0000-000000000000',
        semester: '113-2',
        title: '普通生物學',
        tags: ['耶'],
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/articles/${uuid}`)
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: uuid,
      course: '00000003-0003-0000-0000-000000000000',
      creator: '00000001-0003-0000-0000-000000000000',
      semester: '113-2',
      title: '普通生物學',
      tags: ['耶'],
    });

    expect(uuid).not.toEqual('00000002-0022-0000-0000-000000000000');
  });
});

describe('GET /api/articles/:uuid', () => {
  it('should response the article with uuid', async () => {
    let res = await request(app)
      .get('/api/articles/00000002-0001-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-0001-0000-0000-000000000000',
      course: '00000003-0001-0000-0000-000000000000',
      creator: '00000001-0001-0000-0000-000000000000',
      semester: '113-1',
      title: '普物',
      tags: ['德邦讚'],
    });

    res = await request(app)
      .get('/api/articles/00000002-0003-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-0003-0000-0000-000000000000',
      course: '00000003-0003-0000-0000-000000000000',
      creator: '00000001-0003-0000-0000-000000000000',
      semester: '113-2',
      title: '普通生物學',
      tags: ['耶'],
    });

    res = await request(app)
      .get('/api/articles/00000002-0003-0000-0000')
      .expect(400);

    res = await request(app)
      .get('/api/articles/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});

describe('PATCH /api/articles/:uuid', () => {
  it('should update the article with uuid', async () => {
    let res = await request(app)
      .get('/api/articles/00000002-0001-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-0001-0000-0000-000000000000',
      course: '00000003-0001-0000-0000-000000000000',
      creator: '00000001-0001-0000-0000-000000000000',
      semester: '113-1',
      title: '普物',
      tags: ['德邦讚'],
    });

    res = await request(app)
      .patch('/api/articles/00000002-0001-0000-0000-000000000000')
      .send({
        title: '不普通物理學',
      })
      .expect(204);

    res = await request(app)
      .patch('/api/articles/00000002-0001-0000-0000')
      .send({
        title: '不普通物理學',
      })
      .expect(400);

    res = await request(app)
      .patch('/api/articles/00000002-0001-0000-0000-000000000000')
      .send({
        title: '不普通物理學',
      })
      .expect(204);
  });

  it('should reject modification of _id', async () => {
    await request(app)
      .patch('/api/articles/00000002-0001-0000-0000-000000000000')
      .send({
        _id: '00000002-0022-0000-0000-000000000000',
      })
      .expect(400);
  });
});

describe('GET /api/articles/search', () => {
  it('should response the search result', async () => {
    const query: ArticleSearchQueryParam | PaginationQueryParam = {
      tags: ['德邦讚'],
    };
    const res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(10);
  });

  it('should support pagination', async () => {
    let query: ArticleSearchQueryParam | PaginationQueryParam = {
      tags: ['德邦讚'],
      offset: 10,
    };
    let res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(4);

    query = {
      tags: ['德邦讚'],
      limit: 14,
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(14);

    query = {
      tags: ['德邦讚'],
      limit: 15,
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(14);

    query = {
      tags: ['德邦讚'],
      offset: 10,
      limit: 3,
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(3);
  });
});
