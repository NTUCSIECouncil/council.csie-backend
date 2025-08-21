import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import Fuse from 'fuse.js';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { env } from '@/config.ts';
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

const ZArticleCreateResponse = z.object({
  articleId: ZUuidSchema,
});

const ZArticleResponse = z.object({
  article: ZArticleResponseSchema,
});

const ZFileResponse = z.object({
  file: z.string(),
});

const genArticleCreate = async () => {
  const course = await getTestCourse();
  return {
    title: 'Test Article',
    tags: ['test'],
    ratings: genRatings(),
    course: course._id,
  };
};

const genRatings = () => {
  return { sweetness: 3, chill: 3, teaching: 3, gain: 3, recommend: 3 };
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
  describe('Basic functionality', () => {
    it('should return articles list with correct response structure', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ limit: 5 }))
        .expect(200);

      parseAndExpectValid(ZArticleListResponse, res.body);
    });

    it('should use default pagination values (limit: 10, offset: 0)', async () => {
      const res = await request(app).get('/api/articles').expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.articles.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty result sets correctly', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ tags: ['nonexistent-tag-xyz-123'] }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      expect(body.articles).toHaveLength(0);
      expect(body.meta.total).toBe(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly with proper page separation', async () => {
      const total = await ArticleModel.countDocuments().exec();

      // Test first page
      let body;
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit: 5, offset: 0 }))
          .expect(200);

        body = parseAndExpectValid(ZArticleListResponse, res.body);
        expect(body.meta).toEqual({ total, limit: 5, offset: 0 });
        expect(body.articles.length).toBeLessThanOrEqual(5);
      }

      if (total > 5) {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit: 5, offset: 5 }))
          .expect(200);

        const secondPageBody = parseAndExpectValid(
          ZArticleListResponse,
          res.body,
        );
        expect(secondPageBody.meta).toEqual({ total, limit: 5, offset: 5 });

        // Ensure no overlap between pages
        const firstPageIds = body.articles.map(a => a._id);
        const secondPageIds = secondPageBody.articles.map(a => a._id);
        expect(firstPageIds.filter(id => secondPageIds.includes(id))).toEqual(
          [],
        );
      }
    });

    it('should match default pagination with explicit values', async () => {
      let defaultPagBody;
      {
        const res = await request(app).get('/api/articles').expect(200);
        defaultPagBody = parseAndExpectValid(ZArticleListResponse, res.body);
      }
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit: 10, offset: 0 }))
          .expect(200);
        expect(parseAndExpectValid(ZArticleListResponse, res.body)).toEqual(
          defaultPagBody,
        );
      }
    });

    it('should handle large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      expect(body.articles).toHaveLength(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(999999);
    });
  });

  describe('Search and filtering', () => {
    it('should support fuzzy keyword search across multiple fields', async () => {
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

    it('should handle edge cases in keyword search', async () => {
      // Empty keyword should return all articles (no filtering)
      {
        const allArticlesRes = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit: 1000 }))
          .expect(200);
        const allArticles = parseAndExpectValid(
          ZArticleListResponse,
          allArticlesRes.body,
        );

        const emptyKeywordRes = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ keyword: '', limit: 1000 }))
          .expect(200);
        const emptyKeywordArticles = parseAndExpectValid(
          ZArticleListResponse,
          emptyKeywordRes.body,
        );

        expect(emptyKeywordArticles.articles.length).toBe(
          allArticles.articles.length,
        );
      }

      // Non-existent keyword should return empty results
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ keyword: 'nonexistent-keyword-xyz-987654321' }))
          .expect(200);
        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        expect(body.articles).toHaveLength(0);
        expect(body.meta.total).toBe(0);
      }
    });

    it('should support tag filtering with intersection behavior', async () => {
      const testTagCombinations = [
        ['賴喜美'],
        ['AC', '賴喜美'],
        ['AC', '賴喜美', '醣類化學與應用'],
      ];

      for (const tags of testTagCombinations) {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags, limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);

        // All returned articles should contain ALL specified tags (intersection behavior)
        for (const article of body.articles) {
          expect(article.tags).toEqual(expect.arrayContaining(tags));
        }
      }
    });

    it('should handle edge cases in tag filtering', async () => {
      // Single tag filtering
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags: ['賴喜美'], limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        for (const article of body.articles) {
          expect(article.tags).toContain('賴喜美');
        }
      }

      // Non-existent tags should return empty results
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags: ['nonexistent-tag-xyz-123'] }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        expect(body.articles).toHaveLength(0);
        expect(body.meta.total).toBe(0);
      }

      // Empty tags array should return all articles
      {
        const allArticlesRes = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit: 1000 }))
          .expect(200);
        const allArticles = parseAndExpectValid(
          ZArticleListResponse,
          allArticlesRes.body,
        );

        const emptyTagsRes = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags: [], limit: 1000 }))
          .expect(200);
        const emptyTagsArticles = parseAndExpectValid(
          ZArticleListResponse,
          emptyTagsRes.body,
        );

        expect(emptyTagsArticles.articles.length).toBe(
          allArticles.articles.length,
        );
      }
    });

    it('should combine keyword and tag filtering correctly', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(
          qs.stringify({
            keyword: '物理',
            tags: ['賴喜美'],
            limit: 50,
          }),
        )
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);

      // All articles should contain the specified tags
      for (const article of body.articles) {
        expect(article.tags).toContain('賴喜美');
      }
    });
  });

  describe('Embedding related resources', () => {
    it('should support various embed parameter combinations', async () => {
      const validEmbedOptions = [
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
          .query(qs.stringify({ embed, limit: 1 }))
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

    it('should handle content truncation when embedding content', async () => {
      const creator = await getTestUser();

      // Create article and upload long content
      const articleData = await genArticleCreate();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(articleData)
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      // Upload long content (>50 chars) - should be truncated with ellipsis
      const longContent =
        'This is a long content that exceeds fifty characters and should be truncated with ellipsis.';
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: longContent })
        .set('gid', creator.gid)
        .expect(204);

      // Verify truncation in list endpoint with content embedding
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ embed: ['content'], limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        const testArticle = body.articles.find(a => a._id === articleId);
        expect(testArticle).toBeDefined();
        expect(testArticle?.content).toBe(longContent.substring(0, 50) + '...');
      }

      // Test exact 50 character content (no truncation expected)
      const exactContent = 'x'.repeat(50);
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: exactContent })
        .set('gid', creator.gid)
        .expect(204);

      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ embed: ['content'], limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        const testArticle = body.articles.find(a => a._id === articleId);
        expect(testArticle?.content).toBe(exactContent); // No ellipsis for exactly 50 chars
      }

      // Test when no file exists - content should be empty string
      const noFileArticle = await genArticleCreate();

      let noFileArticleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(noFileArticle)
          .set('gid', creator.gid)
          .expect(201);

        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        noFileArticleId = body.articleId;
      }

      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ embed: ['content'], limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        const testArticle = body.articles.find(a => a._id === noFileArticleId);
        expect(testArticle?.content).toBe('');
      }
    });

    it('should not include content field when embed=content is not specified', async () => {
      const res = await request(app)
        .get('/api/articles')
        .query(qs.stringify({ limit: 1 }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleListResponse, res.body);
      if (body.articles.length > 0) {
        expect(body.articles[0]).not.toHaveProperty('content');
      }
    });
  });

  describe('Parameter validation', () => {
    it('should validate pagination parameters correctly', async () => {
      // Invalid limit types
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit: 'invalid' }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid offset types
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ offset: 'invalid' }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Boundary validation (limit minimum 1, offset minimum 0)
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit: 0 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ offset: -1 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Large values should return empty results gracefully
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ limit: 999999, offset: 999999 }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleListResponse, res.body);
        expect(body.articles).toHaveLength(0);
      }
    });

    it('should validate embed parameters', async () => {
      // Invalid embed values
      const invalidEmbedValues = [
        ['invalid'],
        ['course', 'invalid'],
        ['invalid-option'],
      ];

      for (const invalidEmbed of invalidEmbedValues) {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ embed: invalidEmbed }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate tags parameter format', async () => {
      // Non-array tags
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags: 'single-string-not-array' }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Empty tags array should work
      {
        const res = await request(app)
          .get('/api/articles')
          .query(qs.stringify({ tags: [] }))
          .expect(200);
        parseAndExpectValid(ZArticleListResponse, res.body);
      }
    });
  });
});

