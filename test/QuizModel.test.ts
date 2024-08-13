import { models } from '@models/index';
import qs from 'qs';
import DB from './db';
import request from 'supertest';
import app from './app';

async function createMockData() {
  await DB.createFromJSON(models.Course, 'test/courses.example.json');
  // console.log(await models.Course.find().exec());
  await DB.createFromJSON(models.Quiz, 'test/quizzes.example.json');
  // console.log(await models.Quiz.find().exec());
}

describe("Quiz", function () {
  beforeAll(async () => {
    await DB.connectDB();
    await createMockData();
  });

  afterAll(async () => {
    await DB.dropCollection();
    await DB.dropDB();
  });

  describe('GET requests', () => {
    it('/api/quizzes/', async () => {
      const res = await request(app)
        .get('/api/quizzes/')
        .expect(200);
      expect(res.body.result).toHaveLength(5);
    });

    it('/api/quizzes/:uuid', async () => {
      const res = await request(app)
        .get('/api/quizzes/00000004-0002-0000-0000-000000000000')
        .expect(200);
      expect(res.body.result.title).toBe('普通物理學');
    });

    it('/api/quizzes/search', async () => {
      const query = { 
        course: '00000003-0001-0000-0000-000000000000'
      };
      const res = await request(app)
        .get('/api/quizzes/search?' + qs.stringify(query))
        .expect(200);

      expect(res.body.result).toHaveLength(3);
    });

    it('/api/quizzes/search', async () => {
      const query = { 
        course: '00000003-0001-0000-0000-000000000000',
        keyword: '111-2'
      };
      const res = await request(app)
        .get('/api/quizzes/search?' + qs.stringify(query))
        .expect(200);

      expect(res.body.result).toHaveLength(1);
    });
  });
});
