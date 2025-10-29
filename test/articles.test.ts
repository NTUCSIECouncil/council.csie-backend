import { randomUUID } from 'crypto';

import Fuse from 'fuse.js';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ArticleModel } from '@models/article-schema.ts';
import { UserModel } from '@models/user-schema.ts';
import { ZUuidSchema } from '@models/util-schema.ts';
import app from './app.ts';
import {
  ZArticleResponseSchema,
  ZCourseResponseSchema,
  ZMetaSchema,
} from './response-schemas.ts';
import {
  expectValidErrorResponse,
  getTestArticle,
  getTestCourse,
  getTestUser,
  parseAndExpectValid,
  seedModelFromSamples,
} from './utils.ts';

const ZArticleListResponse = z.object({
  articles: ZArticleResponseSchema.array(),
  meta: ZMetaSchema,
});

const ZArticleCreateResponse = z.object({ articleId: ZUuidSchema });

const ZArticleResponse = z.object({ article: ZArticleResponseSchema });

const ZFileResponse = z.object({ file: z.string() });

const createTestRatings = () => ({
  sweetness: 3,
  chill: 3,
  teaching: 3,
  gain: 3,
  recommend: 3,
});

const createTestArticle = async () => {
  const course = await getTestCourse();
  return {
    title: 'Test Article',
    tags: ['test'],
    ratings: createTestRatings(),
    course: course._id,
  };
};

