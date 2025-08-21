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
  describe('Basic functionality', () => {
    it('should return courses list with correct response structure', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ limit: 5 }))
        .expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.courses.length).toBeLessThanOrEqual(5);
    });

    it('should use default pagination values (limit: 10, offset: 0)', async () => {
      const res = await request(app).get('/api/courses').expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
      expect(body.courses.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty result sets correctly', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query(qs.stringify({ keyword: 'nonexistent-course-xyz-123' }))
        .expect(200);

      const body = parseAndExpectValid(ZCourseListResponse, res.body);
      expect(body.courses).toHaveLength(0);
      expect(body.meta.total).toBe(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
    });

    it('should return courses in consistent order', async () => {
      // Make multiple identical requests and verify consistent ordering
      const requests = Array(3)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/courses')
            .query(qs.stringify({ limit: 10 }))
            .expect(200),
        );

      const responses = await Promise.all(requests);
      const bodies = responses.map(res =>
        parseAndExpectValid(ZCourseListResponse, res.body),
      );

      // All responses should have the same courses in the same order
      for (let i = 1; i < bodies.length; i++) {
        expect(bodies[i].courses).toEqual(bodies[0].courses);
      }
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly with proper page separation', async () => {
      const total = await CourseModel.countDocuments().exec();

      // Test first page
      let body;
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 5, offset: 0 }))
          .expect(200);

        body = parseAndExpectValid(ZCourseListResponse, res.body);
        expect(body.meta).toEqual({ total, limit: 5, offset: 0 });
        expect(body.courses.length).toBeLessThanOrEqual(5);
      }

      if (total > 5) {
        // Test second page
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 5, offset: 5 }))
          .expect(200);

        const secondPageBody = parseAndExpectValid(
          ZCourseListResponse,
          res.body,
        );
        expect(secondPageBody.meta).toEqual({ total, limit: 5, offset: 5 });
        expect(secondPageBody.courses.length).toBeLessThanOrEqual(5);

        // Ensure pages don't overlap
        const firstPageIds = body.courses.map(c => c._id);
        const secondPageIds = secondPageBody.courses.map(c => c._id);
        const intersection = firstPageIds.filter(id =>
          secondPageIds.includes(id),
        );
        expect(intersection).toHaveLength(0);
      }
    });

    it('should match default pagination with explicit values', async () => {
      let defaultPagBody;
      {
        const res = await request(app).get('/api/courses').expect(200);
        defaultPagBody = parseAndExpectValid(ZCourseListResponse, res.body);
      }
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 10, offset: 0 }))
          .expect(200);
        expect(parseAndExpectValid(ZCourseListResponse, res.body)).toEqual(
          defaultPagBody,
        );
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
  });

  describe('Search and filtering', () => {
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

    it('should handle edge cases in keyword search', async () => {
      // Empty keyword should return all courses (no filtering)
      {
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
      }

      // Non-existent keyword should return empty results
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ keyword: 'nonexistent-keyword-xyz-987654321' }))
          .expect(200);
        const body = parseAndExpectValid(ZCourseListResponse, res.body);
        expect(body.courses).toHaveLength(0);
        expect(body.meta.total).toBe(0);
      }

      // Whitespace-only keyword should be treated as empty
      {
        const allCoursesRes = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 1000 }))
          .expect(200);
        const allCourses = parseAndExpectValid(
          ZCourseListResponse,
          allCoursesRes.body,
        );

        const whitespaceKeywordRes = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ keyword: '   ', limit: 1000 }))
          .expect(200);
        const whitespaceKeywordCourses = parseAndExpectValid(
          ZCourseListResponse,
          whitespaceKeywordRes.body,
        );

        expect(whitespaceKeywordCourses.courses.length).toBe(
          allCourses.courses.length,
        );
      }
    });

    it('should search across multiple course fields accurately', async () => {
      // Test search in course names
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ keyword: '資料結構', limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZCourseListResponse, res.body);
        for (const course of body.courses) {
          const hasKeywordInNames = course.names.some(name =>
            name.includes('資料結構'),
          );
          const hasKeywordInLecturer = course.lecturer.includes('資料結構');
          expect(hasKeywordInNames || hasKeywordInLecturer).toBe(true);
        }
      }

      // Test search in lecturer names
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ keyword: '林', limit: 100 }))
          .expect(200);

        const body = parseAndExpectValid(ZCourseListResponse, res.body);
        for (const course of body.courses) {
          const hasKeywordInNames = course.names.some(name =>
            name.includes('林'),
          );
          const hasKeywordInLecturer = course.lecturer.includes('林');
          expect(hasKeywordInNames || hasKeywordInLecturer).toBe(true);
        }
      }
    });
  });

  describe('Parameter validation', () => {
    it('should validate pagination parameters correctly', async () => {
      // Invalid limit - zero
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 0 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid limit - negative
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: -5 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid offset - negative
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ offset: -1 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Non-numeric limit
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 'invalid' }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Non-numeric offset
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ offset: 'invalid' }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Floating point numbers should be rejected
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 5.5 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Valid edge case - maximum reasonable values
      {
        const res = await request(app)
          .get('/api/courses')
          .query(qs.stringify({ limit: 100, offset: 0 }))
          .expect(200);
        const body = parseAndExpectValid(ZCourseListResponse, res.body);
        expect(body.meta.limit).toBe(100);
        expect(body.meta.offset).toBe(0);
      }
    });

    it('should handle malformed query parameters gracefully', async () => {
      // Multiple limit parameters (query pollution)
      const res = await request(app)
        .get('/api/courses?limit=5&limit=10')
        .expect(400);
      expectValidErrorResponse(res.body);
    });
  });
});

