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

const ZQuizResponse = z.object({
  quiz: ZQuizResponseSchema,
});

beforeEach(async () => {
  await seedModelFromSamples('Quiz');
  await seedModelFromSamples('User');
  await seedModelFromSamples('Course');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/quizzes', () => {
  describe('Basic functionality', () => {
    it('should return quizzes list with correct response structure', async () => {
      const res = await request(app)
        .get('/api/quizzes')
        .query(qs.stringify({ limit: 5 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);

      // Verify response structure matches OpenAPI spec
      expect(body).toHaveProperty('quizzes');
      expect(body).toHaveProperty('meta');
      expect(Array.isArray(body.quizzes)).toBe(true);

      // Verify meta structure
      expect(body.meta).toHaveProperty('total');
      expect(body.meta).toHaveProperty('limit');
      expect(body.meta).toHaveProperty('offset');
      expect(typeof body.meta.total).toBe('number');
      expect(typeof body.meta.limit).toBe('number');
      expect(typeof body.meta.offset).toBe('number');

      // Verify quiz structure for each quiz if any exist
      for (const quiz of body.quizzes) {
        expect(quiz).toHaveProperty('_id');
        expect(quiz).toHaveProperty('session');
        expect(quiz).toHaveProperty('course');
        expect(quiz).toHaveProperty('uploader');

        // Verify session is one of the allowed enum values
        expect(['midterm', 'final', 'first', 'second', 'other']).toContain(
          quiz.session,
        );

        // Without embedding, course and uploader should be UUIDs (strings)
        expect(typeof quiz.course).toBe('string');
        expect(typeof quiz.uploader).toBe('string');
      }
    });

    it('should use default pagination values (limit: 10, offset: 0)', async () => {
      const res = await request(app).get('/api/quizzes').expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.quizzes.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty result sets correctly', async () => {
      // Clear all quizzes to test empty response
      await QuizModel.deleteMany({});

      const res = await request(app).get('/api/quizzes').expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.quizzes).toHaveLength(0);
      expect(body.meta.total).toBe(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly with proper page separation', async () => {
      const total = await QuizModel.countDocuments().exec();

      // Test first page
      let body;
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 5, offset: 0 }))
          .expect(200);

        body = parseAndExpectValid(ZQuizListResponse, res.body);
        expect(body.meta).toEqual({ total, limit: 5, offset: 0 });
        expect(body.quizzes.length).toBeLessThanOrEqual(5);
      }

      if (total > 5) {
        // Test second page
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 5, offset: 5 }))
          .expect(200);

        const secondPageBody = parseAndExpectValid(ZQuizListResponse, res.body);
        expect(secondPageBody.meta).toEqual({ total, limit: 5, offset: 5 });
        expect(secondPageBody.quizzes.length).toBeLessThanOrEqual(5);

        // Ensure pages contain different quizzes
        const firstPageIds = body.quizzes.map(q => q._id);
        const secondPageIds = secondPageBody.quizzes.map(q => q._id);
        const intersection = firstPageIds.filter(id =>
          secondPageIds.includes(id),
        );
        expect(intersection).toHaveLength(0);
      }
    });

    it('should match default pagination with explicit values', async () => {
      let defaultPagBody;
      {
        const res = await request(app).get('/api/quizzes').expect(200);
        defaultPagBody = parseAndExpectValid(ZQuizListResponse, res.body);
      }
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 10, offset: 0 }))
          .expect(200);
        expect(parseAndExpectValid(ZQuizListResponse, res.body)).toEqual(
          defaultPagBody,
        );
      }
    });

    it('should handle large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/quizzes')
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.quizzes).toHaveLength(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(999999);
    });
  });

  describe('Embedding related resources', () => {
    it('should support various embed parameter combinations', async () => {
      // Test no embedding (default)
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 1 }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        if (body.quizzes.length > 0) {
          const quiz = body.quizzes[0];
          expect(typeof quiz.course).toBe('string'); // UUID
          expect(typeof quiz.uploader).toBe('string'); // UUID
        }
      }

      // Test course embedding
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 1, embed: ['course'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        if (body.quizzes.length > 0) {
          const quiz = body.quizzes[0];
          expect(typeof quiz.course).toBe('object'); // Embedded course
          expect(typeof quiz.uploader).toBe('string'); // UUID
        }
      }

      // Test uploader embedding
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 1, embed: ['uploader'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        if (body.quizzes.length > 0) {
          const quiz = body.quizzes[0];
          expect(typeof quiz.course).toBe('string'); // UUID
          expect(typeof quiz.uploader).toBe('object'); // Embedded uploader
        }
      }

      // Test both course and uploader embedding
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 1, embed: ['course', 'uploader'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        if (body.quizzes.length > 0) {
          const quiz = body.quizzes[0];
          expect(typeof quiz.course).toBe('object'); // Embedded course
          expect(typeof quiz.uploader).toBe('object'); // Embedded uploader
        }
      }
    });
  });

  describe('Parameter validation', () => {
    it('should validate pagination parameters correctly', async () => {
      // Test negative offset
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ offset: -1 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test zero limit
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 0 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test negative limit
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: -1 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test non-integer pagination parameters
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 'invalid' }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ offset: 'invalid' }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test very large limit
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 999999 }))
          .expect(200);
        parseAndExpectValid(ZQuizListResponse, res.body);
      }

      // Test decimal values
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ limit: 10.5 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ offset: 5.7 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should validate embed parameters', async () => {
      // Test invalid embed value
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ embed: ['invalid'] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test multiple invalid embed values
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ embed: ['invalid1', 'invalid2'] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test mix of valid and invalid embed values
      {
        const res = await request(app)
          .get('/api/quizzes')
          .query(qs.stringify({ embed: ['course', 'invalid'] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should handle empty embed array correctly', async () => {
      const res = await request(app)
        .get('/api/quizzes')
        .query(qs.stringify({ embed: [], limit: 1 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      if (body.quizzes.length > 0) {
        const quiz = body.quizzes[0];
        expect(typeof quiz.course).toBe('string'); // UUID
        expect(typeof quiz.uploader).toBe('string'); // UUID
      }
    });
  });
});

describe('GET /api/quizzes/:quizId', () => {
  describe('Quiz retrieval', () => {
    it('should return single quiz with correct response structure', async () => {
      const testQuiz = await getTestQuiz();

      const res = await request(app)
        .get(`/api/quizzes/${testQuiz._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZQuizResponse, res.body);
      expect(body.quiz._id).toBe(testQuiz._id);
      expect(body.quiz.session).toBe(testQuiz.session);
      expect(body.quiz.course).toBe(testQuiz.course);
      expect(body.quiz.uploader).toBe(testQuiz.uploader);
    });

    it('should support embed parameters correctly', async () => {
      const testQuiz = await getTestQuiz();

      // Test course embedding
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['course'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizResponse, res.body);
        expect(typeof body.quiz.course).toBe('object'); // Embedded course
        expect(typeof body.quiz.uploader).toBe('string'); // UUID
      }

      // Test uploader embedding
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['uploader'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizResponse, res.body);
        expect(typeof body.quiz.course).toBe('string'); // UUID
        expect(typeof body.quiz.uploader).toBe('object'); // Embedded uploader
      }

      // Test both embeddings
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['course', 'uploader'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizResponse, res.body);
        expect(typeof body.quiz.course).toBe('object'); // Embedded course
        expect(typeof body.quiz.uploader).toBe('object'); // Embedded uploader
      }
    });
  });

  describe('Parameter validation', () => {
    it('should validate embed parameters', async () => {
      const testQuiz = await getTestQuiz();

      // Test invalid embed value
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['invalid'] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test multiple invalid embed values
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['invalid1', 'invalid2'] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Test mix of valid and invalid embed values
      {
        const res = await request(app)
          .get(`/api/quizzes/${testQuiz._id}`)
          .query(qs.stringify({ embed: ['course', 'invalid'] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should handle empty embed array correctly', async () => {
      const testQuiz = await getTestQuiz();

      const res = await request(app)
        .get(`/api/quizzes/${testQuiz._id}`)
        .query(qs.stringify({ embed: [] }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizResponse, res.body);
      expect(typeof body.quiz.course).toBe('string'); // UUID
      expect(typeof body.quiz.uploader).toBe('string'); // UUID
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

    it('should validate malformed UUIDs with specific patterns', async () => {
      const malformedUuids = [
        'not-a-uuid',
        '12345',
        '123e4567-e89b-12d3-a456-42661417400', // missing last character
        '123e4567-e89b-12d3-a456-4266141740000', // extra character
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx', // invalid characters
      ];

      for (const malformedUuid of malformedUuids) {
        const res = await request(app)
          .get(`/api/quizzes/${malformedUuid}`)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });
});

describe('GET /api/quizzes/:quizId/file', () => {
  describe('File retrieval', () => {
    it('should return PDF file content for quizzes with uploaded files', async () => {
      const testQuiz = await getTestQuiz();

      const res = await request(app)
        .get(`/api/quizzes/${testQuiz._id}/file`)
        .expect('Content-Type', /pdf/)
        .expect(200);

      expect(res.body).toBeDefined();
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

    it('should validate malformed UUIDs with specific patterns', async () => {
      const malformedUuids = [
        'not-a-uuid',
        '12345',
        '123e4567-e89b-12d3-a456-42661417400', // missing last character
        '123e4567-e89b-12d3-a456-4266141740000', // extra character
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx', // invalid characters
      ];

      for (const malformedUuid of malformedUuids) {
        const res = await request(app)
          .get(`/api/quizzes/${malformedUuid}/file`)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });
});
