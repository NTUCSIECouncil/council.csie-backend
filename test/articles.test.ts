import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { type ArticleSearchQueryParam, type PaginationQueryParam, ZUuidSchema } from '@models/util-schema.ts';
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
  it('should response the first page', async () => {
    const res = await request(app)
      .get('/api/articles/')
      .expect(200);
    expect(res.body.items).toHaveLength(10);
  });

  it('should support controlling the offset of page', async () => {
    let res = await request(app)
      .get('/api/articles?' + qs.stringify({ offset: 1 }))
      .expect(200);
    expect(res.body.items).toHaveLength(10);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ offset: 20 }))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ offset: 21 }))
      .expect(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('should support controlling the limit size of page', async () => {
    let res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 1 }))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 5 }))
      .expect(200);
    expect(res.body.items).toHaveLength(5);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 20 }))
      .expect(200);
    expect(res.body.items).toHaveLength(20);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 21 }))
      .expect(200);
    expect(res.body.items).toHaveLength(21);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 50 }))
      .expect(200);
    expect(res.body.items).toHaveLength(21);
  });

  it('should support controlling both the offset and the limit size of page', async () => {
    let res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 1, offset: 1 }))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 1, offset: 20 }))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 5, offset: 1 }))
      .expect(200);
    expect(res.body.items).toHaveLength(5);

    res = await request(app)
      .get('/api/articles?' + qs.stringify({ limit: 5, offset: 19 }))
      .expect(200);
    expect(res.body.items).toHaveLength(2);
  });
});

describe('POST /api/articles', () => {
  it('should create an article', async () => {
    let res = await request(app)
      .post('/api/articles')
      .send({
        title: '普通生物學',
        lecturer: '你是誰',
        tag: ['耶'],
        content: '耶',
        creator: '00000001-0003-0000-0000-000000000000',
        course: '00000003-0003-0000-0000-000000000000',
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/articles/${uuid}`)
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: uuid,
      title: '普通生物學',
      lecturer: '你是誰',
      tag: ['耶'],
      content: '耶',
      creator: '00000001-0003-0000-0000-000000000000',
      course: '00000003-0003-0000-0000-000000000000',
    });
  });

  it('should ignore provided uuid', async () => {
    let res = await request(app)
      .post('/api/articles')
      .send({
        _id: '00000002-0022-0000-0000-000000000000',
        title: '普通生物學',
        lecturer: '你是誰',
        tag: ['耶'],
        content: '耶',
        creator: '00000001-0003-0000-0000-000000000000',
        course: '00000003-0003-0000-0000-000000000000',
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/articles/${uuid}`)
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: uuid,
      title: '普通生物學',
      lecturer: '你是誰',
      tag: ['耶'],
      content: '耶',
      creator: '00000001-0003-0000-0000-000000000000',
      course: '00000003-0003-0000-0000-000000000000',
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
      title: '普通物理學',
      lecturer: '胡德邦',
      tag: ['德邦讚'],
      content: '好誒',
      creator: '00000001-0001-0000-0000-000000000000',
      course: '00000003-0001-0000-0000-000000000000',
    });

    res = await request(app)
      .get('/api/articles/00000002-0003-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-0003-0000-0000-000000000000',
      title: '普通生物學',
      lecturer: '你是誰',
      content: '耶',
      creator: '00000001-0003-0000-0000-000000000000',
      course: '00000003-0003-0000-0000-000000000000',
    });
  });
});

describe('PATCH /api/articles/:uuid', () => {
  it('should update the article with uuid', async () => {
    let res = await request(app)
      .get('/api/articles/00000002-0001-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-0001-0000-0000-000000000000',
      title: '普通物理學',
      lecturer: '胡德邦',
      tag: ['德邦讚'],
      content: '好誒',
      creator: '00000001-0001-0000-0000-000000000000',
      course: '00000003-0001-0000-0000-000000000000',
    });

    res = await request(app)
      .patch('/api/articles/00000002-0001-0000-0000-000000000000')
      .send({
        title: '不普通物理學',
      })
      .expect(204);

    res = await request(app)
      .get('/api/articles/00000002-0001-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-0001-0000-0000-000000000000',
      title: '不普通物理學',
      lecturer: '胡德邦',
      tag: ['德邦讚'],
      content: '好誒',
      creator: '00000001-0001-0000-0000-000000000000',
      course: '00000003-0001-0000-0000-000000000000',
    });

    res = await request(app)
      .patch('/api/articles/00000002-0001-0000-0000-000000000000')
      .send({
        _id: '00000002-0022-0000-0000-000000000000',
      })
      .expect(400);
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
      tag: ['德邦讚'],
    };
    const res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);

    expect(res.body.items).toHaveLength(10);
  });

  it('should support pagination', async () => {
    let query: ArticleSearchQueryParam | PaginationQueryParam = {
      tag: ['德邦讚'],
      offset: 10,
    };
    let res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(4);

    query = {
      tag: ['德邦讚'],
      limit: 14,
    };
    res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(14);

    query = {
      tag: ['德邦讚'],
      limit: 15,
    };
    res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(14);

    query = {
      tag: ['德邦讚'],
      offset: 10,
      limit: 3,
    };
    res = await request(app)
      .get('/api/articles/search?' + qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(3);
  });
});
