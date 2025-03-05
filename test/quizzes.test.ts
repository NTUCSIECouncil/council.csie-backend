import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { type PaginationQueryParam, type QuizSearchParam, ZUuidSchema } from '@models/util-schema.ts';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  process.env.QUIZ_FILE_DIR = 'test/dummy-data/quiz_file_samples';
  await insertFromFile('Course');
  await insertFromFile('Quiz');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/quizzes', () => {
  it('should response the first page and receive at most 10 quizzes', async () => {
    const res = await request(app)
      .get('/api/quizzes/')
      .expect(200);
    expect(res.body.items).toHaveLength(10); // default limit is 10
  });

  it('should support controlling both the offset and the limit size of page', async () => {
    // adjust the limit and offset
    let res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 1, offset: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    // the offset is out of range (there are only 100 quizzes)
    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 1, offset: 200 })
      .expect(200);
    expect(res.body.items).toHaveLength(0);

    // the limit is out of range (there are only 100 quizzes)
    // should retun the remaining quizzes(1)
    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 10, offset: 99 })
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    // large limit
    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 200, offset: 0 })
      .expect(200);
    expect(res.body.items).toHaveLength(100);
  });
});

describe('POST /api/quizzes', () => {
  it('should create a quiz', async () => {
    // create a quiz
    let res = await request(app)
      .post('/api/quizzes')
      .send({
        course: '00000003-0003-0000-0000-000000000000',
        uploader: '00000001-0001-0000-0000-000000000000',
        semester: '112-1',
        session: 'midterm',
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/quizzes/${uuid}`)
      .expect(200);
    expect(res.body.item).toMatchObject({
      course: '00000003-0003-0000-0000-000000000000',
      uploader: '00000001-0001-0000-0000-000000000000',
      semester: '112-1',
      session: 'midterm',
    });
  });

  it('should ignore provided uuid', async () => {
    let res = await request(app)
      .post('/api/quizzes')
      .send({
        _id: '00000004-0006-0000-0000-000000000000',
        course: '00000003-0003-0000-0000-000000000000',
        uploader: '00000002-0000-0000-0000-000000000000',
        semester: '112-1',
        session: 'midterm',
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/quizzes/${uuid}`)
      .expect(200);
    expect(res.body.item).toMatchObject({
      course: '00000003-0003-0000-0000-000000000000',
      uploader: '00000002-0000-0000-0000-000000000000',
      semester: '112-1',
      session: 'midterm',
    });
    expect(uuid).not.toEqual('00000004-0006-0000-0000-000000000000');

    res = await request(app)
      .post('/api/quizzes')
      .send({
        _id: '00000004-0006-0000-0000-000000000000',
        course: '00000003-0003-0000-0000-000000000000',
      })
      .expect(400);
  });
});

describe('GET /api/quizzes/:uuid', () => {
  it('should response the quiz with uuid', async () => {
    const res = await request(app)
      .get('/api/quizzes/00000004-1131-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000004-1131-0000-0000-000000000000',
      course: '00000003-0000-0000-0000-000000000000',
      uploader: '00000001-0003-0000-0000-000000000000',
      semester: '113-1',
      session: 'midterm',
    });

    await request(app)
      .get('/api/quizzes/00000004-0000-0000-0000-000000000000')
      .expect(404);

    await request(app)
      .get('/api/quizzes/00000004-0000-0000-0000')
      .expect(400);
  });
});

describe('GET /api/quizzes/:uuid/file', () => {
  it('should response the quiz file', async () => {
    // the file exists
    const res = await request(app)
      .get('/api/quizzes/00000004-1131-0000-0000-000000000000/file')
      .expect(200);
    expect(res.type).toEqual('application/pdf');

    // the uuid does not exist
    await request(app)
      .get('/api/quizzes/00000004-0000-0000-0000-000000000000/file')
      .expect(404);

    // the uuid exist but the file does not
    await request(app)
      .get('/api/quizzes/00000004-1131-0001-0000-000000000000/file')
      .expect(500);

    // invalid uuid (wrong format)
    await request(app)
      .get('/api/quizzes/00000004-0000-0000-0000/file')
      .expect(400);
  });
});

describe('GET /api/quizzes/search', () => {
  it('should response the search result', async () => {
    // search only by course
    let query: QuizSearchParam | PaginationQueryParam = {
      course: '00000003-0000-0000-0000-000000000000',
    };
    let res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body);

    // course does not exist
    query = {
      course: '00000003-0001-0000-0000-000000000000',
    };
    res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body.items).toHaveLength(0);

    // search by course and semester
    query = {
      course: '00000003-0001-0000-0000-000000000000',
      keyword: '113-1',
    };
    res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body.items).toHaveLength(4);

    query = {
      limit: 2,
    };
    res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body.items).toHaveLength(2);
  });

  it('should support pagination', async () => {
    let query: QuizSearchParam | PaginationQueryParam = {
      limit: 2,
      course: '00000003-0001-0000-0000-000000000000',
    };
    let res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body.items).toHaveLength(2);

    query = {
      offset: 1,
      course: '00000003-0001-0000-0000-000000000000',
    };
    res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body.items).toHaveLength(2);

    query = {
      offset: 3,
      course: '00000003-0001-0000-0000-000000000000',
    };
    res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body.items).toHaveLength(0);
  });
});
