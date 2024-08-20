import mongoose from 'mongoose';
import { beforeAll, afterAll } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';

let instance: MongoMemoryServer;

beforeAll(async () => {
  instance = await MongoMemoryServer.create();
  const uri = instance.getUri();
  (global as any).__MONGOINSTANCE = instance; // eslint-disable-line
  process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf('/'));

  const conn = await mongoose.connect(process.env.MONGO_URI);
  if (conn.connection.db !== undefined) await conn.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  await instance.stop();
});