beforeEach(async () => {
  await seedModelFromSamples('Article');
  await seedModelFromSamples('User');
  await seedModelFromSamples('Course');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/articles', () => {
  describe('Basic retrieval', () => {
    it('should return articles list with default pagination', async () => {
      const res = await request(app).get('/api/articles').expect(200);
      const body = parseAndExpectValid(ZArticleListResponse, res.body);

      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.articles.length).toBeLessThanOrEqual(10);
    });

    it('should respect custom pagination parameters', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ limit: 5, offset: 2 }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      expect(body.meta.limit).toBe(5);
      expect(body.meta.offset).toBe(2);
      expect(body.articles.length).toBeLessThanOrEqual(5);
    });

    it('should handle large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ limit: 10, offset: 100 }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      expect(body.articles).toHaveLength(0);
      expect(body.meta.offset).toBe(100);
    });

    it('should validate pagination parameters', async () => {
      const invalidParams = [
        { limit: 0 },
        { limit: -1 },
        { limit: 'invalid' },
        { limit: 101 }, // Above maximum
        { offset: -1 },
        { offset: 'invalid' },
        { offset: 101 }, // Above maximum
      ];

      for (const params of invalidParams) {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify(params))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Keyword search', () => {
    it('should search across multiple fields', async () => {
      const populatedArticles = await ArticleModel.find()
        .populate('course')
        .lean({ versionKey: false })
        .exec();

      const fuse = new Fuse(populatedArticles, {
        keys: ['title', 'course.names', 'course.lecturer', 'course.curriculum'],
        threshold: 0.6,
      });

      const testKeywords = ['醣類化學與應用', '賴喜美', 'AC5057'];
      for (const keyword of testKeywords) {
        const fuseResult = fuse.search(keyword);
        const expectedIds = fuseResult.map(item => item.item._id);

        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ keyword, limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        const actualIds = body.articles.map(article => article._id);
        expect(expectedIds).toEqual(expect.arrayContaining(actualIds));
      }
    });

    it('should return all articles when keyword is empty', async () => {
      const allRes = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ limit: 100 }))
        .expect(200);
      const allBody = parseAndExpectValid(ZArticleListResponse, allRes.body);

      const emptyRes = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ keyword: '', limit: 100 }))
        .expect(200);
      const emptyBody = parseAndExpectValid(
        ZArticleListResponse,
        emptyRes.body,
      );

      expect(emptyBody.articles.length).toBe(allBody.articles.length);
    });

    it('should return empty results for non-existent keywords', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ keyword: 'non-existent-keyword-xyz-123' }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      expect(body.articles).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });
  });

  describe('Tag filtering', () => {
    it('should filter by single tag', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ tags: ['賴喜美'], limit: 100 }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      for (const article of body.articles) {
        expect(article.tags).toContain('賴喜美');
      }
    });

    it('should filter by multiple tags', async () => {
      const testTagCombinations = [
        ['AC', '賴喜美'],
        ['AC', '賴喜美', '醣類化學與應用'],
      ];

      for (const tags of testTagCombinations) {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags, limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        for (const article of body.articles) {
          expect(tags.some(tag => article.tags.includes(tag))).toBe(true);
        }
      }
    });

    it('should return empty results for non-existent tags', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ tags: ['non-existent-tag-xyz-123'] }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      expect(body.articles).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });

    it('should return all articles when tags array is empty', async () => {
      const allRes = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ limit: 100 }))
        .expect(200);
      const allBody = parseAndExpectValid(ZArticleListResponse, allRes.body);

      const emptyTagsRes = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ tags: [], limit: 100 }))
        .expect(200);
      const emptyTagsBody = parseAndExpectValid(
        ZArticleListResponse,
        emptyTagsRes.body,
      );

      expect(emptyTagsBody.articles.length).toBe(allBody.articles.length);
    });

    it('should validate tags parameter format', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ tags: 'single-string-not-array' }))
        .expect(400);
      expectValidErrorResponse(res.body);
    });

    it('should validate keyword length constraints', async () => {
      // Test exact limit - 100 characters
      {
        const maxKeyword = 'a'.repeat(100);
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ keyword: maxKeyword }))
          .expect(200);
        parseAndExpectValid(ZArticleListResponse, res.body);
      }

      // Keyword too long (101 characters)
      {
        const tooLongKeyword = 'a'.repeat(101);
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ keyword: tooLongKeyword }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate tags query parameter constraints', async () => {
      // Test reasonable limits - 20 tags with 50 characters each to avoid URL length issues
      {
        const maxTags = Array(20).fill('a'.repeat(50));
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags: maxTags, limit: 10 }))
          .expect(200);
        parseAndExpectValid(ZArticleListResponse, res.body);
      }

      // Too many tags (51)
      {
        const tooManyTags = Array(51).fill('valid');
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags: tooManyTags }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Tag too long (51 characters)
      {
        const tooLongTag = ['a'.repeat(51)];
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags: tooLongTag }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Combined filtering', () => {
    it('should combine keyword and tag filtering', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(
          qs.stringify({ keyword: '醣類化學', tags: ['賴喜美'], limit: 100 }),
        )
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      for (const article of body.articles) {
        expect(article.tags).toContain('賴喜美');
      }
    });
  });

  describe('Embedding', () => {
    it('should support all embed combinations', async () => {
      const validEmbedOptions = [
        [],
        ['course'],
        ['creator'],
        ['content'],
        ['course', 'creator'],
        ['course', 'content'],
        ['creator', 'content'],
        ['course', 'creator', 'content'],
      ];

      for (const embed of validEmbedOptions) {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ embed, limit: 5 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);

        if (body.articles.length > 0) {
          const article = body.articles[0];

          if (embed.includes('course')) {
            parseAndExpectValid(ZCourseResponseSchema, article.course);
            expect(article.course).toBeTypeOf('object');
          } else {
            expect(article.course).toBeTypeOf('string');
          }

          if (embed.includes('creator')) {
            expect(article.creator).toBeTypeOf('object');
          } else {
            expect(article.creator).toBeTypeOf('string');
          }

          if (embed.includes('content')) {
            expect(article).toHaveProperty('content');
          } else {
            expect(article).not.toHaveProperty('content');
          }
        }
      }
    });

    it('should validate embed parameters', async () => {
      const invalidEmbedValues = [
        ['invalid'],
        ['course', 'invalid'],
        ['nonexistent'],
        ['course', 'creator', 'invalid-option'],
      ];

      for (const invalidEmbed of invalidEmbedValues) {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ embed: invalidEmbed }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should truncate content to 50 characters with ellipsis', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      const longContent =
        'A'.repeat(100) + ' This content is longer than 50 characters';
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: longContent })
        .set('gid', creator.gid)
        .expect(204);

      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ embed: ['content'], limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        const article = body.articles.find(a => a._id === articleId);
        expect(article).toBeDefined();
        expect(article!.content).toBe(longContent.substring(0, 50) + '...');
      }
    });

    it('should show empty content for articles without files', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ embed: ['content'], limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        const article = body.articles.find(a => a._id === articleId);
        expect(article).toBeDefined();
        expect(article!.content).toBe('');
      }
    });
  });
});

