import { connect, disconnect } from 'mongoose';
import { readFileSync } from 'fs';
import { UserModel } from '@models/user-schema.ts';
import { CourseModel } from '@models/course-schema.ts';
import { QuizModel } from '@models/quiz-schema.ts';
import { ArticleModel } from '@models/article-schema.ts';

const connectDb = async () => {
  const uri = (global as any).__MONGO_URI__ as string; // eslint-disable-line
  console.log(uri);
  const conn = await connect(uri);
  await conn.connection.db?.dropDatabase();
};

const disconnectDb = async () => {
  await disconnect();
};

const insertFromFile = async (path: string, model: ArticleModel | UserModel | CourseModel | QuizModel) => {
  const objs = JSON.parse(readFileSync(path, 'utf-8')) as unknown[];

  for (const obj of objs) {
    const doc = new model(obj);
    await doc.save();
  }
};

export { connectDb, disconnectDb, insertFromFile };
