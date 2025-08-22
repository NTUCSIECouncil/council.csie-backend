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
  await seedModelFromSamples('Quiz');
  await seedModelFromSamples('User');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/courses', () => {
  describe('Pagination', () => {
    it('should return paginated courses with default parameters', async () => {
      const res = await request(app).get('/api/courses').expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.courses.length).toBeLessThanOrEqual(10);
    });

    it('should handle custom pagination parameters', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ limit: 5, offset: 0 }))
        .expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.courses.length).toBeLessThanOrEqual(5);
      expect(body.meta.limit).toBe(5);
      expect(body.meta.offset).toBe(0);
    });

    it('should handle pagination across multiple pages', async () => {
      const total = await CourseModel.countDocuments().exec();

      // Test first page
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 5, offset: 0 }))
          .expect(200);

        const body = parseAndExpectValid(ZCourseListResponse, res.body);
        expect(body.meta).toEqual({ total, limit: 5, offset: 0 });
        expect(body.courses.length).toBeLessThanOrEqual(5);
      }

      // Test second page if we have enough data
      if (total > 5) {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 5, offset: 5 }))
          .expect(200);

        const body = parseAndExpectValid(ZCourseListResponse, res.body);
        expect(body.meta).toEqual({ total, limit: 5, offset: 5 });
        expect(body.courses.length).toBeLessThanOrEqual(5);
      }
    });

    it('should handle large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.courses).toHaveLength(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(999999);
    });

    it('should validate pagination parameters', async () => {
      // Invalid limit values (must be positive integer)
      const invalidLimits = [0, -1, 'invalid'];
      for (const limit of invalidLimits) {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid offset values (must be non-negative integer)
      const invalidOffsets = [-1, 'invalid'];
      for (const offset of invalidOffsets) {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ offset }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }
    });

    it('should return empty results for no matches', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ keyword: 'nonexistent-course-xyz-123' }))
        .expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.courses).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });
  });

  describe('Keyword search', () => {
    it('should support fuzzy keyword search across course names and lecturer', async () => {
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

    it('should handle empty keyword as returning all courses', async () => {
      const allCoursesRes = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ limit: 1000 }))
        .expect(200);
      const allCourses = parseAndExpectValid(
        ZCourseListResponse,
        allCoursesRes.body,
      );

      const emptyKeywordRes = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ keyword: '', limit: 1000 }))
        .expect(200);
      const emptyKeywordCourses = parseAndExpectValid(
        ZCourseListResponse,
        emptyKeywordRes.body,
      );

      expect(emptyKeywordCourses.courses.length).toBe(
        allCourses.courses.length,
      );
      expect(emptyKeywordCourses.meta.total).toBe(allCourses.meta.total);
    });

    it('should return empty results for non-existent keyword', async () => {
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
  describe('Pagination', () => {
    it('should return paginated quizzes with default parameters', async () => {
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

    it('should handle custom pagination parameters', async () => {
      const course = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .query(qs.stringify({ limit: 5, offset: 0 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.meta.limit).toBe(5);
      expect(body.meta.offset).toBe(0);
      expect(body.quizzes.length).toBeLessThanOrEqual(5);
    });

    it('should handle pagination across multiple pages', async () => {
      const course = await getTestCourse();
      const totalQuizzes = await QuizModel.countDocuments({
        course: course._id,
      }).exec();

      // Test first page
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 2, offset: 0 }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        expect(body.meta).toEqual({ total: totalQuizzes, limit: 2, offset: 0 });
        expect(body.quizzes.length).toBeLessThanOrEqual(2);
      }

      // Test second page if we have enough data
      if (totalQuizzes > 2) {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 2, offset: 2 }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        expect(body.meta).toEqual({ total: totalQuizzes, limit: 2, offset: 2 });
        expect(body.quizzes.length).toBeLessThanOrEqual(2);
      }
    });

    it('should handle large offset gracefully', async () => {
      const course = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .query(qs.stringify({ limit: 10, offset: 999999 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.quizzes).toHaveLength(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(999999);
    });

    it('should validate pagination parameters', async () => {
      const course = await getTestCourse();

      // Invalid limit values (must be positive integer)
      const invalidLimits = [0, -1, 'invalid'];
      for (const limit of invalidLimits) {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid offset values (must be non-negative integer)
      const invalidOffsets = [-1, 'invalid'];
      for (const offset of invalidOffsets) {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ offset }))
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

  describe('Embedding related resources', () => {
    it('should support all valid embed parameter combinations', async () => {
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

      // Invalid embed value
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ embed: ['invalid'] }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Mix of valid and invalid embed values
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ embed: ['course', 'invalid'] }))
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
