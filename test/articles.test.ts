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
    expect(ZArticleSchema.safeParse(res.body.articles[0]).success).toBe(true);
  });

  it('should support pagination', async () => {
    for (const offset of [0, 1, 99, 100, 101]) {
      for (const limit of [1, 5, 10, 20, 100, 105]) {
        const res = await request(app)
          .get('/api/articles')
          .query({ limit, offset })
          .expect(200);
        expect(res.body.articles).toHaveLength(Math.max(0, Math.min(100 - offset, limit)));
      }
    }

    let res = await request(app)
      .get('/api/articles')
      .query({ limit: 10, offset: 0 })
      .expect(200);
    const page = ZArticleSchema.array().parse(res.body.articles);

    res = await request(app)
      .get('/api/articles')
      .expect(200);
    expect(res.body.articles).toStrictEqual(page);
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
      .send({ article })
      .expect(201);

    const articleId = ZUuidSchema.parse(res.body.articleId);

    res = await request(app)
      .get(`/api/articles/${articleId}`)
      .expect(200);

    expect(res.body.article).toStrictEqual({ ...article, _id: articleId });
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
      .send({ article: { ...article, course: undefined } })
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
      .send({ article: { ...article, _id: '00000002-0022-0000-0000-000000000000' } })
      .expect(201);

    const articleId = ZUuidSchema.parse(res.body.articleId);

    res = await request(app)
      .get(`/api/articles/${articleId}`)
      .expect(200);
    expect(res.body.article).toStrictEqual({ ...article, _id: articleId });

    expect(articleId).not.toEqual('00000002-0022-0000-0000-000000000000');
  });
});

describe('GET /api/articles/:articleId', () => {
  it('should response the article with uuid', async () => {
    let res = await request(app)
      .get('/api/articles')
      .query({ limit: 1 })
      .expect(200);
    const article = ZArticleSchema.parse(res.body.articles[0]);

    res = await request(app)
      .get(`/api/articles/${article._id}`)
      .expect(200);
    expect(res.body.article).toStrictEqual(article);
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

describe('PATCH /api/articles/:articleId', () => {
  it('should update the article with uuid', async () => {
    let res = await request(app)
      .get('/api/articles')
      .query({ limit: 1 })
      .expect(200);
    const article = ZArticleSchema.parse(res.body.articles[0]);

    await request(app)
      .patch(`/api/articles/${article._id}`)
      .send({
        article: {
          title: '不普通物理學',
        },
      })
      .expect(204);

    res = await request(app)
      .get(`/api/articles/${article._id}`)
      .expect(200);
    expect(res.body.article).toStrictEqual({ ...article, title: '不普通物理學' });
  });

  it('should reject invalid uuid', async () => {
    await request(app)
      .patch('/api/articles/00000002-0003-0000-0000')
      .send({
        article: {
          title: '不普通物理學',
        },
      })
      .expect(400);
  });

  it('should reject non-exist uuid', async () => {
    await request(app)
      .patch(`/api/articles/${randomUUID()}`)
      .send({
        article: {
          title: '不普通物理學',
        },
      })
      .expect(404);
  });

  it('should ignore modification of _id', async () => {
    const res = await request(app)
      .get('/api/articles')
      .query({ limit: 1 })
      .expect(200);
    const article = ZArticleSchema.parse(res.body.articles[0]);

    const newId = randomUUID();
    await request(app)
      .patch(`/api/articles/${article._id}`)
      .send({
        article: {
          _id: newId,
        },
      })
      .expect(204);

    await request(app)
      .get(`/api/articles/${newId}`)
      .expect(404);
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
      for (const article of res.body.articles) {
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
      for (const article of res.body.articles) {
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
      expect(res.body.articles).toStrictEqual(result);
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
        expect(res.body.articles).toHaveLength(Math.max(0, Math.min(64 - offset, limit)));
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

      const articles = ZArticleSchema.array().parse(res.body.articles);

      expect(filteredResult).toEqual(expect.arrayContaining(articles));
    }
  });
});

describe('GET /api/articles/:uuid/file', () => {
  it('should response the article file', async () => {
    // the file exists
    const res = await request(app)
      .get('/api/articles/00000002-1131-0000-0000-000000000002/file')
      .expect(200);
    expect(res.type).toEqual('text/markdown');

    // the uuid does not exist
    await request(app)
      .get('/api/articles/00000003-0000-0000-0000-000000000000/file')
      .expect(404);

    // the uuid exist but the file does not
    await request(app)
      .get('/api/articles/00000002-1131-0000-0000-000000000003/file')
      .expect(500);

    // invalid uuid (wrong format)
    await request(app)
      .get('/api/articles/00000002-0000-0000-0000/file')
      .expect(400);
  });
});

describe('PUT /api/articles/:uuid/file', () => {
  const validArticleId = '00000002-1131-0000-0000-000000000005';

  it('should upload a Markdown file successfully', async () => {
    const response = await request(app)
      .put(`/api/articles/${validArticleId}/file`)
      .attach('file', Buffer.from('mock md content'), {
        filename: 'test.md',
        contentType: 'text/markdown',
      });

    expect(response.status).toBe(204);
  });
});