describe('POST /api/articles', () => {
  describe('Successful creation', () => {
    it('should create article and return article ID', async () => {
      const creator = await getTestUser();
      const articleData = await createTestArticle();

      const res = await request(app)
        .post('/api/articles')
        .send(articleData)
        .set('gid', creator.gid)
        .expect(201);

      const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
      expect(body.articleId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      // Verify created article
      {
        const res = await request(app)
          .get(`/api/articles/${body.articleId}`)
          .expect(200);
        const getBody = parseAndExpectValid(ZArticleResponse, res.body);
        expect(getBody.article).toMatchObject({
          ...articleData,
          _id: body.articleId,
          creator: creator._id,
        });
        const createdAt = new Date(getBody.article.createdAt);
        const updatedAt = new Date(getBody.article.updatedAt);
        expect(updatedAt.getTime()).toBe(createdAt.getTime());
        expect(() => createdAt.toISOString()).not.toThrow();
        expect(() => updatedAt.toISOString()).not.toThrow();
      }
    });

    it('should set authenticated user as creator', async () => {
      const creator = await getTestUser();
      const articleData = await createTestArticle();

      const res = await request(app)
        .post('/api/articles')
        .send(articleData)
        .set('gid', creator.gid)
        .expect(201);

      const body = parseAndExpectValid(ZArticleCreateResponse, res.body);

      {
        const res = await request(app)
          .get(`/api/articles/${body.articleId}`)
          .expect(200);
        const getBody = parseAndExpectValid(ZArticleResponse, res.body);
        expect(getBody.article.creator).toBe(creator._id);
      }
    });

    it('should handle Unicode content correctly', async () => {
      const creator = await getTestUser();
      const unicodeData = {
        ...(await createTestArticle()),
        title: '测试文章 🚀 العربية 日本語 한국어',
        tags: ['测试', 'العربية', '日本語', '한국어', '🏷️'],
      };

      const res = await request(app)
        .post('/api/articles')
        .send(unicodeData)
        .set('gid', creator.gid)
        .expect(201);

      const body = parseAndExpectValid(ZArticleCreateResponse, res.body);

      {
        const res = await request(app)
          .get(`/api/articles/${body.articleId}`)
          .expect(200);
        const getBody = parseAndExpectValid(ZArticleResponse, res.body);
        expect(getBody.article.title).toBe(unicodeData.title);
        expect(getBody.article.tags).toEqual(unicodeData.tags);
      }
    });

    it('should accept boundary rating values', async () => {
      const creator = await getTestUser();
      const validBase = await createTestArticle();

      const boundaryTests = [
        { sweetness: 1, chill: 1, teaching: 1, gain: 1, recommend: 1 },
        { sweetness: 5, chill: 5, teaching: 5, gain: 5, recommend: 5 },
        { sweetness: 1, chill: 3, teaching: 5, gain: 2, recommend: 4 },
      ];

      for (const ratings of boundaryTests) {
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, ratings })
          .set('gid', creator.gid)
          .expect(201);
        parseAndExpectValid(ZArticleCreateResponse, res.body);
      }
    });
  });

  describe('Input validation', () => {
    it('should require all mandatory fields', async () => {
      const creator = await getTestUser();
      const validBase = await createTestArticle();

      const requiredFields = ['title', 'tags', 'ratings', 'course'] as const;
      for (const field of requiredFields) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _, ...incompleteData } = validBase;

        const res = await request(app)
          .post('/api/articles')
          .send(incompleteData)
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate ratings constraints', async () => {
      const creator = await getTestUser();
      const validBase = await createTestArticle();

      const invalidRatings = [
        { sweetness: 0, chill: 3, teaching: 3, gain: 3, recommend: 3 },
        { sweetness: 6, chill: 3, teaching: 3, gain: 3, recommend: 3 },
        { sweetness: 3.5, chill: 3, teaching: 3, gain: 3, recommend: 3 },
        { sweetness: 3, chill: -1, teaching: 3, gain: 3, recommend: 3 },
        { sweetness: 3, chill: 3, teaching: 10, gain: 3, recommend: 3 },
      ];

      for (const ratings of invalidRatings) {
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, ratings })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate course references', async () => {
      const creator = await getTestUser();
      const validBase = await createTestArticle();

      // Non-existent course UUID
      {
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, course: randomUUID() })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid UUID format
      {
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, course: 'invalid-uuid' })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate title length constraints', async () => {
      const creator = await getTestUser();
      const validBase = await createTestArticle();

      {
        const exact = '='.repeat(40);
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, title: exact })
          .set('gid', creator.gid)
          .expect(201);
        parseAndExpectValid(ZArticleCreateResponse, res.body);
      }

      // Title longer than 40 characters
      {
        const toLong = '='.repeat(41);
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, title: toLong })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate tags constraints', async () => {
      const creator = await getTestUser();
      const validBase = await createTestArticle();

      // Test exact limits - 50 tags with 50 characters each
      {
        const maxTags = Array(50).fill('a'.repeat(50));
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, tags: maxTags })
          .set('gid', creator.gid)
          .expect(201);
        parseAndExpectValid(ZArticleCreateResponse, res.body);
      }

      // Too many tags (51)
      {
        const tooManyTags = Array(51).fill('valid');
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, tags: tooManyTags })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Tag too long (51 characters)
      {
        const tooLongTag = ['a'.repeat(51)];
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, tags: tooLongTag })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const articleData = await createTestArticle();

      // Missing auth
      {
        const res = await request(app)
          .post('/api/articles')
          .send(articleData)
          .expect(401);
        expectValidErrorResponse(res.body);
      }

      // Invalid auth
      {
        const res = await request(app)
          .post('/api/articles')
          .send(articleData)
          .set('gid', 'fake-gid-123')
          .expect(401);
        expectValidErrorResponse(res.body);
      }
    });
  });
});

