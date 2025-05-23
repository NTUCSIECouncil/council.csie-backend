import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll } from 'vitest';

dotenv.config({ path: 'test/.test.env' });
dotenv.config({ path: '.default.env' });
dotenv.config({ path: '.env' });

if (!process.env.QUIZ_FILE_DIR || !process.env.ARTICLE_FILE_DIR || !process.env.VITEST_POOL_ID) {
  throw new Error('Missing environment variables: QUIZ_FILE_DIR, ARTICLE_FILE_DIR, VITEST_POOL_ID');
}
// Ensure the directories are unique for each test worker
process.env.QUIZ_FILE_DIR = `${process.env.QUIZ_FILE_DIR}_${process.env.VITEST_POOL_ID}`;
process.env.ARTICLE_FILE_DIR = `${process.env.ARTICLE_FILE_DIR}_${process.env.VITEST_POOL_ID}`;

const { env } = await import('@/config.ts');

let instance: MongoMemoryServer;

beforeAll(async () => {
  instance = await MongoMemoryServer.create();
  const uri = instance.getUri();

  const conn = await mongoose.connect(uri);
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
  await instance.stop();

  fs.rmSync(env.QUIZ_FILE_DIR, { recursive: true, force: true });
  fs.rmSync(env.ARTICLE_FILE_DIR, { recursive: true, force: true });
});
