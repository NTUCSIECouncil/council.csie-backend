import { readFileSync } from 'fs';
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
  const filePath = `test/dummy-data/${model.charAt(0).toLowerCase() + model.slice(1)}_samples.json`;
  const objs = ZSchema[model].array().parse((JSON.parse(readFileSync(filePath, 'utf-8')) as unknown[]).slice(0, 1000));

  for (const obj of objs) {
    const doc = new models[model](obj);
    await doc.save();
  }
};

export { insertFromFile };
