import { readFileSync } from 'fs';
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

const insertFromFile = async (model: 'Article' | 'Course' | 'Quiz' | 'User') => {
  const filePath = `test/samples/${model.charAt(0).toLowerCase() + model.slice(1)}_samples.json`;
  const objs = ZSchema[model].array().parse(JSON.parse(readFileSync(filePath, 'utf-8')));

  for (const obj of objs) {
    const doc = new models[model](obj);
    await doc.save();
  }
  console.log(`Inserted ${objs.length.toString()} ${model} data from ${filePath} into database ${String(dbName)}`);
};

// check env
if (process.env.MONGODB_URL === undefined) {
  console.log('env.MONGODB_URL not found');
  process.exit();
}
if (process.env.MONGODB_DEV_DB_NAME === undefined) {
  console.log('env.MONGODB_DEV_DB_NAME not found');
  process.exit();
}

const dbName = process.env.MONGODB_DEV_DB_NAME;

await mongoose.connect(process.env.MONGODB_URL, {
  dbName,
});

console.log('Connected to MongoDB');
if (mongoose.connection.db === undefined) throw new Error('DB is not set.');
console.log(`Dropping database "${String(dbName)}"`);
await mongoose.connection.db.dropDatabase();
console.log(`Dropped database "${String(dbName)}"`);

console.log('Inserting data into database');
for (const model in ZSchema) {
  await insertFromFile(model as 'Article' | 'Course' | 'Quiz' | 'User');
}
await mongoose.disconnect();
