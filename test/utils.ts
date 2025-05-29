import { readFileSync } from 'fs';
import path from 'path';
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
  const filePath = path.join(import.meta.dirname, '..', 'samples', `${model.toLowerCase()}-samples.json`);
  const objs = ZSchema[model].array().parse((JSON.parse(readFileSync(filePath, 'utf-8')) as unknown[]).slice(0, 100));

  for (const obj of objs) {
    const doc = new models[model](obj);
    await doc.save();
  }
};

export { insertFromFile };
