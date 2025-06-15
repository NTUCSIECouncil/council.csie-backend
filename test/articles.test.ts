import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import Fuse from 'fuse.js';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { env } from '@/config.ts';
import { ArticleModel, ZArticleSchema } from '@models/article-schema.ts';
import { CourseModel, ZCourseSchema } from '@models/course-schema.ts';
import { UserModel, ZUserSchema } from '@models/user-schema.ts';
import { ZUuidSchema } from '@models/util-schema.ts';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  await insertFromFile('Article');
  await insertFromFile('User');
  await insertFromFile('Course');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/articles', () => {
  it('should response exact schema of Article', async () => {
    const res = await request(app)
      .get('/api/articles')
      .query(qs.stringify({ limit: 1 }))
      .expect(200);
    expect(ZArticleSchema.safeParse(res.body.articles[0]).success).toBe(true);
  });

  it('should support pagination', async () => {
    const articleLen = (await ArticleModel.find().lean().exec()).length;
    for (const offset of [0, 1, 99, 100, 101]) {
      for (const limit of [1, 5, 10, 20, 100, 105]) {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit, offset }))
          .expect(200);
        expect(res.body.articles).toHaveLength(Math.max(0, Math.min(articleLen - offset, limit)));
      }
    }

    let res = await request(app)
      .get('/api/articles')
      .query(qs.stringify({ limit: 10, offset: 0 }))
      .expect(200);
    const page = ZArticleSchema.array().parse(res.body.articles);

    res = await request(app)
      .get('/api/articles')
      .expect(200);
    expect(res.body.articles).toStrictEqual(page);
  });

  it('should support search with tag list', async () => {
    for (const tags of [
      ['賴喜美'], ['醣類化學與應用'], ['AC'],
      ['AC', '賴喜美'], ['AC', '醣類化學與應用'], ['賴喜美', '醣類化學與應用'],
      ['AC', '賴喜美', '醣類化學與應用'],
    ]) {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ tags }))
        .expect(200);
      for (const article of res.body.articles) {
        expect(article.tags).toEqual(expect.arrayContaining(tags));
      }
    }
  });

  it('should support search in title, course name, lecturer and curriculum', async () => {
    const fuseOptions = {
      keys: [
        'title',
        'course.names',
        'course.lecturer',
        'course.curriculum',
      ],
      threshold: 0.6,
    };
    const populatedArticles = await ArticleModel.find().populate('course').exec();
    const fuse = new Fuse(populatedArticles, fuseOptions);

    for (const keyword of ['醣類化學與應用', '醣類化學與應用', '賴喜美', 'AC5057']) {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ keyword, limit: 100 }))
        .expect(200);
      const result = fuse.search(keyword).map(({ item }) => {
        if (typeof item.depopulate === 'function') {
          return item.depopulate('course').toObject();
        }
        return item;
      });
      expect(res.body.articles).toStrictEqual(result);
    }
  });

  it('should support search with multiple conditions', async () => {
    const conditions: [string, string[]][] = [
      ['賴喜美', ['AC']],
      ['賴喜美', ['醣類化學與應用']],
    ];

    for (const [keyword, tags] of conditions) {
      const fuseOptions = {
        keys: [
          'title',
          'course.names',
          'course.lecturer',
        ],
        threshold: 0.6,
      };

      const populatedArticles = await ArticleModel.find().populate('course').exec();
      const fuse = new Fuse(populatedArticles, fuseOptions);
      const result = fuse.search(keyword).map(({ item }) => item);

      const filteredResult = result
        .filter(article => Array.isArray(article.tags) && tags.every((tag: string) => article.tags.includes(tag)))
        .map((article) => {
          if (typeof article.depopulate === 'function') {
            return article.depopulate('course').toObject();
          }
          return article;
        });

      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ keyword, tags }))
        .expect(200);

      const articles = ZArticleSchema.array().parse(res.body.articles);
      expect(filteredResult).toEqual(expect.arrayContaining(articles));
    }
  });

  it('should include meta object in GET /api/articles', async () => {
    const total = await ArticleModel.countDocuments().exec();
    const res = await request(app)
      .get('/api/articles')
      .query(qs.stringify({ limit: 5, offset: 0 }))
      .expect(200);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toStrictEqual({ total, offset: 0, limit: 5 });
  });

  it('should truncate content to 50 chars with ellipsis if longer', async () => {
    const creator = await UserModel.findOne().exec();
    const course = await CourseModel.findOne().exec();
    const longContent = 'a'.repeat(60);
    const articleCreate = {
      title: 'truncate test',
      tags: ['truncate'],
      ratings: { sweetness: 5, chill: 5, teaching: 5, gain: 5, recommend: 5 },
      course: course!._id,
    };
    const res1 = await request(app)
      .post('/api/articles')
      .send(articleCreate)
      .set('gid', creator!.gid)
      .expect(201);
    const articleId = ZUuidSchema.parse(res1.body.articleId);

    await request(app)
      .put(`/api/articles/${articleId}/file`)
      .send({ file: longContent })
      .set('gid', creator!.gid)
      .expect(204);

    const res2 = await request(app)
      .get(`/api/articles/${articleId}`)
      .query(qs.stringify({ embed: ['content'] }))
      .expect(200);
    expect(res2.body.article.content).toBe(longContent.substring(0, 50) + '...');
  });

  it('should reject ratings out of range', async () => {
    const creator = await UserModel.findOne().exec();
    const course = await CourseModel.findOne().exec();
    const invalidRatings = [0, 6, -1, 100];
    for (const val of invalidRatings) {
      const articleCreate = {
        title: 'invalid ratings',
        tags: ['fail'],
        ratings: { sweetness: val, chill: 3, teaching: 3, gain: 3, recommend: 3 },
        course: course!._id,
      };
      await request(app)
        .post('/api/articles')
        .send(articleCreate)
        .set('gid', creator!.gid)
        .expect(400);
    }
  });

  it('should embed course, creator, and content fields when requested', async () => {
    for (const embed of [['course'], ['creator'], ['content'], ['course', 'creator'], ['course', 'content'], ['creator', 'content'], ['course', 'creator', 'content']]) {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ embed }))
        .expect(200);
      const ZEmbedArticleSchema = ZArticleSchema.extend({
        course: embed.includes('course') ? ZCourseSchema : ZUuidSchema,
        creator: embed.includes('creator') ? ZUserSchema : ZUuidSchema,
        content: embed.includes('content') ? z.string().max(53) : z.undefined(),
      });
      expect(res.body).toHaveProperty('articles');
      ZEmbedArticleSchema.array().parse(res.body.articles);
    }
  });
});

