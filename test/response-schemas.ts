import z from 'zod';

import { ZQuizSessionSchema } from '@/models/quiz-schema.ts';
import { ZUuidSchema } from '@/models/util-schema.ts';

const ZErrorSchema = z.object({
  message: z.string(),
  details: z.object({}).optional(),
});

const ZMetaSchema = z.object({
  total: z.int().nonnegative(),
  offset: z.int().nonnegative(),
  limit: z.int().positive(),
});

const ZCourseResponseSchema = z.object({
  _id: ZUuidSchema,
  curriculum: z.string(),
  lecturer: z.string(),
  class: z.string().optional(),
  names: z.string().array(),
  credit: z.int().nonnegative(),
  semester: z.string(),
});

const ZUserResponseSchema = z.object({
  _id: ZUuidSchema,
  nickname: z.string(),
});

const ZPrivateUserResponseSchema = ZUserResponseSchema.extend({
  gid: z.string(),
  email: z.email(),
  name: z.string(),
});

const ZArticleResponseSchema = z.object({
  _id: ZUuidSchema,
  title: z.string(),
  tags: z.string().array(),
  ratings: z.object({
    sweetness: z.int().min(1).max(5),
    chill: z.int().min(1).max(5),
    teaching: z.int().min(1).max(5),
    gain: z.int().min(1).max(5),
    recommend: z.int().min(1).max(5),
  }),
  course: z.union([ZUuidSchema, ZCourseResponseSchema]),
  creator: z.union([ZUuidSchema, ZUserResponseSchema]),
  content: z.string().optional(),
});

const ZQuizResponseSchema = z.object({
  _id: ZUuidSchema,
  session: ZQuizSessionSchema,
  course: z.union([ZUuidSchema, ZCourseResponseSchema]),
  uploader: z.union([ZUuidSchema, ZUserResponseSchema]),
});

export {
  ZErrorSchema,
  ZMetaSchema,
  ZCourseResponseSchema,
  ZUserResponseSchema,
  ZPrivateUserResponseSchema,
  ZArticleResponseSchema,
  ZQuizResponseSchema,
};
