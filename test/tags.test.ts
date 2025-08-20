import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ArticleModel } from '@models/article-schema.ts';
import app from './app.ts';
import { ZMetaSchema } from './response-schemas.ts';
import { expectValidErrorResponse, parseAndExpectValid, seedModelFromSamples } from './utils.ts';

const ZTagsListResponse = z.object({
  tags: z.string().array(),
  meta: ZMetaSchema,
});

beforeEach(async () => {
  await seedModelFromSamples('Article');
  await seedModelFromSamples('User');
  await seedModelFromSamples('Course');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/tags', () => {
  describe('Basic functionality', () => {
    it('should return tags list with correct response structure', async () => {
      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 5 }))
        .expect(200);
      parseAndExpectValid(ZTagsListResponse, res.body);
    });

    it('should use default pagination values (limit: 10, offset: 0)', async () => {
      const res = await request(app)
        .get('/api/tags')
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.tags.length).toBeLessThanOrEqual(10);
    });

    it('should return unique tags only', async () => {
      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);

      // Verify no duplicate tags
      const uniqueTags = [...new Set(body.tags)];
      expect(body.tags).toEqual(uniqueTags);
    });

    it('should handle empty result sets correctly when no articles exist', async () => {
      // Clear all articles
      await ArticleModel.deleteMany({}).exec();

      const res = await request(app)
        .get('/api/tags')
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      expect(body.tags).toHaveLength(0);
      expect(body.meta.total).toBe(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly with proper page separation', async () => {
      // Get total tags count first
      const allTagsRes = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);
      const allTagsBody = parseAndExpectValid(ZTagsListResponse, allTagsRes.body);
      const total = allTagsBody.meta.total;

      if (total > 5) {
        // Test first page
        let body;
        {
          const res = await request(app)
            .get('/api/tags')
            .query(qs.stringify({ limit: 5, offset: 0 }))
            .expect(200);

          body = parseAndExpectValid(ZTagsListResponse, res.body);
          expect(body.meta).toEqual({ total, limit: 5, offset: 0 });
          expect(body.tags.length).toBeLessThanOrEqual(5);
        }

        // Test second page - should have different tags
        {
          const res = await request(app)
            .get('/api/tags')
            .query(qs.stringify({ limit: 5, offset: 5 }))
            .expect(200);

          const secondPageBody = parseAndExpectValid(ZTagsListResponse, res.body);
          expect(secondPageBody.meta).toEqual({ total, limit: 5, offset: 5 });

          // Verify no overlap between pages (since tags are sorted)
          const firstPageTags = new Set(body.tags);
          const secondPageTags = new Set(secondPageBody.tags);
          const intersection = new Set([...firstPageTags].filter(tag => secondPageTags.has(tag)));
          expect(intersection.size).toBe(0);
        }
      }
    });

    it('should match default pagination with explicit values', async () => {
      let defaultPagBody;
      {
        const res = await request(app)
          .get('/api/tags')
          .expect(200);
        defaultPagBody = parseAndExpectValid(ZTagsListResponse, res.body);
      }
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 10, offset: 0 }))
          .expect(200);
        expect(parseAndExpectValid(ZTagsListResponse, res.body)).toEqual(defaultPagBody);
      }
    });

    it('should handle large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      expect(body.tags).toHaveLength(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(999999);
    });

    it('should handle edge case where offset equals total', async () => {
      // Get total tags count
      const allTagsRes = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);
      const total = parseAndExpectValid(ZTagsListResponse, allTagsRes.body).meta.total;

      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 10, offset: total }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      expect(body.tags).toHaveLength(0);
      expect(body.meta.total).toBe(total);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(total);
    });
  });

  describe('Data consistency', () => {
    it('should reflect all unique tags from existing articles', async () => {
      // Get all articles and extract unique tags manually
      const articles = await ArticleModel.find({}, { tags: 1 }).lean().exec();
      const expectedTags = [...new Set(articles.flatMap(article => article.tags))].sort();

      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);

      expect(body.tags.sort()).toEqual(expectedTags);
      expect(body.meta.total).toBe(expectedTags.length);
    });

    it('should correctly count total tags across all pages', async () => {
      // Get total from meta
      const firstPageRes = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 5 }))
        .expect(200);
      const total = parseAndExpectValid(ZTagsListResponse, firstPageRes.body).meta.total;

      // Collect all tags across all pages
      const allCollectedTags: string[] = [];
      let offset = 0;
      const limit = 5;

      while (offset < total) {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit, offset }))
          .expect(200);

        const body = parseAndExpectValid(ZTagsListResponse, res.body);
        allCollectedTags.push(...body.tags);
        offset += limit;
      }

      expect(allCollectedTags.length).toBe(total);

      // Verify no duplicates across pages
      const uniqueCollectedTags = [...new Set(allCollectedTags)];
      expect(uniqueCollectedTags.length).toBe(total);
    });
  });

  describe('Parameter validation', () => {
    it('should validate pagination parameters correctly', async () => {
      // Test negative limit
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: -1 }))
          .expect(400);

        expectValidErrorResponse(res.body);
      }

      // Test zero limit
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 0 }))
          .expect(400);

        expectValidErrorResponse(res.body);
      }

      // Test negative offset
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ offset: -1 }))
          .expect(400);

        expectValidErrorResponse(res.body);
      }

      // Test non-integer limit
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 'invalid' }))
          .expect(400);

        expectValidErrorResponse(res.body);
      }

      // Test non-integer offset
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ offset: 'invalid' }))
          .expect(400);

        expectValidErrorResponse(res.body);
      }
    });

    it('should ignore unknown query parameters', async () => {
      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({
          limit: 5,
          offset: 0,
          unknownParam: 'should-be-ignored',
          anotherParam: 123,
        }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      expect(body.meta.limit).toBe(5);
      expect(body.meta.offset).toBe(0);
    });

    it('should handle boundary values for pagination parameters', async () => {
      // Test very large limit
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 999999 }))
          .expect(200);

        parseAndExpectValid(ZTagsListResponse, res.body);
      }

      // Test minimum valid values
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 1, offset: 0 }))
          .expect(200);

        const body = parseAndExpectValid(ZTagsListResponse, res.body);
        expect(body.meta.limit).toBe(1);
        expect(body.meta.offset).toBe(0);
        expect(body.tags.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should return consistent results on repeated requests', async () => {
      const query = qs.stringify({ limit: 10, offset: 0 });

      const res1 = await request(app)
        .get('/api/tags')
        .query(query)
        .expect(200);

      const res2 = await request(app)
        .get('/api/tags')
        .query(query)
        .expect(200);

      const body1 = parseAndExpectValid(ZTagsListResponse, res1.body);
      const body2 = parseAndExpectValid(ZTagsListResponse, res2.body);

      expect(body1).toEqual(body2);
    });
  });
});
