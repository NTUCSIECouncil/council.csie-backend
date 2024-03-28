import { connect, connection, Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { readFileSync } from 'fs';
import { type Article } from '../src/models/ArticleSchema';
import { type User } from '../src/models/UserSchema';

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

  static async createFromJSON(model: Model<Article> | Model<User>, path: string, ids: User[] = []) {
    const rawData = await readFileSync(path, 'utf-8');
    const data = await JSON.parse(rawData);
  
    await data.forEach(async (datum: any, i: number) => {
      // console.log(ids);
      if (ids.length) {
        if (i >= ids.length) datum['creator'] = await ids[ids.length-1];
        else datum['creator'] = await ids[i];
      }
      // console.log(datum);
      const doc = await new model(datum);
      await doc.save();
    });
  }
}

export default DB;