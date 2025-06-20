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

const seedModelFromSamples = async (model: 'Article' | 'Course' | 'Quiz' | 'User') => {
  const filePath = path.join(import.meta.dirname, '..', 'samples', `${model.toLowerCase()}-samples.json`);
  const data = readFileSync(filePath, 'utf-8');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Safe to use in schema validation
  const objs = ZSchema[model].array().parse(JSON.parse(data).slice(0, 100));

  for (const obj of objs) {
    const doc = new models[model](obj);
    await doc.save();
  }
};

export { seedModelFromSamples };
