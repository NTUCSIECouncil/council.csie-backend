import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ArticleModel } from '@models/article-schema.ts';
import app from './app.ts';
import { ZMetaSchema } from './response-schemas.ts';
import {
  expectValidErrorResponse,
  parseAndExpectValid,
  seedModelFromSamples,
} from './utils.ts';

const ZTagsListResponse = z.object({
  tags: z.string().array(),
  meta: ZMetaSchema,
});

beforeEach(async () => {
  await seedModelFromSamples('Article');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/tags', () => {
  describe('Basic retrieval', () => {
    it('should return tags list with default pagination', async () => {
      const res = await request(app).get('/api/tags').expect(200);
      const body = parseAndExpectValid(ZTagsListResponse, res.body);

      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.tags.length).toBeLessThanOrEqual(10);
    });

    it('should respect custom pagination parameters', async () => {
      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 5, offset: 2 }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      expect(body.meta.limit).toBe(5);
      expect(body.meta.offset).toBe(2);
      expect(body.tags.length).toBeLessThanOrEqual(5);
    });

    it('should handle large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      expect(body.tags).toHaveLength(0);
      expect(body.meta.offset).toBe(999999);
    });

    it('should return tags sorted alphabetically', async () => {
      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      const sortedTags = [...body.tags].sort();
      expect(body.tags).toEqual(sortedTags);
    });

    it('should return unique tags only', async () => {
      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      const uniqueTags = [...new Set(body.tags)];
      expect(body.tags).toEqual(uniqueTags);
    });

    it('should return empty results when no articles exist', async () => {
      await ArticleModel.deleteMany({});

      const res = await request(app).get('/api/tags').expect(200);
      const body = parseAndExpectValid(ZTagsListResponse, res.body);

      expect(body.tags).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });
  });

  describe('Parameter validation', () => {
    it('should validate pagination parameters', async () => {
      const invalidParams = [
        { limit: 0 },
        { limit: -1 },
        { limit: 'invalid' },
        { offset: -1 },
        { offset: 'invalid' },
      ];

      for (const params of invalidParams) {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify(params))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should accept valid boundary values', async () => {
      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 1, offset: 0 }))
          .expect(200);
        parseAndExpectValid(ZTagsListResponse, res.body);
      }

      {
        const res = await request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 100, offset: 1000 }))
          .expect(200);
        parseAndExpectValid(ZTagsListResponse, res.body);
      }
    });
  });

  describe('Data consistency', () => {
    it('should reflect all unique tags from existing articles', async () => {
      const articles = await ArticleModel.find({}, { tags: 1 }).lean().exec();
      const expectedTags = [
        ...new Set(articles.flatMap(article => article.tags)),
      ].sort();

      const res = await request(app)
        .get('/api/tags')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);

      const body = parseAndExpectValid(ZTagsListResponse, res.body);
      expect(body.tags).toEqual(expectedTags);
      expect(body.meta.total).toBe(expectedTags.length);
    });

    it('should maintain correct total count across pages', async () => {
      // Get total count from different page sizes
      const [page1, page2] = await Promise.all([
        request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 3 }))
          .expect(200),
        request(app)
          .get('/api/tags')
          .query(qs.stringify({ limit: 7, offset: 5 }))
          .expect(200),
      ]);

      const body1 = parseAndExpectValid(ZTagsListResponse, page1.body);
      const body2 = parseAndExpectValid(ZTagsListResponse, page2.body);

      expect(body1.meta.total).toBe(body2.meta.total);
    });
  });
});
