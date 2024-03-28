import { models } from '../src/models/index'
import DB from './db';

async function createMockData() {
  await DB.createFromJSON(models.User, 'test/users.example.json');
  await DB.createFromJSON(models.Article, 'test/articles.example.json', await models.User.find().exec());
  console.log(await models.Article.find().exec());
}

describe("Article", function () {
  beforeAll(async () => {
    await DB.connectDB();
    await createMockData();
  });

  // beforeEach(async () => {
  //   await createMockData();
  // })

  // afterEach(async () => {
  //   await DB.dropCollection();
  // });

  afterAll(async () => {
    await DB.dropCollection();
    await DB.dropDB();
  });

  describe('findByKeyword', () => {
    test('Should return all articles', async () => {
      expect(await models.Article.find().exec()).toHaveLength(3);
    });

    test('Should return 2 articles', async () => {
      
      const records = await models.Article.find({
        $or: [
          { title: { $regex: '耶', $options: 'i' } },
          { lecturer: { $regex: '耶', $options: 'i' } },
          { tag: { $regex: '耶', $options: 'i' } },
          { content: { $regex: '耶', $options: 'i' } }
        ]
      }).exec();

      expect(records).toHaveLength(2);
    });
  });
});
