import { models } from '@models/index';
import DB from './db';
import request from 'supertest';
import app from './app';

async function createMockData() {
  await DB.createFromJSON(models.User, 'test/users.example.json');
  // console.log(await models.User.find().exec());
}

describe("User", () => {
  beforeAll(async () => {
    await DB.connectDB();
    await createMockData();
  });

  afterAll(async () => {
    await DB.dropCollection();
    await DB.dropDB();
  });

  describe('GET requests', () => {
    it('/api/users/:uid', async () => {
      const res = await request(app)
        .get('/api/users/00000001-0001-0000-0000-000000000000')
        .set({ uid: '00000001-0001-0000-0000-000000000000' })
        .expect(200);
      expect(res.body._id).toBe('00000001-0001-0000-0000-000000000000');
    });

    it('/api/users/myself', async () => {
      const res = await request(app)
        .get('/api/users/myself')
        .set({ uid: '00000001-0001-0000-0000-000000000000' })
        .expect(200);
      expect(res.body._id).toBe('00000001-0001-0000-0000-000000000000');
    });
  });
});
