import request from 'supertest';
import qs from 'qs';
import { models } from '@models/index.ts';
import DB from './db.ts';
import app from './app.ts';

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
      const queryOne = { 
        tag: ['德邦讚']
      };
      const resOne = await request(app)
        .get('/api/articles/search?' + qs.stringify(queryOne))
        .expect(200);

      expect(resOne.body.result).toHaveLength(10);
      const queryTwo = { 
        tag: ['德邦讚'],
        portionNum: 1,
      };
      const resTwo = await request(app)
        .get('/api/articles/search?' + qs.stringify(queryTwo))
        .expect(200);

      expect(resTwo.body.result).toHaveLength(4);
    });
  });
});