describe('POST /api/articles', () => {
  it('should create an article', async () => {
    const creator = await UserModel.findOne().exec();
    const courseId = (await CourseModel.findOne().exec())!._id;

    const articleCreate = {
      title: '普通生物學',
      tags: ['耶'],
      ratings: {
        sweetness: 5,
        chill: 4,
        teaching: 3,
        gain: 2,
        recommend: 1,
      },
      course: courseId,
    };

    let res = await request(app)
      .post('/api/articles')
      .send(articleCreate)
      .set('gid', creator!.gid)
      .expect(201);

    const articleId = ZUuidSchema.parse(res.body.articleId);

    res = await request(app)
      .get(`/api/articles/${articleId}`)
      .expect(200);

    expect(res.body.article).toStrictEqual({ ...articleCreate, _id: articleId, creator: creator!._id });
  });

  it('should reject missing required fields', async () => {
    const creator = await UserModel.findOne().exec();
    const course = await CourseModel.findOne().exec();
    const base = {
      title: 'missing',
      tags: ['fail'],
      ratings: { sweetness: 3, chill: 3, teaching: 3, gain: 3, recommend: 3 },
      course: course!._id,
    };
    for (const key in base) {
      const copy: Partial<typeof base> = { ...base };
      copy[key as keyof typeof base] = undefined;
      await request(app)
        .post('/api/articles')
        .send(copy)
        .set('gid', creator!.gid)
        .expect(400);
    }
  });

  it('should reject unauthorized client', async () => {
    const articleCreate = {
      title: '普通生物學',
      tags: ['耶'],
      ratings: {
        sweetness: 5,
        chill: 4,
        teaching: 3,
        gain: 2,
        recommend: 1,
      },
      course: randomUUID(),
    };

    await request(app)
      .post('/api/articles')
      .send(articleCreate)
      .expect(401);
  });
});

describe('GET /api/articles/:articleId', () => {
  it('should response the article with uuid', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();

    const res = await request(app)
      .get(`/api/articles/${article!._id}`)
      .expect(200);
    expect(res.body.article).toStrictEqual(article);
  });

  it('should reject invalid uuid', async () => {
    await request(app)
      .get(`/api/articles/${randomUUID().substring(1)}`)
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
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    const creator = await UserModel.findById(article!.creator).exec();

    await request(app)
      .patch(`/api/articles/${article!._id}`)
      .send({ title: '不普通物理學' })
      .set('gid', creator!.gid)
      .expect(204);

    const res = await request(app)
      .get(`/api/articles/${article!._id}`)
      .expect(200);
    expect(res.body.article).toStrictEqual({ ...article, title: '不普通物理學' });
  });

  it('should reject invalid uuid', async () => {
    const creator = await UserModel.findOne().exec();
    await request(app)
      .patch('/api/articles/00000002-0003-0000-0000')
      .send({ title: '不普通物理學' })
      .set('gid', creator!.gid)
      .expect(400);
  });

  it('should reject non-exist uuid', async () => {
    const creator = await UserModel.findOne().exec();
    await request(app)
      .patch(`/api/articles/${randomUUID()}`)
      .send({ title: '不普通物理學' })
      .set('gid', creator!.gid)
      .expect(404);
  });

  it('should reject unauthorized client', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    const randomUser = await UserModel.findOne().exec();
    await request(app)
      .patch(`/api/articles/${article!._id}`)
      .send({ title: '不普通物理學' })
      .expect(401);

    await request(app)
      .patch(`/api/articles/${article!._id}`)
      .send({ title: '不普通物理學' })
      .set('gid', randomUser!.gid)
      .expect(403);
  });

  it('should support PATCH partial update for all fields', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    const creator = await UserModel.findById(article!.creator).exec();
    const patchData = {
      title: 'patched title',
      tags: ['patched', 'tags'],
      ratings: { sweetness: 2, chill: 2, teaching: 2, gain: 2, recommend: 2 },
    };
    await request(app)
      .patch(`/api/articles/${article!._id}`)
      .send(patchData)
      .set('gid', creator!.gid)
      .expect(204);
    const res = await request(app)
      .get(`/api/articles/${article!._id}`)
      .expect(200);
    expect(res.body.article).toEqual({ ...article, ...patchData });
  });
});

