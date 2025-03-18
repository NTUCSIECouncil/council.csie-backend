import { randomUUID } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Fuse from 'fuse.js';
import mongoose from 'mongoose';
import qs from 'qs';
import request from 'supertest';
import { ZCourseSchema } from '@/models/course-schema.ts';
import { models } from '@models/index.ts';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  await insertFromFile('Course');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/courses/:uuid', () => {
  it('should response the course with uuid', async () => {
    const targetCourse = {
      _id: '00000003-0000-0000-0000-000000000000',
      curriculum: 'CHIN8012',
      lecturer: '汪詩珮',
      class: '01',
      names: ['大學國文：文學鑑賞與寫作（一）'],
      credit: 3,
      categories: [],
    };

    const res = await request(app)
      .get(`/api/courses/${targetCourse._id}`)
      .expect(200);
    expect(res.body.item).toStrictEqual(targetCourse);
  });

  it('should reject invalid uuid', async () => {
    await request(app)
      .get('/api/courses/invalid-uuid')
      .expect(400);
  });

  it('should reject non-exist uuid', async () => {
    await request(app)
      .get(`/api/courses/${randomUUID()}`)
      .expect(404);
  });
});

describe('GET /api/courses/search', () => {
  it('should support search with category list', async () => {
    for (const categories of [['General']]) {
      const res = await request(app)
        .get('/api/courses/search')
        .query(qs.stringify({ categories }))
        .expect(200);

      expect(ZCourseSchema.strict().array().safeParse(res.body.items).success).toBe(true);

      for (const course of res.body.items) {
        expect(course.categories).toEqual(expect.arrayContaining(categories));
      }
    }
  });

  it('should support search in course name and lecturer name with keyword', async () => {
    const fuseOptions = {
      keys: [
        'names',
        'lecturer',
      ],
      threshold: 0.6,
    };
    const courses = await models.Course.find().lean({ versionKey: false }).exec();
    const fuse = new Fuse(courses, fuseOptions);

    for (const keyword of ['大學國文', '汪詩珮', '文學']) {
      const res = await request(app)
        .get('/api/courses/search')
        .query(qs.stringify({ keyword, limit: 100 }))
        .expect(200);
      const result = fuse.search(keyword).map(({ item }) => item);
      expect(res.body.items).toStrictEqual(result);
    }
  });

  it('should support pagination', async () => {
    const param = {};
    for (const offset of [0, 1, 99, 100, 101]) {
      for (const limit of [1, 5, 10, 20, 100, 105]) {
        const res = await request(app)
          .get('/api/courses/search')
          .query(qs.stringify({ ...param, limit, offset }))
          .expect(200);
        expect(res.body.items).toHaveLength(Math.max(0, Math.min(100 - offset, limit)));
      }
    }
  });

  it('should support search with multiple conditions', async () => {
    const conditions: [string, string[]][] = [
      ['大學國文', ['General']],
      ['國文', []],
      ['汪詩珮', []],
      ['文學', []],
    ];
    for (const [keyword, categories] of conditions) {
      const fuseOptions = {
        keys: [
          'names',
          'lecturer',
        ],
        threshold: 0.6,
      };
      const courses = await models.Course.find().lean({ versionKey: false }).exec();
      const fuse = new Fuse(courses, fuseOptions);

      const res = await request(app)
        .get('/api/courses/search')
        .query(qs.stringify({ keyword, categories, limit: 100 }))
        .expect(200);

      const result = fuse.search(keyword).map(({ item }) => item);
      const filteredResult = result.filter(course => course.categories.every(category => categories.includes(category)));

      const resCourses = ZCourseSchema.array().parse(res.body.items);

      expect(filteredResult).toEqual(expect.arrayContaining(resCourses));
    }
  });
});
