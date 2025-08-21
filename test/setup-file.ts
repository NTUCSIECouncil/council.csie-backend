import fs from 'fs/promises';
import path from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll } from 'vitest';

if (
  !process.env.UPLOADS_DIR ||
  !process.env.VITEST_POOL_ID ||
  !process.env.SAMPLES_DIR
) {
  throw new Error(
    'Missing environment variables: UPLOADS_DIR, VITEST_POOL_ID, SAMPLES_DIR',
  );
}
// Ensure the directories are unique for each test worker
process.env.UPLOADS_DIR = path.join(
  process.env.UPLOADS_DIR,
  process.env.VITEST_POOL_ID,
);

const { env } = await import('@/config.ts');

let instance: MongoMemoryServer;

beforeAll(async () => {
  instance = await MongoMemoryServer.create();
  const uri = instance.getUri();

  const conn = await mongoose.connect(uri);
  if (conn.connection.db !== undefined) await conn.connection.db.dropDatabase();

  const samplesDir = process.env.SAMPLES_DIR!;
  await fs.cp(
    path.join(samplesDir, 'article-file-samples'),
    path.join(env.UPLOADS_DIR, 'articles'),
    { recursive: true },
  );
  await fs.cp(
    path.join(samplesDir, 'quiz-file-samples'),
    path.join(env.UPLOADS_DIR, 'quizzes'),
    {
      recursive: true,
    },
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await instance.stop();
});