describe('GET /api/articles/:uuid/file', () => {
  it('should response the article file', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();

    const res = await request(app)
      .get(`/api/articles/${article!._id}/file`)
      .expect(200);
    expect(z.object({ file: z.string() }).safeParse(res.body).success).toBe(true);

    const data = await fs.readFile(path.join(env.PWD, env.ARTICLE_FILE_DIR, `${article!._id}.md`), 'utf-8');
    expect(res.body.file).toBe(data);
  });

  it('should reject invalid uuid', async () => {
    await request(app)
      .get(`/api/articles/${randomUUID().substring(1)}/file`)
      .expect(400);
  });
  it('should reject non-exist uuid', async () => {
    await request(app)
      .get(`/api/articles/${randomUUID()}/file`)
      .expect(404);
  });
});

describe('PUT /api/articles/:uuid/file', () => {
  it('should update the article file', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    const creator = await UserModel.findById(article!.creator).exec();

    const content = '這是測試內容';
    await request(app)
      .put(`/api/articles/${article!._id}/file`)
      .send({ file: content })
      .set('gid', creator!.gid)
      .expect(204);

    const res = await request(app)
      .get(`/api/articles/${article!._id}/file`)
      .expect(200);
    expect(res.body.file).toBe(content);
  });

  it('should reject invalid uuid', async () => {
    const creator = await UserModel.findOne().exec();
    await request(app)
      .put('/api/articles/00000002-0003-0000-0000/file')
      .send({ file: '這是測試內容' })
      .set('gid', creator!.gid)
      .expect(400);
  });

  it('should reject non-exist uuid', async () => {
    const creator = await UserModel.findOne().exec();
    await request(app)
      .put(`/api/articles/${randomUUID()}/file`)
      .send({ file: '這是測試內容' })
      .set('gid', creator!.gid)
      .expect(404);
  });

  it('should reject unauthorized client', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    const randomUser = await UserModel.findOne().exec();
    await request(app)
      .put(`/api/articles/${article!._id}/file`)
      .send({ file: '這是測試內容' })
      .expect(401);

    await request(app)
      .put(`/api/articles/${article!._id}/file`)
      .send({ file: '這是測試內容' })
      .set('gid', randomUser!.gid)
      .expect(403);
  });

  it('should reject missing file property', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    const creator = await UserModel.findById(article!.creator).exec();
    await request(app)
      .put(`/api/articles/${article!._id}/file`)
      .send({})
      .set('gid', creator!.gid)
      .expect(400);
  });

  it('should reject non-string file property', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    const creator = await UserModel.findById(article!.creator).exec();
    for (const invalid of [123, {}, [], null, true]) {
      await request(app)
        .put(`/api/articles/${article!._id}/file`)
        .send({ file: invalid })
        .set('gid', creator!.gid)
        .expect(400);
    }
  });

  it('should reject invalid gid (not matching any user)', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    await request(app)
      .put(`/api/articles/${article!._id}/file`)
      .send({ file: 'content' })
      .set('gid', 'not-a-real-gid')
      .expect(401);
  });

  it('should overwrite the article file', async () => {
    const article = await ArticleModel.findOne().lean({ versionKey: false }).exec();
    const creator = await UserModel.findById(article!.creator).exec();
    const content1 = '第一次內容';
    const content2 = '第二次內容';
    await request(app)
      .put(`/api/articles/${article!._id}/file`)
      .send({ file: content1 })
      .set('gid', creator!.gid)
      .expect(204);
    let res = await request(app)
      .get(`/api/articles/${article!._id}/file`)
      .expect(200);
    expect(res.body.file).toBe(content1);
    await request(app)
      .put(`/api/articles/${article!._id}/file`)
      .send({ file: content2 })
      .set('gid', creator!.gid)
      .expect(204);
    res = await request(app)
      .get(`/api/articles/${article!._id}/file`)
      .expect(200);
    expect(res.body.file).toBe(content2);
  });
});
