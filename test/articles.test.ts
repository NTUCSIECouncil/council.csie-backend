import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fuse from 'fuse.js';
import mongoose from 'mongoose';
import { type FilterQuery } from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { type Article } from '@models/article-schema.ts';
import { type Course } from '@models/course-schema.ts';
import { models } from '@models/index.ts';
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
      .get('/api/articles')
      .query({ offset: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(10);

    res = await request(app)
      .get('/api/articles')
      .query({ offset: 99 })
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/articles')
      .query(({ offset: 100 }))
      .expect(200);
    expect(res.body.items).toHaveLength(0);

    res = await request(app)
      .get('/api/articles')
      .query(({ offset: 101 }))
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
      .query(({ limit: 100 }))
      .expect(200);
    expect(res.body.items).toHaveLength(100);

    res = await request(app)
      .get('/api/articles')
      .query(({ limit: 105 }))
      .expect(200);
    expect(res.body.items).toHaveLength(100);
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
      .query(qs.stringify({ limit: 5, offset: 98 }))
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
      .get('/api/articles/00000002-1131-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-1131-0000-0000-000000000000',
      course: '00000003-0000-0000-0000-000000000000',
      creator: '00000001-0002-0000-0000-000000000000',
      semester: '113-1',
      title: '大學國文：文學鑑賞與寫作（一）',
      tags: [
        '汪詩珮',
        '大學國文：文學鑑賞與寫作（一）',
        'CHIN',
      ],
    });

    res = await request(app)
      .get('/api/articles/00000002-1131-0000-0000-000000000098')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-1131-0000-0000-000000000098',
      course: '00000003-0000-0000-0000-000000000098',
      creator: '00000001-0001-0000-0000-000000000000',
      semester: '113-1',
      title: '英文(附一小時英聽)一',
      tags: [
        '黃允蔚',
        '英文(附一小時英聽)一',
        'FL',
      ],
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
      .get('/api/articles/00000002-1131-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000002-1131-0000-0000-000000000000',
      course: '00000003-0000-0000-0000-000000000000',
      creator: '00000001-0002-0000-0000-000000000000',
      semester: '113-1',
      title: '大學國文：文學鑑賞與寫作（一）',
      tags: [
        '汪詩珮',
        '大學國文：文學鑑賞與寫作（一）',
        'CHIN',
      ],
    });

    res = await request(app)
      .patch('/api/articles/00000002-1131-0000-0000-000000000000')
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
      .patch('/api/articles/00000002-1131-0000-0000-000000000000')
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
  it('should response the search results', async () => {
    // test the tags
    let query: ArticleSearchQueryParam | PaginationQueryParam = {
      tags: ['CHIN'],
      limit: 10,
    };
    let res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(10);

    // test the tags
    query = {
      tags: ['汪詩珮'],
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    // test the category
    query = {
      categories: ['General'],
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    const fuseOptions = {
      keys: [
        'title',
        'course.names',
        'course.lecturer',
      ],
      threshold: 0.6,
    };
    const ArticleModel = models.Article;
    const query2: FilterQuery<Article> = {};
    const articles = await ArticleModel.find(query2).populate<{ course: Course }>('course').exec();
    const fuse = new Fuse(articles, fuseOptions);

    // test the course
    query = {
      keyword: '大學國文',
      limit: 100,
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(100);
    if ('keyword' in query && query.keyword) {
      const result = fuse.search(query.keyword);
      const articles_searched = result.map(result => result.item.toObject());
      expect(res.body.items).toMatchObject(articles_searched);
    }

    // test the lecturer
    query = {
      keyword: '汪詩珮',
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    if ('keyword' in query && query.keyword) {
      const result = fuse.search(query.keyword);
      const articles_searched = result.map(result => result.item.toObject());
      expect(res.body.items).toMatchObject(articles_searched);
    }

    // test the keyword
    query = {
      keyword: '文學',
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    if ('keyword' in query && query.keyword) {
      const result = fuse.search(query.keyword);
      const articles_searched = result.map(result => result.item.toObject());
      expect(res.body.items).toMatchObject(articles_searched);
    }
  });

  // test the query by course
  it('should support pagination', async () => {
    let query: ArticleSearchQueryParam | PaginationQueryParam = {
      tags: ['CHIN'],
      offset: 0,
      limit: 64,
    };
    let res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(100);

    query = {
      tags: ['CHIN'],
      limit: 14,
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(14);

    query = {
      tags: ['CHIN'],
      limit: 15,
    };
    res = await request(app)
      .get('/api/articles/search')
      .query(qs.stringify(query))
      .expect(200);
    expect(res.body.items).toHaveLength(15);

    query = {
      tags: ['CHIN'],
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
