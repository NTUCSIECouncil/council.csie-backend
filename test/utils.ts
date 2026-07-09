import { readFileSync } from 'fs';
import path from 'path';

import type mongoose from 'mongoose';
import request from 'supertest';
import { expect } from 'vitest';
import z from 'zod';

import {
  ArticleModel,
  ZArticleSchema,
  type Article,
} from '@models/article-schema.ts';
import {
  CourseModel,
  ZCourseSchema,
  type Course,
} from '@models/course-schema.ts';
import { models } from '@models/index.ts';
import { QuizModel, ZQuizSchema, type Quiz } from '@models/quiz-schema.ts';
import { UserModel, ZUserSchema, type User } from '@models/user-schema.ts';
import app from './app.ts';
import { ZErrorSchema } from './response-schemas.ts';

const ZSchema = {
  Article: ZArticleSchema,
  Course: ZCourseSchema,
  Quiz: ZQuizSchema,
  User: ZUserSchema,
};

const seedModelFromSamples = async (
  model: 'Article' | 'Course' | 'Quiz' | 'User',
) => {
  const filePath = path.join(
    process.env.SAMPLES_DIR!,
    `${model.toLowerCase()}-samples.json`,
  );
  const data = readFileSync(filePath, 'utf-8');
  const objs = ZSchema[model].array().parse(JSON.parse(data)).slice(0, 100);

  for (const obj of objs) {
    const doc = new models[model](obj);
    await doc.save();
  }
};

const expectValidErrorResponse = (body: unknown) => {
  expect(z.strictObject(ZErrorSchema.shape).safeParse(body).success).toBe(true);
};

// Asserts an embedded user (?embed=creator/uploader) exposes only the public UserResponse fields, never the private gid/email/name.
const expectPublicUserOnly = (user: unknown) => {
  expect(user).toBeTypeOf('object');
  expect(user).not.toBeNull();
  expect(Object.keys(user as Record<string, unknown>).sort()).toEqual([
    '_id',
    'nickname',
  ]);
};

const parseAndExpectValid = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  body: unknown,
): z.infer<z.ZodObject<T>> => {
  const strictSchema = z.strictObject(schema.shape);
  const result = strictSchema.safeParse(body);
  expect(result.success).toBe(true);
  return result.data!;
};

const getTestDoc = async <T>(model: mongoose.Model<T>): Promise<T> => {
  const count = await model.countDocuments().exec();
  const random = Math.floor(Math.random() * count);
  const doc = await model
    .findOne()
    .skip(random)
    .lean({ versionKey: false })
    .exec();
  if (!doc) throw new Error(`No test ${model.modelName.toLowerCase()} found`);
  return doc;
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

const authedRequest = (path: string) =>
  request(app).get(path).set('gid', 'mock-gid');

export {
  expectValidErrorResponse,
  expectPublicUserOnly,
  parseAndExpectValid,
  seedModelFromSamples,
  getTestArticle,
  getTestUser,
  getTestQuiz,
  getTestCourse,
  authedRequest,
};
