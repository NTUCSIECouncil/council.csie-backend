import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { type PaginationQueryParam, type QuizSearchParam, ZUuidSchema } from '@models/util-schema.ts';
import app from './app.ts';
import { insertFromFile } from './utils.ts';

beforeEach(async () => {
  await insertFromFile('Course');
  await insertFromFile('Quiz');
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe('GET /api/quizzes', () => {
  it('should response the first page', async () => {
    const res = await request(app)
      .get('/api/quizzes/')
      .expect(200);
    expect(res.body.items).toHaveLength(5);
  });

  it('should support controlling both the offset and the limit size of page', async () => {
    let res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 1, offset: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(1);

    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 1, offset: 20 })
      .expect(200);
    expect(res.body.items).toHaveLength(0);

    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 5, offset: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(4);

    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 3, offset: 1 })
      .expect(200);
    expect(res.body.items).toHaveLength(3);
  });
});

describe('POST /api/quizzes', () => {
  it('should create a quiz', async () => {
    let res = await request(app)
      .post('/api/quizzes')
      .send({
        title: '普通生物學',
        course: '00000003-0003-0000-0000-000000000000',
        semester: '112-1',
        downloadLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/quizzes/${uuid}`)
      .expect(200);
    expect(res.body.item).toMatchObject({
      title: '普通生物學',
      course: '00000003-0003-0000-0000-000000000000',
      semester: '112-1',
      downloadLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('should ignore provided uuid', async () => {
    let res = await request(app)
      .post('/api/quizzes')
      .send({
        _id: '00000004-0006-0000-0000-000000000000',
        title: '普通生物學',
        course: '00000003-0003-0000-0000-000000000000',
        semester: '112-1',
        downloadLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.uuid);

    res = await request(app)
      .get(`/api/quizzes/${uuid}`)
      .expect(200);
    expect(res.body.item).toMatchObject({
      title: '普通生物學',
      course: '00000003-0003-0000-0000-000000000000',
      semester: '112-1',
      downloadLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    expect(uuid).not.toEqual('00000004-0006-0000-0000-000000000000');
  });
});

describe('GET /api/quizzes/:uuid', () => {
  it('should response the quiz with uuid', async () => {
    const res = await request(app)
      .get('/api/quizzes/00000004-0002-0000-0000-000000000000')
      .expect(200);
    expect(res.body.item).toMatchObject({
      _id: '00000004-0002-0000-0000-000000000000',
      title: '普通物理學',
      course: '00000003-0001-0000-0000-000000000000',
      semester: '111-2',
      downloadLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });

    await request(app)
      .get('/api/quizzes/00000004-0000-0000-0000-000000000000')
      .expect(404);
  });
});

describe('GET /api/quizzes/:uuid/file', () => {
  it('should response the quiz file', async () => {
    const res = await request(app)
      .get('/api/quizzes/00000004-0001-0000-0000-000000000000/file')
      .expect(200);
    expect(res.type).toEqual('application/pdf');

    await request(app)
      .get('/api/quizzes/00000004-0000-0000-0000-000000000000/file')
      .expect(404);
  });
});

describe('GET /api/quizzes/search', () => {
  it('should response the search result', async () => {
    let query: QuizSearchParam | PaginationQueryParam = {
      course: '00000003-0001-0000-0000-000000000000',
    };
    let res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body);

    query = {
      course: '00000003-0001-0000-0000-000000000000',
      keyword: '111-2',
    };
    res = await request(app)
      .get('/api/quizzes/search')
      .query(query)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
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
