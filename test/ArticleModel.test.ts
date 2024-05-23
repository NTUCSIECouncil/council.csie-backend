import { models } from '@models/index';
import DB from './db';
import request from 'supertest';
import app from './app';

async function createMockData() {
  await DB.createFromJSON(models.User, 'test/users.example.json');
  // console.log(await models.User.find().exec());
  await DB.createFromJSON(models.Article, 'test/articles.example.json', await models.User.find().exec());
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
      expect(res.body.result).toHaveLength(3);
    });

    it('/api/articles/search', async () => {
      const query = [
        {
          'tag': ['德邦讚']
        }
      ];
      const res = await request(app)
        .get('/api/articles/')
        .send([{ 'query':  query }])
        .expect(200);

      expect(res.body.result).toHaveLength(2);
    });
  });
});
