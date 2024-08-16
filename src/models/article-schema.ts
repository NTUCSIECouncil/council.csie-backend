import { randomUUID } from 'crypto';
import { model, Schema, type Model, type FilterQuery } from 'mongoose';
import { z } from 'zod';
import { ZUuidSchema, type ArticleSearchQueryParam } from './util-schema.ts';

const ZArticleSchema = z.object({
  _id: ZUuidSchema,
  title: z.string(),
  lecturer: z.string(),
  tag: z.string().array().optional(), // any tags the creator wants to add
  grade: z.number().optional(), // what grade is the creator when posted
  categories: z.string().array().optional(), // more official tags, ex: elective, required, etc.
  content: z.string().optional(),
  course: ZUuidSchema,
  creator: ZUuidSchema,
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

interface Article extends z.infer<typeof ZArticleSchema> {};

interface ArticleWithOptionalId extends Omit<Article, '_id'>, Partial<Pick<Article, '_id'>> {};

interface ArticleModel extends Model<ArticleWithOptionalId> {
  searchArticles: (this: ArticleModel, params: ArticleSearchQueryParam, portionNum: number, portionSize: number) => Promise<Article[]>;
}

const articleSchema = new Schema<ArticleWithOptionalId, ArticleModel>({
  _id: { type: String, default: () => randomUUID() },
  title: { type: String, required: true },
  lecturer: { type: String, required: true },
  tag: { type: [{ type: String, required: false }], required: false },
  grade: { type: Number, required: false },
  categories: { type: [{ type: String, required: false }], required: false },
  content: { type: String, required: false },
  course: { type: String, ref: 'Course', required: true },
  creator: { type: String, ref: 'User', required: true },
  createdAt: { type: Date, required: false, immutable: true, default: () => Date.now() },
  updatedAt: { type: Date, required: false, default: () => Date.now() },
});

const staticSearchArticles: ArticleModel['searchArticles'] = async function (params, portionNum, portionSize) {
  const query: FilterQuery<Article> = {};

  if (params.tag != null) {
    query.tag = { $all: params.tag };
  }

  if (params.categories != null) {
    query.categories = { $in: params.categories };
  }

  if (params.lecturer != null) {
    query.lecturer = params.lecturer;
  }

  if (params.grade != null) {
    query.grade = params.grade;
  }

  if (params.keyword != null) {
    query.$or = [
      { title: { $regex: params.keyword, $options: 'i' } },
      { content: { $regex: params.keyword, $options: 'i' } },
    ];
  }

  const result = await this.find(query).skip(portionNum * portionSize).limit(portionSize).exec();
  return result;
};

articleSchema.static('searchArticles', staticSearchArticles);

const ArticleModel = model<ArticleWithOptionalId, ArticleModel>('Article', articleSchema);

export { type Article, ArticleModel, ZArticleSchema };
