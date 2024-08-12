import { connect, connection, Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { readFileSync } from 'fs';
import { type Article } from '../src/models/article-schema';
import { type User } from '../src/models/user-schema';
import { Course } from '@models/course-schema';
import { Quiz } from '@models/quiz-schema';

class DB {
  static mongoServer: MongoMemoryServer;
  static async connectDB() {
    if (this.mongoServer == undefined) {
      this.mongoServer = await MongoMemoryServer.create();
      const uri = await this.mongoServer.getUri();
      await connect(uri, {});
    }
  }

  static async dropCollection() {
    if (this.mongoServer) {
      const collections = await connection.db.collections();
      for (let collection of collections) {
        await collection.drop();
      }
    }
  }

  static async dropDB() {
    if (this.mongoServer) {
      await connection.dropDatabase();
      await connection.close();
      await this.mongoServer.stop();
    }
  }

  static async createFromJSON(model: Model<Article> | Model<User> | Model<Course> | Model<Quiz>, path: string, ids: any[] = []) {
    const rawData = await readFileSync(path, 'utf-8');
    const data = await JSON.parse(rawData);
  
    for (let i = 0; i < data.length; i++) {
      const datum = data[i];
      const doc = new model(datum);
      await doc.save();
    }
  }
}

export default DB;