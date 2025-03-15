import { type UUID, randomUUID } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fuse from 'fuse.js';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { ZArticleSchema } from '@models/article-schema.ts';
import { type Course } from '@models/course-schema.ts';
import { models } from '@models/index.ts';
import { ZUuidSchema } from '@models/util-schema.ts';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  await insertFromFile('Article');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/articles', () => {
  it('should response exact schema of Article', async () => {
    const res = await request(app)
      .get('/api/articles')
      .query({ limit: 1 })
      .expect(200);
    expect(ZArticleSchema.safeParse(res.body.items[0]).success).toBe(true);
  });

  it('should support pagination', async () => {
    for (const offset of [0, 1, 99, 100, 101]) {
      for (const limit of [1, 5, 10, 20, 100, 105]) {
        const res = await request(app)
          .get('/api/articles')
          .query({ limit, offset })
          .expect(200);
        expect(res.body.items).toHaveLength(Math.max(0, Math.min(100 - offset, limit)));
      }
    }

    let res = await request(app)
      .get('/api/articles')
      .query({ limit: 10, offset: 0 })
      .expect(200);
    const page = ZArticleSchema.array().parse(res.body.items);

    res = await request(app)
      .get('/api/articles')
      .expect(200);
    expect(res.body.items).toStrictEqual(page);
  });
});

describe('POST /api/articles', () => {
  it('should create an article', async () => {
    const article = {
      course: '00000003-0003-0000-0000-000000000000',
      creator: '00000001-0003-0000-0000-000000000000',
      semester: '113-2',
      title: '普通生物學',
      tags: ['耶'],
    };

    let res = await request(app)
      .post('/api/articles')
      .send(article)
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/articles/${uuid}`)
      .expect(200);

    expect(res.body.item).toStrictEqual({ ...article, _id: uuid });
  });

  it('should reject invalid article', async () => {
    const article = {
      course: '00000003-0003-0000-0000-000000000000',
      creator: '00000001-0003-0000-0000-000000000000',
      semester: '113-2',
      title: '普通生物學',
      tags: ['耶'],
    };

    await request(app)
      .post('/api/articles')
      .send({ ...article, course: undefined })
      .expect(400);
  });

  it('should ignore provided uuid', async () => {
    const article = {
      course: '00000003-0003-0000-0000-000000000000',
      creator: '00000001-0003-0000-0000-000000000000',
      semester: '113-2',
      title: '普通生物學',
      tags: ['耶'],
    };

    let res = await request(app)
      .post('/api/articles')
      .send({ ...article, _id: '00000002-0022-0000-0000-000000000000' })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/articles/${uuid}`)
      .expect(200);
    expect(res.body.item).toStrictEqual({ ...article, _id: uuid });

    expect(uuid).not.toEqual('00000002-0022-0000-0000-000000000000');
  });
});

describe('GET /api/articles/:uuid', () => {
  it('should response the article with uuid', async () => {
    let res = await request(app)
      .get('/api/articles')
      .query({ limit: 1 })
      .expect(200);
    const article = ZArticleSchema.parse(res.body.items[0]);

    res = await request(app)
      .get(`/api/articles/${article._id}`)
      .expect(200);
    expect(res.body.item).toStrictEqual(article);
  });

  it('should reject invalid uuid', async () => {
    await request(app)
      .get('/api/articles/00000002-0003-0000-0000')
      .expect(400);
  });

  it('should reject non-exist uuid', async () => {
    await request(app)
      .get(`/api/articles/${randomUUID()}`)
      .expect(404);
  });
});

