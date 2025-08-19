import { readFileSync } from 'fs';
import path from 'path';
import type mongoose from 'mongoose';
import { expect } from 'vitest';
import z from 'zod';
import { type Article, ArticleModel, ZArticleSchema } from '@models/article-schema.ts';
import { type Course, CourseModel, ZCourseSchema } from '@models/course-schema.ts';
import { models } from '@models/index.ts';
import { type Quiz, QuizModel, ZQuizSchema } from '@models/quiz-schema.ts';
import { type User, UserModel, ZUserSchema } from '@models/user-schema.ts';
import { ZErrorSchema } from './response-schemas.ts';

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

const expectValidErrorResponse = (body: unknown) => {
  expect(z.strictObject(ZErrorSchema.shape).safeParse(body).success).toBe(true);
};

const parseAndExpectValid = <T extends z.ZodRawShape>
(schema: z.ZodObject<T>, body: unknown): z.infer<z.ZodObject<T>> => {
  const strictSchema = z.strictObject(schema.shape);
  const result = strictSchema.safeParse(body);
  expect(result.success).toBe(true);
  return result.data!;
};

const getTestDoc = async <T>(model: mongoose.Model<T>): Promise<T> => {
  const count = await model.countDocuments().exec();
  const random = Math.floor(Math.random() * count);
  const doc = await model.findOne().skip(random).lean({ versionKey: false }).exec();
  if (!doc) throw new Error(`No test ${model.modelName.toLowerCase()} found`);
  return doc as T;
};

const getTestArticle = async (): Promise<Article> => {
  return getTestDoc(ArticleModel);
};

const getTestUser = async (): Promise<User> => {
  return getTestDoc(UserModel);
};

const getTestQuiz = async (): Promise<Quiz> => {
  return getTestDoc(QuizModel);
};

const getTestCourse = async (): Promise<Course> => {
  return getTestDoc(CourseModel);
};

export { expectValidErrorResponse, parseAndExpectValid, seedModelFromSamples, getTestArticle, getTestUser, getTestQuiz, getTestCourse };
