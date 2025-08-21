import fs from 'fs/promises';
import path from 'path';

import mongoose from 'mongoose';

import { ZArticleSchema } from '@models/article-schema.ts';
import { ZCourseSchema } from '@models/course-schema.ts';
import { models } from '@models/index.ts';
import { ZQuizSchema } from '@models/quiz-schema.ts';
import { ZUserSchema } from '@models/user-schema.ts';

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
    import.meta.dirname,
    '..',
    'samples',
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

// check env
if (process.env.MONGODB_URI === undefined) {
  console.log('env.MONGODB_URI not found');
  process.exit();
}
if (process.env.MONGODB_DEV_DB_NAME === undefined) {
  console.log('env.MONGODB_DEV_DB_NAME not found');
  process.exit();
}

if (process.env.UPLOADS_DIR === undefined) {
  console.log('env.UPLOADS_DIR not found');
  process.exit();
}

const dbName = process.env.MONGODB_DEV_DB_NAME;

await mongoose.connect(process.env.MONGODB_URI, { dbName });

console.log('Connected to MongoDB');
if (mongoose.connection.db === undefined) throw new Error('DB is not set.');
console.log(`Dropping database "${dbName}"`);
await mongoose.connection.db.dropDatabase();
console.log(`Dropped database "${dbName}"`);

console.log('Inserting data into database');
for (const model in ZSchema) {
  await insertFromFile(model as 'Article' | 'Course' | 'Quiz' | 'User');
}

console.log('Inserted data into database');

console.log('Copying article files and quiz files to uploads/');

const uploadsPath = process.env.UPLOADS_DIR;
await fs.rm(uploadsPath, { recursive: true, force: true });
await fs.mkdir(uploadsPath, { recursive: true });

const articleFilesSrcPath = path.join(
  import.meta.dirname,
  '..',
  'samples',
  'article-file-samples',
);
const articleFilesDestPath = path.join(uploadsPath, 'articles');
await fs.cp(articleFilesSrcPath, articleFilesDestPath, { recursive: true });

const quizFilesSrcPath = path.join(
  import.meta.dirname,
  '..',
  'samples',
  'quiz-file-samples',
);
const quizFilesDestPath = path.join(uploadsPath, 'quizzes');
await fs.cp(quizFilesSrcPath, quizFilesDestPath, { recursive: true });

console.log('Copied article files and quiz files to uploads/');

await mongoose.disconnect();