describe('PATCH /api/articles/:uuid', () => {
  it('should update the article with uuid', async () => {
    let res = await request(app)
      .get('/api/articles')
      .query({ limit: 1 })
      .expect(200);
    const article = ZArticleSchema.parse(res.body.items[0]);

    await request(app)
      .patch(`/api/articles/${article._id}`)
      .send({
        title: '不普通物理學',
      })
      .expect(204);

    res = await request(app)
      .get(`/api/articles/${article._id}`)
      .expect(200);
    expect(res.body.item).toStrictEqual({ ...article, title: '不普通物理學' });
  });

  it('should reject invalid uuid', async () => {
    await request(app)
      .patch('/api/articles/00000002-0003-0000-0000')
      .send({
        title: '不普通物理學',
      })
      .expect(400);
  });

  it('should reject non-exist uuid', async () => {
    await request(app)
      .patch(`/api/articles/${randomUUID()}`)
      .send({
        title: '不普通物理學',
      })
      .expect(400);
  });

  it('should reject modification of _id', async () => {
    const res = await request(app)
      .get('/api/articles')
      .query({ limit: 1 })
      .expect(200);
    const article = ZArticleSchema.parse(res.body.items[0]);

    await request(app)
      .patch(`/api/articles/${article._id}`)
      .send({
        _id: randomUUID(),
      })
      .expect(400);
  });
});

describe('GET /api/articles/search', () => {
  beforeEach(async () => {
    await insertFromFile('Course');
  });

  it('should support search with tag list', async () => {
    for (const tags of [
      ['CHIN'], ['汪詩珮'], ['文學'],
      ['CHIN', '汪詩珮'], ['CHIN', '文學'], ['汪詩珮', '文學'],
      ['CHIN', '汪詩珮', '文學'],
    ]) {
      const res = await request(app)
        .get('/api/articles/search')
        .query(qs.stringify({ tags }))
        .expect(200);
      for (const article of res.body.items) {
        expect(article.tags).toEqual(expect.arrayContaining(tags));
      }
    }
  });

  it('should support search with category list', async () => {
    for (const categories of [['General']]) {
      const res = await request(app)
        .get('/api/articles/search')
        .query(qs.stringify({ categories }))
        .expect(200);
      for (const article of res.body.items) {
        expect(article.course.categories).toEqual(expect.arrayContaining(categories));
      }
    }
  });

  it('should support search in title, course name, and lecturer with keyword', async () => {
    const fuseOptions = {
      keys: [
        'title',
        'course.names',
        'course.lecturer',
      ],
      threshold: 0.6,
    };
    const populatedArticles = await models.Article.find().populate<{ course: Course }>('course').exec();
    const fuse = new Fuse(populatedArticles, fuseOptions);

    for (const keyword of ['大學國文', '汪詩珮', '文學']) {
      const res = await request(app)
        .get('/api/articles/search')
        .query(qs.stringify({ keyword, limit: 100 }))
        .expect(200);
      const result = fuse.search(keyword).map(({ item }) => item.depopulate<{ course: string }>().toObject());
      expect(res.body.items).toStrictEqual(result);
    }
  });

  it('should support pagination', async () => {
    const tags = ['CHIN'];
    for (const offset of [0, 1, 99, 100, 101]) {
      for (const limit of [1, 5, 10, 20, 100, 105]) {
        const res = await request(app)
          .get('/api/articles/search')
          .query(qs.stringify({ tags, limit, offset }))
          .expect(200);
        expect(res.body.items).toHaveLength(Math.max(0, Math.min(64 - offset, limit)));
      }
    }
  });

  it('should support search with multiple conditions', async () => {
    const conditions: [string, string[], string[]][] = [
      ['大學國文', ['CHIN'], []],
      ['大學國文', ['CHIN', '汪詩珮'], []],
      ['大學國文', ['CHIN', '文學'], []],
      ['大學國文', ['CHIN'], ['General']],
    ];

    for (const [keyword, tags, categories] of conditions) {
      const fuseOptions = {
        keys: [
          'title',
          'course.names',
          'course.lecturer',
        ],
        threshold: 0.6,
      };

      const populatedArticles = await models.Article.find().populate<{ course: Course }>('course').exec();
      const fuse = new Fuse(populatedArticles, fuseOptions);
      const result = fuse.search(keyword).map(({ item }) => item);

      const filteredResult = result.filter(article =>
        tags.every(tag => article.tags.includes(tag)),
      ).filter(article =>
        categories.every(category => article.course.categories.includes(category)),
      ).map(article => article.depopulate<{ course: UUID }>().toObject());

      const res = await request(app)
        .get('/api/articles/search')
        .query(qs.stringify({ keyword, tags, categories }))
        .expect(200);

      const articles = ZArticleSchema.array().parse(res.body.items);

      expect(filteredResult).toEqual(expect.arrayContaining(articles));
    }
  });
});
