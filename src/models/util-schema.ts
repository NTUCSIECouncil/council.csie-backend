import { type UUID } from 'crypto';

import { z } from 'zod';

const ZUuidSchema = z.custom<UUID>(val => {
  return z.uuid().safeParse(val).success;
});

const ZPaginationQueryParam = z.object({
  offset: z.coerce.number().int().nonnegative().max(100).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

interface PaginationQueryParam extends z.infer<typeof ZPaginationQueryParam> {}

const ZArticleSearchQueryParam = z.object({
  tags: z.string().max(50).array().max(50).optional(),
  keyword: z.string().trim().max(100).optional(),
});

interface ArticleSearchQueryParam extends z.infer<
  typeof ZArticleSearchQueryParam
> {}

const ZArticleEmbedQueryParam = z.object({
  embed: z.array(z.enum(['course', 'creator', 'content'])).optional(),
});

interface ArticleEmbedQueryParam extends z.infer<
  typeof ZArticleEmbedQueryParam
> {}

const ZCourseSearchQueryParam = z.object({
  keyword: z.string().trim().max(100).optional(),
});

interface CourseSearchQueryParam extends z.infer<
  typeof ZCourseSearchQueryParam
> {}

const ZQuizEmbedQueryParam = z.object({
  embed: z.array(z.enum(['course', 'uploader'])).optional(),
});

interface QuizEmbedQueryParam extends z.infer<typeof ZQuizEmbedQueryParam> {}

export {
  ZUuidSchema,
  type PaginationQueryParam,
  ZPaginationQueryParam,
  type ArticleSearchQueryParam,
  ZArticleSearchQueryParam,
  type CourseSearchQueryParam,
  ZCourseSearchQueryParam,
  type ArticleEmbedQueryParam,
  ZArticleEmbedQueryParam,
  type QuizEmbedQueryParam,
  ZQuizEmbedQueryParam,
};
