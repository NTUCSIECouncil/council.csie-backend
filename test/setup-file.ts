import fs from 'fs/promises';
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

  await fs.rm(path.join(import.meta.dirname, 'uploads'), { recursive: true, force: true });
  await fs.mkdir(path.join(import.meta.dirname, 'uploads'), { recursive: true });

  const samplesDir = path.join(import.meta.dirname, '..', 'samples');
  await fs.cp(path.join(samplesDir, 'article-file-samples'), env.ARTICLE_FILE_DIR, { recursive: true });
  await fs.cp(path.join(samplesDir, 'quiz-file-samples'), env.QUIZ_FILE_DIR, { recursive: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await instance.stop();

  await fs.rm(path.join(import.meta.dirname, 'uploads'), { recursive: true, force: true });
});
