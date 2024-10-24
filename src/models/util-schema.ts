import { type UUID } from 'crypto';
import { z } from 'zod';

const ZUuidSchema = z.custom<UUID>((val) => {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
});

const ZPaginationQueryParam = z.object({
  offset: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().positive().optional(),
});

interface PaginationQueryParam extends z.infer<typeof ZPaginationQueryParam> {};

// no need to catch error, because all attributes are optional
const ZArticleSearchQueryParam = z.object({
  tag: z.string().array().optional(),
  keyword: z.string().optional(),
  categories: z.string().array().optional(),
  lecturer: z.string().optional(),
  grade: z.number().gte(1).lte(4).optional(),
});

interface ArticleSearchQueryParam extends z.infer<typeof ZArticleSearchQueryParam> {};

// interface ArticleSearchQueryParam {
//   tag?: string[];
//   keyword?: string;
//   categories?: string[];
//   lecturer?: string;
//   grade?: number;
// }

const ZQuizSearchParam = z.object({
  course: ZUuidSchema,
  keyword: z.string().optional(),
});

interface QuizSearchParam extends z.infer<typeof ZQuizSearchParam> {};

// interface QuizSearchParam {
//   course: UUID;
//   keyword?: string;
// }

export { ZUuidSchema, type PaginationQueryParam, ZPaginationQueryParam, type ArticleSearchQueryParam, ZArticleSearchQueryParam, type QuizSearchParam, ZQuizSearchParam };