describe('GET /api/courses/:courseId', () => {
  describe('Course retrieval', () => {
    it('should return single course with correct response structure', async () => {
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
  describe('Quiz retrieval for course', () => {
    it('should return quizzes list with correct response structure', async () => {
      const course = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      for (const quiz of body.quizzes) {
        expect(quiz.course).toBe(course._id);
      }
    });

    it('should support pagination correctly', async () => {
      const course = await getTestCourse();
      const totalQuizzes = await QuizModel.countDocuments({
        course: course._id,
      }).exec();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .query(qs.stringify({ limit: 5, offset: 0 }))
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.meta).toEqual({ total: totalQuizzes, limit: 5, offset: 0 });
      expect(body.quizzes.length).toBeLessThanOrEqual(5);
      expect(body.quizzes.length).toBeLessThanOrEqual(totalQuizzes);
    });

    it('should handle pagination with proper page separation', async () => {
      const course = await getTestCourse();
      const totalQuizzes = await QuizModel.countDocuments({
        course: course._id,
      }).exec();

      if (totalQuizzes > 3) {
        // Test first page
        const firstPageRes = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 2, offset: 0 }))
          .expect(200);

        const firstPageBody = parseAndExpectValid(
          ZQuizListResponse,
          firstPageRes.body,
        );
        expect(firstPageBody.meta).toEqual({
          total: totalQuizzes,
          limit: 2,
          offset: 0,
        });
        expect(firstPageBody.quizzes.length).toBeLessThanOrEqual(2);

        // Test second page
        const secondPageRes = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 2, offset: 2 }))
          .expect(200);

        const secondPageBody = parseAndExpectValid(
          ZQuizListResponse,
          secondPageRes.body,
        );
        expect(secondPageBody.meta).toEqual({
          total: totalQuizzes,
          limit: 2,
          offset: 2,
        });

        // Ensure pages don't overlap
        const firstPageIds = firstPageBody.quizzes.map(q => q._id);
        const secondPageIds = secondPageBody.quizzes.map(q => q._id);
        const intersection = firstPageIds.filter(id =>
          secondPageIds.includes(id),
        );
        expect(intersection).toHaveLength(0);
      }
    });

    it('should use default pagination values (limit: 10, offset: 0)', async () => {
      const course = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
    });

    it('should handle empty quiz list correctly', async () => {
      // Create a course with no quizzes
      const course = await getTestCourse();
      await QuizModel.deleteMany({ course: course._id }).exec();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      expect(body.quizzes).toHaveLength(0);
      expect(body.meta.total).toBe(0);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.offset).toBe(0);
    });

    it('should match default pagination with explicit values', async () => {
      const course = await getTestCourse();

      let defaultPagBody;
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .expect(200);
        defaultPagBody = parseAndExpectValid(ZQuizListResponse, res.body);
      }
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 10, offset: 0 }))
          .expect(200);
        expect(parseAndExpectValid(ZQuizListResponse, res.body)).toEqual(
          defaultPagBody,
        );
      }
    });
  });

  describe('Embedding related resources', () => {
    it('should support embed parameters correctly', async () => {
      const course = await getTestCourse();

      // Test embed=course
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ embed: ['course'] }))
          .expect(200);

        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        for (const quiz of body.quizzes) {
          expect(quiz.course).toBeTypeOf('object');
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

    it('should return UUIDs when embed parameters are not specified', async () => {
      const course = await getTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes`)
        .expect(200);

      const body = parseAndExpectValid(ZQuizListResponse, res.body);
      for (const quiz of body.quizzes) {
        expect(quiz.course).toBeTypeOf('string');
        expect(quiz.uploader).toBeTypeOf('string');
      }
    });
  });

  describe('Parameter validation', () => {
    it('should validate pagination parameters correctly', async () => {
      const course = await getTestCourse();

      // Invalid limit - zero
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 0 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid limit - negative
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: -5 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Invalid offset - negative
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ offset: -1 }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Non-numeric parameters
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 'invalid' }))
          .expect(400);
        expectValidErrorResponse(res.body);
      }

      // Valid edge cases
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 1, offset: 0 }))
          .expect(200);
        const body = parseAndExpectValid(ZQuizListResponse, res.body);
        expect(body.meta.limit).toBe(1);
        expect(body.meta.offset).toBe(0);
      }

      // Floating point numbers should be rejected
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ limit: 5.5 }))
          .expect(400);
        expectValidErrorResponse(res.body);
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

      // Valid embed values should work
      {
        const res = await request(app)
          .get(`/api/courses/${course._id}/quizzes`)
          .query(qs.stringify({ embed: ['course', 'uploader'] }))
          .expect(200);
        parseAndExpectValid(ZQuizListResponse, res.body);
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

    it('should handle malformed query parameters gracefully', async () => {
      const course = await getTestCourse();

      // Multiple limit parameters (query pollution)
      const res = await request(app)
        .get(`/api/courses/${course._id}/quizzes?limit=5&limit=10`)
        .expect(400);
      expectValidErrorResponse(res.body);
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
