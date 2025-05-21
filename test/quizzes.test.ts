import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZQuizSchema } from '@models/quiz-schema.ts';
import { ZUuidSchema } from '@models/util-schema.ts';
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
  it('should response the first page and receive at most 10 quizzes', async () => {
    const res = await request(app)
      .get('/api/quizzes/')
      .expect(200);
    expect(res.body.quizzes).toHaveLength(10); // default limit is 10
  });

  it('should support controlling both the offset and the limit size of page', async () => {
    // adjust the limit and offset
    let res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 1, offset: 1 })
      .expect(200);
    expect(res.body.quizzes).toHaveLength(1);

    // the offset is out of range (there are only 100 quizzes)
    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 1, offset: 200 })
      .expect(200);
    expect(res.body.quizzes).toHaveLength(0);

    // the limit is out of range (there are only 100 quizzes)
    // should retun the remaining quizzes(1)
    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 10, offset: 99 })
      .expect(200);
    expect(res.body.quizzes).toHaveLength(1);

    // large limit
    res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 200, offset: 0 })
      .expect(200);
    expect(res.body.quizzes).toHaveLength(100);
  });
});

describe('POST /api/quizzes', () => {
  it('should create a quiz', async () => {
    // create a quiz
    let res = await request(app)
      .post('/api/quizzes')
      .send({
        quiz: {
          course: '00000003-0003-0000-0000-000000000000',
          uploader: '00000001-0001-0000-0000-000000000000',
          semester: '112-1',
          session: 'midterm',
        },
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.quizId);

    res = await request(app)
      .get(`/api/quizzes/${uuid}`)
      .expect(200);
    expect(res.body.quiz).toMatchObject({
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
        quiz: {
          _id: '00000004-0006-0000-0000-000000000000',
          course: '00000003-0003-0000-0000-000000000000',
          uploader: '00000002-0000-0000-0000-000000000000',
          semester: '112-1',
          session: 'midterm',
        },
      })
      .expect(201);

    const uuid = ZUuidSchema.parse(res.body.quizId);

    res = await request(app)
      .get(`/api/quizzes/${uuid}`)
      .expect(200);
    expect(res.body.quiz).toMatchObject({
      course: '00000003-0003-0000-0000-000000000000',
      uploader: '00000002-0000-0000-0000-000000000000',
      semester: '112-1',
      session: 'midterm',
    });
    expect(uuid).not.toEqual('00000004-0006-0000-0000-000000000000');

    res = await request(app)
      .post('/api/quizzes')
      .send({
        quiz: {
          _id: '00000004-0006-0000-0000-000000000000',
          course: '00000003-0003-0000-0000-000000000000',
        },
      })
      .expect(400);
  });
});

describe('GET /api/quizzes/:uuid', () => {
  it('should response the quiz with uuid', async () => {
    const res = await request(app)
      .get('/api/quizzes/00000004-1131-0000-0000-000000000000')
      .expect(200);
    expect(res.body.quiz).toMatchObject({
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

describe('PATCH /api/quizzes/:uuid', () => {
  it('should update the quiz with uuid', async () => {
    let res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 1 })
      .expect(200);
    const quiz = ZQuizSchema.parse(res.body.quizzes[0]);

    await request(app)
      .patch(`/api/quizzes/${quiz._id}`)
      .send({
        quiz: {
          semester: '110-1',
        },
      })
      .expect(204);

    res = await request(app)
      .get(`/api/quizzes/${quiz._id}`)
      .expect(200);
    expect(res.body.quiz).toStrictEqual({ ...quiz, semester: '110-1' });
  });

  it('should reject invalid uuid', async () => {
    await request(app)
      .patch('/api/quizzes/00000002-0003-0000-0000')
      .send({
        quiz: {
          semester: '110-1',
        },
      })
      .expect(400);
  });

  it('should reject non-exist uuid', async () => {
    await request(app)
      .patch(`/api/quizzes/${randomUUID()}`)
      .send({
        quiz: {
          semester: '110-1',
        },
      })
      .expect(400);
  });

  it('should reject modification of _id', async () => {
    const res = await request(app)
      .get('/api/quizzes')
      .query({ limit: 1 })
      .expect(200);
    const quiz = ZQuizSchema.parse(res.body.quizzes[0]);

    await request(app)
      .patch(`/api/articles/${quiz._id}`)
      .send({
        quiz: {
          _id: randomUUID(),
        },
      })
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

describe('PUT /api/quizzes/:uuid/file', () => {
  const validQuizId = '00000004-1131-0001-0000-000000000000';

  it('should upload a PDF file successfully', async () => {
    const response = await request(app)
      .put(`/api/quizzes/${validQuizId}/file`)
      .attach('file', Buffer.from('mock pdf content'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(204);
  });
});
