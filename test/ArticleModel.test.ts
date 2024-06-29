import { models } from '@models/index';
import qs from 'qs';
import DB from './db';
import request from 'supertest';
import app from './app';

async function createMockData() {
  await DB.createFromJSON(models.User, 'test/users.example.json');
  // console.log(await models.User.find().exec());
  await DB.createFromJSON(models.Article, 'test/articles.example.json');
  // console.log(await models.Article.find().exec());
}

describe("Article", function () {
  beforeAll(async () => {
    await DB.connectDB();
    await createMockData();
  });

  afterAll(async () => {
    await DB.dropCollection();
    await DB.dropDB();
  });

  describe('GET requests', () => {
    it('/api/articles', async () => {
      const res = await request(app)
        .get('/api/articles/')
        .expect(200);
      expect(res.body.result).toHaveLength(10);
    });

    it('/api/articles - portionNum', async () => {
      let res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionNum: 1 }))
        .expect(200);
      expect(res.body.result).toHaveLength(10);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionNum: 2 }))
        .expect(200);
      expect(res.body.result).toHaveLength(1);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionNum: 3 }))
        .expect(400);
    });

    it('/api/articles - portionSize', async () => {
      let res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionSize: 20 }))
        .expect(200);
      expect(res.body.result).toHaveLength(20);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionSize: 50 }))
        .expect(200);
      expect(res.body.result).toHaveLength(21);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionSize: 100 }))
        .expect(200);
      expect(res.body.result).toHaveLength(21);
      res = await request(app)
        .get('/api/articles?' + qs.stringify({ portionSize: 21 }))
        .expect(400);
    });

    it('/api/articles/search', async () => {
      const query = { 
        tag: ['德邦讚']
      };
      const res = await request(app)
        .get('/api/articles/search?' + qs.stringify(query))
        .expect(200);

      expect(res.body.result).toHaveLength(14);
    });
  });
});
