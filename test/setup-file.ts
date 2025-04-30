import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll } from '@jest/globals';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let instance: MongoMemoryServer;

dotenv.config({ path: 'test/.test.env' });
dotenv.config({ path: '.default.env' });
dotenv.config({ path: '.env' });

// Add process PID for test temp dirs
if (process.env.QUIZ_FILE_DIR) {
  process.env.QUIZ_FILE_DIR = `${process.env.QUIZ_FILE_DIR}_${process.pid.toString()}`;
}
if (process.env.ARTICLE_FILE_DIR) {
  process.env.ARTICLE_FILE_DIR = `${process.env.ARTICLE_FILE_DIR}_${process.pid.toString()}`;
}

const { env } = await import('@/config.ts');

beforeAll(async () => {
  instance = await MongoMemoryServer.create();
  const uri = instance.getUri();
  (global as any).__MONGOINSTANCE = instance; // eslint-disable-line
  process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf('/'));

  const conn = await mongoose.connect(process.env.MONGO_URI);
  if (conn.connection.db !== undefined) await conn.connection.db.dropDatabase();

  fs.mkdirSync(env.QUIZ_FILE_DIR, { recursive: true });
  fs.mkdirSync(env.ARTICLE_FILE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(env.ARTICLE_FILE_DIR, '00000002-1131-0000-0000-000000000002.md'),
    'test',
    'utf8');
  fs.writeFileSync(
    path.join(env.QUIZ_FILE_DIR, '00000004-1131-0000-0000-000000000000.pdf'),
    'test',
    'utf8');
});

afterAll(async () => {
  await mongoose.disconnect();

  fs.rmSync(env.QUIZ_FILE_DIR, { recursive: true, force: true });
  fs.rmSync(env.ARTICLE_FILE_DIR, { recursive: true, force: true });
  await instance.stop();
});
