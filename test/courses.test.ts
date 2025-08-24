import { randomUUID } from 'crypto';

import Fuse from 'fuse.js';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CourseModel } from '@/models/course-schema.ts';
import { QuizModel } from '@/models/quiz-schema.ts';
import app from './app.ts';
import {
  ZCourseResponseSchema,
  ZMetaSchema,
  ZQuizResponseSchema,
} from './response-schemas.ts';
import {
  expectValidErrorResponse,
  getTestCourse,
  parseAndExpectValid,
  seedModelFromSamples,
} from './utils.ts';

const ZCourseListResponse = z.object({
  courses: ZCourseResponseSchema.array(),
  meta: ZMetaSchema,
});

const ZCourseResponse = z.object({ course: ZCourseResponseSchema });

const ZQuizListResponse = z.object({
  quizzes: ZQuizResponseSchema.array(),
  meta: ZMetaSchema,
});

beforeEach(async () => {
  await seedModelFromSamples('Course');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/courses', () => {
  describe('Basic retrieval', () => {
    it('should return courses list with default pagination', async () => {
      const res = await request(app).get('/api/courses').expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.courses.length).toBeLessThanOrEqual(10);
    });

    it('should respect custom pagination parameters', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ limit: 5, offset: 2 }))
        .expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.meta.limit).toBe(5);
      expect(body.meta.offset).toBe(2);
      expect(body.courses.length).toBeLessThanOrEqual(5);
    });

    it('should handle large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.courses).toHaveLength(0);
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
          .get('/api/courses')
          .query(qs.stringify(params))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Keyword search', () => {
    it('should search across course names and lecturer', async () => {
      const courses = await CourseModel.find()
        .lean({ versionKey: false })
        .exec();
      const fuse = new Fuse(courses, {
        keys: ['names', 'lecturer'],
        threshold: 0.6,
      });

      const testKeywords = ['服務學習', '羅凱尹', '普通微生物學'];
      for (const keyword of testKeywords) {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ keyword, limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZCourseListResponse, res.body);
        const expectedResults = fuse.search(keyword).map(({ item }) => item);
        expect(body.courses).toEqual(expectedResults);
        expect(body.meta.total).toBe(expectedResults.length);
      }
    });

    it('should return all courses when keyword is empty', async () => {
      const allRes = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);
      const allBody = parseAndExpectValid(ZCourseListResponse, allRes.body);

      const emptyRes = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ keyword: '', limit: 1000 }))
        .expect(200);
      const emptyBody = parseAndExpectValid(ZCourseListResponse, emptyRes.body);

      expect(emptyBody.courses.length).toBe(allBody.courses.length);
      expect(emptyBody.meta.total).toBe(allBody.meta.total);
    });

    it('should return empty results for non-existent keywords', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ keyword: 'nonexistent-keyword-xyz-987654321' }))
        .expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.courses).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });
  });
});

describe('GET /api/courses/:courseId', () => {
  describe('Successful retrieval', () => {
    it('should return single course', async () => {
      const testCourse = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${testCourse._id}`)
        .expect(200);

      const body = parseAndExpectValid(ZCourseResponse, res.body);
      expect(body.course).toEqual(testCourse);
    });

    it('should return consistent data with list endpoint', async () => {
      const testCourse = await getTestCourse();

      // Get from single course endpoint
      const singleRes = await request(app)
        .get(`/api/courses/${testCourse._id}`)
        .expect(200);
      const singleBody = parseAndExpectValid(ZCourseResponse, singleRes.body);

      // Get from list endpoint
      const listRes = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);
      const listBody = parseAndExpectValid(ZCourseListResponse, listRes.body);

      const courseFromList = listBody.courses.find(
        c => c._id === testCourse._id,
      );
      expect(courseFromList).toBeDefined();
      expect(singleBody.course).toEqual(courseFromList);
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const invalidUuids = ['invalid-uuid', '123', 'not-a-uuid'];
      for (const invalidUuid of invalidUuids) {
        const res = await request(app)
          .get(`/api/courses/${invalidUuid}`)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should handle non-existent courses', async () => {
      const nonExistentId = randomUUID();
      const res = await request(app)
        .get(`/api/courses/${nonExistentId}`)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });
});

describe('GET /api/courses/:courseId/quizzes', () => {
  describe('Basic retrieval', () => {
    it('should return quizzes with default pagination', async () => {
      const course = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.quizzes.length).toBeLessThanOrEqual(10);
      for (const quiz of body.quizzes) {
        expect(quiz.course).toBe(course._id);
      }
    });

    it('should respect custom pagination parameters', async () => {
      const course = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .query(qs.stringify({ limit: 5, offset: 2 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.meta.limit).toBe(5);
      expect(body.meta.offset).toBe(2);
      expect(body.quizzes.length).toBeLessThanOrEqual(5);
    });

    it('should handle large offset gracefully', async () => {
      const course = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.quizzes).toHaveLength(0);
      expect(body.meta.offset).toBe(999999);
    });

    it('should validate pagination parameters', async () => {
      const course = await getTestCourse();

      const invalidParams = [
        { limit: 0 },
        { limit: -1 },
        { limit: 'invalid' },
        { offset: -1 },
        { offset: 'invalid' },
      ];

      for (const params of invalidParams) {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify(params))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should return empty results for courses with no quizzes', async () => {
      const course = await getTestCourse();
      await QuizModel.deleteMany({ course: course._id }).exec();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.quizzes).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });
  });

  describe('Embedding', () => {
    it('should support all embed combinations', async () => {
      const course = await getTestCourse();

      // Test no embed (default - should return UUIDs)
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        for (const quiz of body.quizzes) {
          expect(quiz.course).toBeTypeOf('string');
          expect(quiz.uploader).toBeTypeOf('string');
        }
      }

      // Test embed=course
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ embed: ['course'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        for (const quiz of body.quizzes) {
          expect(quiz.course).toBeTypeOf('object');
          expect(quiz.uploader).toBeTypeOf('string');
        }
      }

      // Test embed=uploader
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ embed: ['uploader'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        for (const quiz of body.quizzes) {
          expect(quiz.course).toBeTypeOf('string');
          expect(quiz.uploader).toBeTypeOf('object');
        }
      }

      // Test multiple embeds
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ embed: ['course', 'uploader'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        for (const quiz of body.quizzes) {
          expect(quiz.course).toBeTypeOf('object');
          expect(quiz.uploader).toBeTypeOf('object');
        }
      }
    });

    it('should validate embed parameters', async () => {
      const course = await getTestCourse();

      const invalidEmbeds = [
        ['invalid'],
        ['course', 'invalid'],
        ['content'], // not supported for this endpoint
      ];

      for (const embed of invalidEmbeds) {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ embed }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });
  });

  describe('Error handling', () => {
    it('should validate UUID format', async () => {
      const invalidUuids = ['invalid-uuid', '123', 'not-a-uuid'];
      for (const invalidUuid of invalidUuids) {
        const res = await request(app)
          .get(`/api/courses/${invalidUuid}/quizzes`)
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should handle non-existent courses', async () => {
      const nonExistentId = randomUUID();
      const res = await request(app)
        .get(`/api/courses/${nonExistentId}/quizzes`)
        .expect(404);
      expectValidErrorResponse(res.body);
    });
  });
});
