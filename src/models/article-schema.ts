import { randomUUID } from 'crypto';
import Fuse from 'fuse.js';
import { type FilterQuery, type Model, Schema, model } from 'mongoose';
import { z } from 'zod';
import { type ArticleSearchQueryParam, ZUuidSchema } from './util-schema.ts';

const ZArticleSchema = z.object({
  _id: ZUuidSchema,
  course: ZUuidSchema, // foreign key to Course
  creator: ZUuidSchema, // foreign key to User
  semester: z.string(), // 學期, e.g. '113-2'
  title: z.string(),
  tags: z.string().array(), // e.g. ['資料結構', '演算法', '田涼']
});

interface Article extends z.infer<typeof ZArticleSchema> {};

interface ArticleWithOptionalId extends Omit<Article, '_id'>, Partial<Pick<Article, '_id'>> {};

interface ArticleModel extends Model<ArticleWithOptionalId> {
  searchArticles: (this: ArticleModel, params: ArticleSearchQueryParam, offset: number, limit: number) => Promise<Article[]>;
  fuzzySearchArticles: (this: ArticleModel, keyword: string, offset: number, limit: number) => Promise<Article[]>;
}

const articleSchema = new Schema<ArticleWithOptionalId, ArticleModel>({
  _id: { type: String, default: () => randomUUID() },
  course: { type: String, ref: 'Course', required: true },
  creator: { type: String, ref: 'User', required: true },
  semester: { type: String, required: true },
  title: { type: String, required: true },
  tags: { type: [{ type: String, required: false }], required: false },
});

const staticSearchArticles: ArticleModel['searchArticles'] = async function (params, offset, limit) {
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

  const result = await this.find(query).skip(offset).limit(limit).exec();
  return result;
};

articleSchema.static('searchArticles', staticSearchArticles);

const staticFuzzySearchArticles: ArticleModel['fuzzySearchArticles'] = async function (keyword, offset, limit) {
  const fuseOptions = {
    keys: [
      'title',
      'content',
    ],
  };
  const fuse = new Fuse(await this.find().exec(), fuseOptions);
  const result = fuse.search(keyword);

  return result.map(r => r.item).slice(offset, offset + limit);
};

articleSchema.static('fuzzySearchArticles', staticFuzzySearchArticles);

const ArticleModel = model<ArticleWithOptionalId, ArticleModel>('Article', articleSchema);

export { type Article, ArticleModel, ZArticleSchema };