describe('GET /api/articles/:articleId', () => {
  describe('Successful retrieval', () => {
    it('should return single article', async () => {
      const article = await getTestArticle();

      const res = await request(app)
        .get(`/api/articles/${article._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZArticleResponse, res.body);
      expect(body.article._id).toBe(article._id);
    });

    it('should support embed parameters', async () => {
      const article = await getTestArticle();

      const validEmbedOptions = [
        [],
        ['course'],
        ['creator'],
        ['content'],
        ['course', 'creator'],
        ['course', 'content'],
        ['creator', 'content'],
        ['course', 'creator', 'content'],
      ];

      for (const embed of validEmbedOptions) {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .query(qs.stringify({ embed }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleResponse, res.body);

        if (embed.includes('course')) {
          expect(body.article.course).toBeTypeOf('object');
          parseAndExpectValid(ZCourseResponseSchema, body.article.course);
        }
        if (embed.includes('creator')) {
          expect(body.article.creator).toBeTypeOf('object');
        }
        if (embed.includes('content')) {
          expect(body.article).toHaveProperty('content');
        }
      }
    });

    it('should handle content embedding with truncation', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      const longContent = 'A'.repeat(100) + ' This is long content for testing';
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: longContent })
        .set('gid', creator.gid)
        .expect(204);

      // Verify content truncation
      {
        const res = await request(app)
          .get(`/api/articles/${articleId}`)
          .query(qs.stringify({ embed: ['content'] }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.content).toBe(longContent.substring(0, 50) + '...');
      }

      // Verify no content without embed
      {
        const res = await request(app)
          .get(`/api/articles/${articleId}`)
          .expect(200);

        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article).not.toHaveProperty('content');
      }
    });
  });

  describe('Parameter validation', () => {
    it('should validate embed parameters', async () => {
      const article = await getTestArticle();

      const invalidEmbedValues = [
        ['invalid'],
        ['course', 'invalid'],
        ['nonexistent'],
      ];

      for (const invalidEmbed of invalidEmbedValues) {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .query(qs.stringify({ embed: invalidEmbed }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const invalidUuids = ['not-a-uuid', '123', 'invalid-format', 'abcd-efgh'];

      for (const invalidUuid of invalidUuids) {
        const res = await request(app)
          .get(`/api/articles/${invalidUuid}`)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should handle non-existent articles', async () => {
      const nonExistentId = randomUUID();

      const res = await request(app)
        .get(`/api/articles/${nonExistentId}`)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });
});

describe('PATCH /api/articles/:articleId', () => {
  describe('Successful updates', () => {
    it('should update individual fields', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      // Update title
      const newTitle = 'Updated Title';
      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({ title: newTitle })
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.title).toBe(newTitle);
      }

      // Update tags
      const newTags = ['updated', 'tags'];
      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({ tags: newTags })
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.tags).toEqual(newTags);
      }

      // Update ratings
      const newRatings = {
        sweetness: 5,
        chill: 4,
        teaching: 3,
        gain: 2,
        recommend: 1,
      };
      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({ ratings: newRatings })
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.ratings).toEqual(newRatings);
      }
    });

    it('should update multiple fields simultaneously', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      const updates = {
        title: 'Multi Update Test',
        tags: ['multi', 'update'],
        ratings: { sweetness: 5, chill: 4, teaching: 3, gain: 2, recommend: 1 },
      };

      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send(updates)
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.title).toBe(updates.title);
        expect(body.article.tags).toEqual(updates.tags);
        expect(body.article.ratings).toEqual(updates.ratings);
      }
    });

    it('should update updatedAt timestamp', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      const initialRes = await request(app)
        .get(`/api/articles/${article._id}`)
        .expect(200);

      const initialBody = parseAndExpectValid(
        ZArticleResponse,
        initialRes.body,
      );
      const initialTimestamp = new Date(
        initialBody.article.updatedAt,
      ).getTime();

      const updates = {
        title: 'Multi Update Test',
        tags: ['multi', 'update'],
        ratings: { sweetness: 5, chill: 4, teaching: 3, gain: 2, recommend: 1 },
      };

      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send(updates)
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(new Date(body.article.updatedAt).getTime()).toBeGreaterThan(
          initialTimestamp,
        );
      }
    });

    it('should handle empty updates', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({})
        .set('gid', creator!.gid)
        .expect(204);
    });
  });

  describe('Input validation', () => {
    it('should validate ratings constraints', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      const invalidRatings = [
        { ratings: { sweetness: 0 } },
        { ratings: { sweetness: 6 } },
        { ratings: { chill: -1 } },
        { ratings: { teaching: 10 } },
      ];

      for (const invalidUpdate of invalidRatings) {
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send(invalidUpdate)
          .set('gid', creator!.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate title length constraints', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      {
        const exact = '='.repeat(40);
        await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ title: exact })
          .set('gid', creator!.gid)
          .expect(204);
      }

      {
        const toLong = '='.repeat(41);
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ title: toLong })
          .set('gid', creator!.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const creator = await getTestUser();

      const res = await request(app)
        .patch('/api/articles/invalid-uuid')
        .send({ title: 'test' })
        .set('gid', creator.gid)
        .expect(400);
      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent articles', async () => {
      const creator = await getTestUser();

      const res = await request(app)
        .patch(`/api/articles/${randomUUID()}`)
        .send({ title: 'test' })
        .set('gid', creator.gid)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });

  describe('Authentication and authorization', () => {
    it('should require authentication', async () => {
      const article = await getTestArticle();

      // Missing auth
      {
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ title: 'test' })
          .expect(401);
        expectValidErrorResponse(res.body);
      }

      // Invalid auth
      {
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ title: 'test' })
          .set('gid', 'fake-gid-123')
          .expect(401);
        expectValidErrorResponse(res.body);
      }
    });

    it('should enforce creator-only authorization', async () => {
      const article = await getTestArticle();
      const nonCreator = await UserModel.findOne({
        _id: { $ne: article.creator },
      })
        .lean({ versionKey: false })
        .exec();

      if (nonCreator) {
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ title: 'test' })
          .set('gid', nonCreator.gid)
          .expect(403);
        expectValidErrorResponse(res.body);
      }
    });

    it('should allow creator to update their article', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({ title: 'Creator can update' })
        .set('gid', creator!.gid)
        .expect(204);
    });
  });
});

describe('GET /api/articles/:articleId/file', () => {
  describe('Successful retrieval', () => {
    it('should return file content', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      const testContent = '# Test Article\n\nThis is test content.';
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: testContent })
        .set('gid', creator.gid)
        .expect(204);

      const res = await request(app)
        .get(`/api/articles/${articleId}/file`)
        .expect(200);

      const body = parseAndExpectValid(ZFileResponse, res.body);
      expect(body.file).toBe(testContent);
    });

    it('should return empty string for articles without files', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      const res = await request(app)
        .get(`/api/articles/${articleId}/file`)
        .expect(200);

      const body = parseAndExpectValid(ZFileResponse, res.body);
      expect(body.file).toBe('');
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const res = await request(app)
        .get('/api/articles/invalid-uuid/file')
        .expect(400);
      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent articles', async () => {
      const res = await request(app)
        .get(`/api/articles/${randomUUID()}/file`)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });
});

describe('PUT /api/articles/:articleId/file', () => {
  describe('Successful file operations', () => {
    it('should upload and update file content and timestamp', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      const initialRes = await request(app)
        .get(`/api/articles/${articleId}`)
        .expect(200);

      const initialBody = parseAndExpectValid(
        ZArticleResponse,
        initialRes.body,
      );
      const initialTimestamp = new Date(
        initialBody.article.updatedAt,
      ).getTime();

      // Upload content
      const initialContent =
        '# Initial Content\n\nThis is the initial content.';
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: initialContent })
        .set('gid', creator.gid)
        .expect(204);

      // sleep for 1 second to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify content
      {
        const fileRes = await request(app)
          .get(`/api/articles/${articleId}/file`)
          .expect(200);
        const body = parseAndExpectValid(ZFileResponse, fileRes.body);
        expect(body.file).toBe(initialContent);

        const articleRes = await request(app)
          .get(`/api/articles/${articleId}`)
          .expect(200);
        const articleBody = parseAndExpectValid(
          ZArticleResponse,
          articleRes.body,
        );
        expect(
          new Date(articleBody.article.updatedAt).getTime(),
        ).toBeGreaterThan(initialTimestamp);
      }

      // Update content
      const updatedContent =
        '# Updated Content\n\nThis is the updated content.';
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: updatedContent })
        .set('gid', creator.gid)
        .expect(204);

      // Verify updated content
      {
        const res = await request(app)
          .get(`/api/articles/${articleId}/file`)
          .expect(200);
        const body = parseAndExpectValid(ZFileResponse, res.body);
        expect(body.file).toBe(updatedContent);
      }
    });

    it('should handle various content types', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      const contentTypes = [
        '# Simple markdown',
        '測試中文內容 🚀',
        'Line 1\nLine 2\nLine 3',
        '',
        'Special chars: !@#$%^&*()_+-=[]{}|;:",.<>?',
      ];

      for (const content of contentTypes) {
        await request(app)
          .put(`/api/articles/${articleId}/file`)
          .send({ file: content })
          .set('gid', creator.gid)
          .expect(204);

        const res = await request(app)
          .get(`/api/articles/${articleId}/file`)
          .expect(200);
        const body = parseAndExpectValid(ZFileResponse, res.body);
        expect(body.file).toBe(content);
      }
    });

    it('should integrate with content embedding', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      const longContent =
        'A'.repeat(100) + ' This is a very long content for testing truncation';
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: longContent })
        .set('gid', creator.gid)
        .expect(204);

      // Verify content embedding truncation
      {
        const res = await request(app)
          .get(`/api/articles/${articleId}`)
          .query(qs.stringify({ embed: ['content'] }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.content).toBe(longContent.substring(0, 50) + '...');
      }
    });
  });

  describe('Input validation', () => {
    it('should validate request body', async () => {
      const creator = await getTestUser();
      const article = await getTestArticle();

      // Missing file property
      {
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({})
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid file types
      const invalidFileTypes = [
        { file: 123 },
        { file: null },
        { file: undefined },
        { file: [] },
        { file: {} },
        { file: true },
      ];

      for (const invalidBody of invalidFileTypes) {
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send(invalidBody)
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate file content length constraints', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      // Test exact limit - 1,000,000 characters
      {
        const maxContent = 'a'.repeat(1000000);
        await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: maxContent })
          .set('gid', creator!.gid)
          .expect(204);
      }

      // Content too long (1,000,001 characters)
      {
        const tooLongContent = 'a'.repeat(1000001);
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: tooLongContent })
          .set('gid', creator!.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should allow extra properties', async () => {
      const creator = await getTestUser();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(await createTestArticle())
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: 'valid content', extraProperty: 'ignored' })
        .set('gid', creator.gid)
        .expect(204);
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const creator = await getTestUser();

      const res = await request(app)
        .put('/api/articles/invalid-uuid/file')
        .send({ file: 'test' })
        .set('gid', creator.gid)
        .expect(400);
      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent articles', async () => {
      const creator = await getTestUser();

      const res = await request(app)
        .put(`/api/articles/${randomUUID()}/file`)
        .send({ file: 'test' })
        .set('gid', creator.gid)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });

  describe('Authentication and authorization', () => {
    it('should require authentication', async () => {
      const article = await getTestArticle();

      // Missing auth
      {
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: 'test' })
          .expect(401);
        expectValidErrorResponse(res.body);
      }

      // Invalid auth
      {
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: 'test' })
          .set('gid', 'fake-gid-123')
          .expect(401);
        expectValidErrorResponse(res.body);
      }
    });

    it('should enforce creator-only authorization', async () => {
      const article = await getTestArticle();
      const nonCreator = await UserModel.findOne({
        _id: { $ne: article.creator },
      })
        .lean({ versionKey: false })
        .exec();

      if (nonCreator) {
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: 'test' })
          .set('gid', nonCreator.gid)
          .expect(403);
        expectValidErrorResponse(res.body);
      }
    });

    it('should allow creator to upload files', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      await request(app)
        .put(`/api/articles/${article._id}/file`)
        .send({ file: 'Creator can upload' })
        .set('gid', creator!.gid)
        .expect(204);
    });
  });
});