describe('POST /api/articles', () => {
  describe('Article creation', () => {
    it('should create article successfully and return articleId', async () => {
      const creator = await getTestUser();
      const articleCreate = await genArticleCreate();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(articleCreate)
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      // Verify article was created correctly
      {
        const res = await request(app)
          .get(`/api/articles/${articleId}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article).toEqual({
          ...articleCreate,
          _id: articleId,
          creator: creator._id,
        });
      }
    });

    it('should handle Unicode content correctly', async () => {
      const creator = await getTestUser();
      const unicodeContent = {
        ...(await genArticleCreate()),
        title: '测试文章 🚀 العربية 日本語 한국어',
        tags: ['测试', 'العربية', '日本語', '한국어', '🏷️'],
      };

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(unicodeContent)
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      {
        const res = await request(app)
          .get(`/api/articles/${articleId}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.title).toBe(unicodeContent.title);
        expect(body.article.tags).toEqual(unicodeContent.tags);
      }
    });

    it('should set authenticated user as creator', async () => {
      const creator = await getTestUser();
      const articleCreate = await genArticleCreate();

      const res = await request(app)
        .post('/api/articles')
        .send(articleCreate)
        .set('gid', creator.gid)
        .expect(201);

      const body = parseAndExpectValid(ZArticleCreateResponse, res.body);

      // Verify creator is set correctly
      const articleRes = await request(app)
        .get(`/api/articles/${body.articleId}`)
        .expect(200);
      const articleBody = parseAndExpectValid(
        ZArticleResponse,
        articleRes.body,
      );
      expect(articleBody.article.creator).toBe(creator._id);
    });
  });

  describe('Input validation', () => {
    it('should validate all required fields are present', async () => {
      const creator = await getTestUser();
      const validBase = await genArticleCreate();

      // Test each required field individually
      const requiredFields = ['title', 'tags', 'ratings', 'course'] as const;
      for (const field of requiredFields) {
        const incompleteData = { ...validBase, [field]: undefined };

        const res = await request(app)
          .post('/api/articles')
          .send(incompleteData)
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test null values for required fields
      for (const field of requiredFields) {
        const nullData = { ...validBase, [field]: null };

        const res = await request(app)
          .post('/api/articles')
          .send(nullData)
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate field data types', async () => {
      const creator = await getTestUser();
      const validBase = await genArticleCreate();

      // Test invalid data types
      const invalidTypeTests = [
        { field: 'title', value: null },
        { field: 'title', value: 123 },
        { field: 'title', value: [] },
        { field: 'tags', value: 'not-an-array' },
        { field: 'tags', value: null },
        { field: 'tags', value: 123 },
        { field: 'course', value: 123 },
        { field: 'course', value: null },
        { field: 'course', value: [] },
        { field: 'ratings', value: 'invalid' },
        { field: 'ratings', value: null },
        { field: 'ratings', value: [] },
      ];

      for (const test of invalidTypeTests) {
        const invalidData = { ...validBase, [test.field]: test.value };

        const res = await request(app)
          .post('/api/articles')
          .send(invalidData)
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate ratings constraints (1-5 integers)', async () => {
      const creator = await getTestUser();
      const validBase = await genArticleCreate();
      const validRatings = genRatings();

      // Test invalid rating values - must be integers between 1 and 5
      const invalidValues = [
        0,
        6,
        -1,
        10,
        1.5,
        4.2,
        'invalid',
        null,
        undefined,
        true,
        [],
      ];
      const ratingFields = [
        'sweetness',
        'chill',
        'teaching',
        'gain',
        'recommend',
      ] as const;

      for (const field of ratingFields) {
        for (const invalidValue of invalidValues) {
          const invalidRatings = { ...validRatings, [field]: invalidValue };

          const res = await request(app)
            .post('/api/articles')
            .send({ ...validBase, ratings: invalidRatings })
            .set('gid', creator.gid)
            .expect(400);
          expectValidErrorResponse(res.body);
        }
      }

      // Test missing rating fields - all fields are required
      for (const field of ratingFields) {
        const incompleteRatings = { ...validRatings, [field]: undefined };

        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, ratings: incompleteRatings })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test valid boundary values (1 and 5 should be accepted)
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

    it('should validate course references', async () => {
      const creator = await getTestUser();
      const validBase = await genArticleCreate();

      // Invalid UUID format
      {
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, course: 'invalid-uuid' })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Non-existent course UUID
      {
        const res = await request(app)
          .post('/api/articles')
          .send({ ...validBase, course: randomUUID() })
          .set('gid', creator.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Authentication', () => {
    it('should require valid authentication', async () => {
      const validArticle = await genArticleCreate();

      // Missing authentication
      {
        const res = await request(app)
          .post('/api/articles')
          .send(validArticle)
          .expect(401);
        expectValidErrorResponse(res.body);
      }

      // Invalid/fake Google ID
      {
        const res = await request(app)
          .post('/api/articles')
          .send(validArticle)
          .set('gid', 'fake-google-id-12345')
          .expect(401);
        expectValidErrorResponse(res.body);
      }

      // Empty authentication header
      {
        const res = await request(app)
          .post('/api/articles')
          .send(validArticle)
          .set('gid', '')
          .expect(401);
        expectValidErrorResponse(res.body);
      }
    });
  });
});

describe('GET /api/articles/:articleId', () => {
  describe('Article retrieval', () => {
    it('should return single article with correct response structure', async () => {
      const article = await getTestArticle();

      const res = await request(app)
        .get(`/api/articles/${article._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZArticleResponse, res.body);
      expect(body.article).toEqual(article);
    });

    it('should support embed parameters correctly', async () => {
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
        const articleData = body.article;

        if (embed.includes('course')) {
          parseAndExpectValid(ZCourseResponseSchema, articleData.course);
          expect(articleData.course).toBeTypeOf('object');
        } else {
          expect(articleData.course).toBeTypeOf('string');
        }

        if (embed.includes('creator')) {
          expect(articleData.creator).toBeTypeOf('object');
        } else {
          expect(articleData.creator).toBeTypeOf('string');
        }

        if (embed.includes('content')) {
          expect(articleData).toHaveProperty('content');
        } else {
          expect(articleData).not.toHaveProperty('content');
        }
      }
    });

    it('should handle content truncation when embedding content', async () => {
      const creator = await getTestUser();

      // Create article and upload content
      const articleData = await genArticleCreate();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(articleData)
          .set('gid', creator.gid)
          .expect(201);
        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      // Upload long content and verify truncation
      const longContent =
        'This is a long content that exceeds fifty characters and should be truncated with ellipsis.';
      await request(app)
        .put(`/api/articles/${articleId}/file`)
        .send({ file: longContent })
        .set('gid', creator.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${articleId}`)
          .query(qs.stringify({ embed: ['content'] }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.content).toBe(longContent.substring(0, 50) + '...');
      }
    });

    it('should not include content field when embed=content is not specified', async () => {
      const article = await getTestArticle();

      // Without content embedding
      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .expect(200);

        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article).not.toHaveProperty('content');
      }

      // With other embeddings but not content
      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .query(qs.stringify({ embed: ['course', 'creator'] }))
          .expect(200);

        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article).not.toHaveProperty('content');
      }
    });
  });

  describe('Parameter validation', () => {
    it('should validate embed parameters', async () => {
      const article = await getTestArticle();

      // Invalid embed values
      const invalidEmbedValues = [
        ['invalid'],
        ['course', 'invalid'],
        ['nonexistent'],
        ['course', 'creator', 'invalid-option'],
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
      // Invalid UUID formats
      const invalidUuids = [
        'not-a-uuid',
        '123',
        'invalid-uuid-format',
        'abcd-efgh-ijkl',
      ];
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
  describe('Article updates', () => {
    it('should support partial updates for individual fields', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      // Test title update
      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({ title: '不普通物理學' })
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.title).toBe('不普通物理學');
      }

      // Test tags update
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

      // Test ratings update
      const newRatings = genRatings();
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

    it('should support multiple field updates in single request', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({
          title: 'Multi Update Test',
          tags: ['multi', 'update'],
        })
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}`)
          .expect(200);
        const body = parseAndExpectValid(ZArticleResponse, res.body);
        expect(body.article.title).toBe('Multi Update Test');
        expect(body.article.tags).toEqual(['multi', 'update']);
      }
    });

    it('should handle empty updates as no-op', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      // Empty body should be allowed (no-op)
      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({})
        .set('gid', creator!.gid)
        .expect(204);
    });
  });

  describe('Input validation', () => {
    it('should validate data type constraints', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      // Invalid title type
      {
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ title: null })
          .set('gid', creator!.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid tags format
      {
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ tags: 'not-an-array' })
          .set('gid', creator!.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate ratings constraints', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      // Invalid rating values (should be 1-5)
      {
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ ratings: { sweetness: 6 } })
          .set('gid', creator!.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      {
        const res = await request(app)
          .patch(`/api/articles/${article._id}`)
          .send({ ratings: { sweetness: 0 } })
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
        .send({ title: 'Test' })
        .set('gid', creator.gid)
        .expect(400);
      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent articles', async () => {
      const creator = await getTestUser();

      const res = await request(app)
        .patch(`/api/articles/${randomUUID()}`)
        .send({ title: 'Test' })
        .set('gid', creator.gid)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });

  describe('Authentication and authorization', () => {
    it('should require authentication', async () => {
      const article = await getTestArticle();

      const res = await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({ title: 'Test' })
        .expect(401);
      expectValidErrorResponse(res.body);
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
          .send({ title: 'Test' })
          .set('gid', nonCreator.gid)
          .expect(403);
        expectValidErrorResponse(res.body);
      }
    });

    it('should allow creator to update their own article', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      await request(app)
        .patch(`/api/articles/${article._id}`)
        .send({ title: 'Updated by Creator' })
        .set('gid', creator!.gid)
        .expect(204);
    });
  });
});

describe('GET /api/articles/:articleId/file', () => {
  describe('File retrieval', () => {
    it('should return file content with correct response structure', async () => {
      const article = await getTestArticle();

      const res = await request(app)
        .get(`/api/articles/${article._id}/file`)
        .expect(200);

      const body = parseAndExpectValid(ZFileResponse, res.body);
      expect(typeof body.file).toBe('string');

      // Verify file content matches what's on disk if file exists
      try {
        const diskData = await fs.readFile(
          path.join(env.UPLOADS_DIR, 'articles', `${article._id}.md`),
          'utf-8',
        );
        expect(body.file).toBe(diskData);
      } catch {
        // File doesn't exist, should return empty string
        expect(body.file).toBe('');
      }
    });

    it('should return empty string for articles without uploaded files', async () => {
      const creator = await getTestUser();

      // Create article without uploading file
      const articleCreate = await genArticleCreate();

      let articleId: string;
      {
        const res = await request(app)
          .post('/api/articles')
          .send(articleCreate)
          .set('gid', creator.gid)
          .expect(201);

        const body = parseAndExpectValid(ZArticleCreateResponse, res.body);
        articleId = body.articleId;
      }

      {
        const res = await request(app)
          .get(`/api/articles/${articleId}/file`)
          .expect(200);

        const body = parseAndExpectValid(ZFileResponse, res.body);
        expect(body.file).toBe('');
      }
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
  describe('File upload and updates', () => {
    it('should upload and update file content successfully', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      // Upload initial content
      const content = '這是測試內容';
      await request(app)
        .put(`/api/articles/${article._id}/file`)
        .send({ file: content })
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}/file`)
          .expect(200);

        const body = parseAndExpectValid(ZFileResponse, res.body);
        expect(body.file).toBe(content);
      }

      // Update with new content
      const newContent = '更新的內容';
      await request(app)
        .put(`/api/articles/${article._id}/file`)
        .send({ file: newContent })
        .set('gid', creator!.gid)
        .expect(204);

      {
        const res = await request(app)
          .get(`/api/articles/${article._id}/file`)
          .expect(200);

        const body = parseAndExpectValid(ZFileResponse, res.body);
        expect(body.file).toBe(newContent);
      }
    });

    it('should handle various content types and encodings', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      const contentTests = [
        {
          name: 'empty content',
          content: '',
          expected: '',
        },
        {
          name: 'Unicode content with emojis',
          content: '測試中文內容 🚀 with émojis and spéçial chars',
          expected: '測試中文內容 🚀 with émojis and spéçial chars',
        },
        {
          name: 'Markdown content',
          content:
            '# Heading\n\n```javascript\nconsole.log("test");\n```\n\n- List item\n- Another item',
          expected:
            '# Heading\n\n```javascript\nconsole.log("test");\n```\n\n- List item\n- Another item',
        },
        {
          name: 'Large content',
          content: 'x'.repeat(10000),
          expected: 'x'.repeat(10000),
        },
        {
          name: 'Content with newlines and special characters',
          content:
            'Line 1\nLine 2\r\nLine 3\t\tTabbed\n\n"Quoted text" and \'single quotes\'',
          expected:
            'Line 1\nLine 2\r\nLine 3\t\tTabbed\n\n"Quoted text" and \'single quotes\'',
        },
      ];

      for (const test of contentTests) {
        // Upload content
        await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: test.content })
          .set('gid', creator!.gid)
          .expect(204);

        // Verify content was stored correctly
        const res = await request(app)
          .get(`/api/articles/${article._id}/file`)
          .expect(200);

        const body = parseAndExpectValid(ZFileResponse, res.body);
        expect(body.file).toBe(test.expected);
      }
    });

    it('should integrate correctly with content embedding', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      const fileContent =
        '# Test Article\n\nThis is a test article with some content that should be truncated.';
      await request(app)
        .put(`/api/articles/${article._id}/file`)
        .send({ file: fileContent })
        .set('gid', creator!.gid)
        .expect(204);

      // Verify content truncation when embedding (first 50 chars + ...)
      const res = await request(app)
        .get(`/api/articles/${article._id}`)
        .query(qs.stringify({ embed: ['content'] }))
        .expect(200);

      const body = parseAndExpectValid(ZArticleResponse, res.body);
      expect(body.article.content).toBe(fileContent.substring(0, 50) + '...');
    });
  });

  describe('Input validation', () => {
    it('should validate request body structure', async () => {
      const article = await getTestArticle();
      const creator = await UserModel.findById(article.creator)
        .lean({ versionKey: false })
        .exec();

      // Missing file property
      {
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({})
          .set('gid', creator!.gid)
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
          .set('gid', creator!.gid)
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Extra properties should be allowed (but ignored)
      {
        await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: 'valid content', extraProperty: 'should be ignored' })
          .set('gid', creator!.gid)
          .expect(204);
      }
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

      // Missing authentication
      {
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: 'test' })
          .expect(401);
        expectValidErrorResponse(res.body);
      }

      // Invalid authentication
      {
        const res = await request(app)
          .put(`/api/articles/${article._id}/file`)
          .send({ file: 'test' })
          .set('gid', 'fake-google-id-12345')
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
        .send({ file: 'valid upload by creator' })
        .set('gid', creator!.gid)
        .expect(204);
    });
  });
});
