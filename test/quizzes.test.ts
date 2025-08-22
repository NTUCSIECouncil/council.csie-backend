import { randomUUID } from 'crypto';

import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { QuizModel } from '@models/quiz-schema.ts';
import app from './app.ts';
import { ZMetaSchema, ZQuizResponseSchema } from './response-schemas.ts';
import {
  expectValidErrorResponse,
  getTestQuiz,
  parseAndExpectValid,
  seedModelFromSamples,
} from './utils.ts';

const ZQuizListResponse = z.object({
  quizzes: ZQuizResponseSchema.array(),
  meta: ZMetaSchema,
});

const ZQuizResponse = z.object({ quiz: ZQuizResponseSchema });

beforeEach(async () => {
  await seedModelFromSamples('Quiz');
  await seedModelFromSamples('User');
  await seedModelFromSamples('Course');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/quizzes', () => {
  describe('Basic retrieval', () => {
    it('should return quizzes list with default pagination', async () => {
      const res = await request(app).get('/api/quizzes').expect(200);
      const body = parseAndExpectValid(ZQuizListResponse, res.body);

      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.quizzes.length).toBeLessThanOrEqual(10);
    });

    it('should respect custom pagination parameters', async () => {
      const res = await request(app)
        .get('/api/quizzes')
        .query(qs.stringify({ limit: 5, offset: 2 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.meta.limit).toBe(5);
      expect(body.meta.offset).toBe(2);
      expect(body.quizzes.length).toBeLessThanOrEqual(5);
    });

    it('should handle large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/quizzes')
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.quizzes).toHaveLength(0);
      expect(body.meta.offset).toBe(999999);
    });

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
          .get('/api/quizzes')
          .query(qs.stringify(params))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should return empty results when no quizzes exist', async () => {
      await QuizModel.deleteMany({});

      const res = await request(app).get('/api/quizzes').expect(200);
      const body = parseAndExpectValid(ZQuizListResponse, res.body);

      expect(body.quizzes).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });
  });

  describe('Embedding', () => {
    it('should support all embed combinations', async () => {
      // No embedding (default)
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 1 }))
          .expect(200);
        const body = parseAndExpectValid(ZQuizListResponse, res.body);

        if (body.quizzes.length > 0) {
          const quiz = body.quizzes[0];
          expect(quiz.course).toBeTypeOf('string');
          expect(quiz.uploader).toBeTypeOf('string');
        }
      }

      // Course embedding
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 1, embed: ['course'] }))
          .expect(200);
        const body = parseAndExpectValid(ZQuizListResponse, res.body);

        if (body.quizzes.length > 0) {
          const quiz = body.quizzes[0];
          expect(quiz.course).toBeTypeOf('object');
          expect(quiz.uploader).toBeTypeOf('string');
        }
      }

      // Uploader embedding
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 1, embed: ['uploader'] }))
          .expect(200);
        const body = parseAndExpectValid(ZQuizListResponse, res.body);

        if (body.quizzes.length > 0) {
          const quiz = body.quizzes[0];
          expect(quiz.course).toBeTypeOf('string');
          expect(quiz.uploader).toBeTypeOf('object');
        }
      }

      // Both embeddings
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 1, embed: ['course', 'uploader'] }))
          .expect(200);
        const body = parseAndExpectValid(ZQuizListResponse, res.body);

        if (body.quizzes.length > 0) {
          const quiz = body.quizzes[0];
          expect(quiz.course).toBeTypeOf('object');
          expect(quiz.uploader).toBeTypeOf('object');
        }
      }
    });

    it('should validate embed parameters', async () => {
      const invalidEmbeds = ['invalid', 'nonexistent', 'content'];

      for (const embed of invalidEmbeds) {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ embed: [embed] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Mix of valid and invalid
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ embed: ['course', 'invalid'] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should handle empty embed array', async () => {
      const res = await request(app)
        .get('/api/quizzes')
        .query(qs.stringify({ embed: [], limit: 1 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      if (body.quizzes.length > 0) {
        const quiz = body.quizzes[0];
        expect(quiz.course).toBeTypeOf('string');
        expect(quiz.uploader).toBeTypeOf('string');
      }
    });
  });
});

describe('GET /api/quizzes/:quizId', () => {
  describe('Successful retrieval', () => {
    it('should return single quiz', async () => {
      const testQuiz = await getTestQuiz();

      const res = await request(app)
        .get(`/api/quizzes/${testQuiz._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZQuizResponse, res.body);
      expect(body.quiz).toEqual(testQuiz);
    });

    it('should support embed parameters', async () => {
      const testQuiz = await getTestQuiz();

      // No embedding (default)
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .expect(200);
        const body = parseAndExpectValid(ZQuizResponse, res.body);

        expect(body.quiz.course).toBeTypeOf('string');
        expect(body.quiz.uploader).toBeTypeOf('string');
      }

      // Course embedding
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['course'] }))
          .expect(200);
        const body = parseAndExpectValid(ZQuizResponse, res.body);

        expect(body.quiz.course).toBeTypeOf('object');
        expect(body.quiz.uploader).toBeTypeOf('string');
      }

      // Uploader embedding
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['uploader'] }))
          .expect(200);
        const body = parseAndExpectValid(ZQuizResponse, res.body);

        expect(body.quiz.course).toBeTypeOf('string');
        expect(body.quiz.uploader).toBeTypeOf('object');
      }

      // Both embeddings
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['course', 'uploader'] }))
          .expect(200);
        const body = parseAndExpectValid(ZQuizResponse, res.body);

        expect(body.quiz.course).toBeTypeOf('object');
        expect(body.quiz.uploader).toBeTypeOf('object');
      }
    });
  });

  describe('Parameter validation', () => {
    it('should validate embed parameters', async () => {
      const testQuiz = await getTestQuiz();

      const invalidEmbeds = ['invalid', 'nonexistent', 'content'];
      for (const embed of invalidEmbeds) {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: [embed] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const res = await request(app)
        .get('/api/quizzes/invalid-uuid')
        .expect(400);
      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent quizzes', async () => {
      const res = await request(app)
        .get(`/api/quizzes/${randomUUID()}`)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });
});

describe('GET /api/quizzes/:quizId/file', () => {
  describe('Successful retrieval', () => {
    it('should return PDF file content', async () => {
      const testQuiz = await getTestQuiz();

      const res = await request(app)
        .get(`/api/quizzes/${testQuiz._id}/file`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.body).toBeDefined();
      expect(Buffer.isBuffer(res.body)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const res = await request(app)
        .get('/api/quizzes/invalid-uuid/file')
        .expect(400);
      expectValidErrorResponse(res.body);
    });

    it('should handle non-existent quizzes', async () => {
      const res = await request(app)
        .get(`/api/quizzes/${randomUUID()}/file`)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });
});
