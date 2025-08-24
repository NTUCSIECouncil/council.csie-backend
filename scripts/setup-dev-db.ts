import fs from 'fs/promises';
import path from 'path';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { ZArticleSchema } from '@models/article-schema.ts';
import { ZCourseSchema } from '@models/course-schema.ts';
import { models } from '@models/index.ts';
import { ZQuizSchema } from '@models/quiz-schema.ts';
import { ZUserSchema } from '@models/user-schema.ts';

dotenv.config({ path: ['.env', '.env.default'], quiet: true });

if (
  process.env.MONGODB_URI === undefined
  || process.env.MONGODB_DB_NAME === undefined
  || process.env.UPLOADS_DIR === undefined
  || process.env.SAMPLES_DIR === undefined
) {
  console.error('One or more environment variables are not set');
  console.error('Exiting...');
  process.exit();
}

const ZSchema = {
  Article: ZArticleSchema,
  Course: ZCourseSchema,
  Quiz: ZQuizSchema,
  User: ZUserSchema,
};

const insertFromFile = async (
  model: 'Article' | 'Course' | 'Quiz' | 'User',
) => {
  const filePath = path.join(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- env.SAMPLES_DIR is checked above
    process.env.SAMPLES_DIR!,
    `${model.toLowerCase()}-samples.json`,
  );
  const data = await fs.readFile(filePath, 'utf-8');
  const objs = ZSchema[model].array().parse(JSON.parse(data));

  for (const obj of objs) {
    const doc = new models[model](obj);
    await doc.save();
  }
  console.log(
    `Inserted ${objs.length.toString()} ${model} data from ${filePath} into database ${dbName}`,
  );
};

const dbName = process.env.MONGODB_DB_NAME;

console.log(
  `Connecting to MongoDB database ${dbName} at ${process.env.MONGODB_URI}`,
);

await mongoose.connect(process.env.MONGODB_URI, { dbName });

console.log('Connected to MongoDB');
if (mongoose.connection.db === undefined) throw new Error('DB is not set.');
console.log(`Dropping database "${dbName}"`);
await mongoose.connection.db.dropDatabase();
console.log(`Dropped database "${dbName}"`);

console.log(`Using samples directory: ${process.env.SAMPLES_DIR}`);
console.log('Inserting data into database');
for (const model in ZSchema) {
  await insertFromFile(model as 'Article' | 'Course' | 'Quiz' | 'User');
}

console.log('Inserted data into database');

console.log(
  `Copying article files and quiz files to ${process.env.UPLOADS_DIR}`,
);

const uploadsPath = process.env.UPLOADS_DIR;
await fs.rm(uploadsPath, { recursive: true, force: true });
await fs.mkdir(uploadsPath, { recursive: true });

const articleFilesSrcPath = path.join(
  process.env.SAMPLES_DIR,
  'article-file-samples',
);
const articleFilesDestPath = path.join(uploadsPath, 'articles');
await fs.cp(articleFilesSrcPath, articleFilesDestPath, { recursive: true });

const quizFilesSrcPath = path.join(
  process.env.SAMPLES_DIR,
  'quiz-file-samples',
);
const quizFilesDestPath = path.join(uploadsPath, 'quizzes');
await fs.cp(quizFilesSrcPath, quizFilesDestPath, { recursive: true });

console.log(
  `Copied article files and quiz files to ${process.env.UPLOADS_DIR}`,
);

await mongoose.disconnect();
