import { randomUUID } from 'crypto';

import Fuse from 'fuse.js';
import {
  model,
  Schema,
  type FilterQuery,
  type HydratedDocument,
  type Model,
} from 'mongoose';
import { z } from 'zod';

import { type Course } from './course-schema.ts';
import { type User } from './user-schema.ts';
import { ZUuidSchema, type ArticleSearchQueryParam } from './util-schema.ts';

const ZRatingSchema = z.object({
  sweetness: z.int().min(1).max(5), // 甜度
  chill: z.int().min(1).max(5), // 涼度
  teaching: z.int().min(1).max(5), // 教學品質
  gain: z.int().min(1).max(5), // 獲益程度
  recommend: z.int().min(1).max(5), // 推薦程度
});

const ZArticleSchema = z.object({
  _id: ZUuidSchema,
  title: z.string().max(40),
  tags: z.string().max(50).array().max(50), // e.g. ['資料結構', '演算法', '田涼']
  ratings: ZRatingSchema,
  course: ZUuidSchema, // foreign key to Course
  creator: ZUuidSchema, // foreign key to User
});

interface Article extends z.infer<typeof ZArticleSchema> {}

interface PopulatedArticle extends Omit<Article, 'course' | 'creator'> {
  course: Course;
  creator: User;
}

interface ArticleModel extends Model<Article> {
  /**
   * Search articles.
   * @param params - Search parameters. No additional parsing is needed.
   * @returns The articles that match the query parameters.
   */
  searchArticles: (
    this: ArticleModel,
    params: ArticleSearchQueryParam,
  ) => Promise<HydratedDocument<PopulatedArticle>[]>;
}

const articleSchema = new Schema<Article, ArticleModel>(
  {
    _id: { type: String, default: randomUUID },
    title: { type: String, required: true, maxLength: 40 },
    tags: {
      type: [String],
      default: [],
      validate: [
        {
          validator: function (tags: string[]) {
            return tags.length <= 50;
          },
          message: 'Maximum 50 tags allowed',
        },
        {
          validator: function (tags: string[]) {
            return tags.every(tag => tag.length <= 50);
          },
          message: 'Each tag must be 50 characters or less',
        },
      ],
    },
    ratings: {
      sweetness: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
        validate: { validator: Number.isInteger },
      },
      chill: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
        validate: { validator: Number.isInteger },
      },
      teaching: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
        validate: { validator: Number.isInteger },
      },
      gain: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
        validate: { validator: Number.isInteger },
      },
      recommend: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
        validate: { validator: Number.isInteger },
      },
    },
    course: { type: String, ref: 'Course', required: true, immutable: true },
    creator: { type: String, ref: 'User', required: true, immutable: true },
  },
  { toObject: { versionKey: false } },
);

const staticSearchArticles: ArticleModel['searchArticles'] = async function (
  params,
) {
  const query: FilterQuery<Article> = {};

  if (params.tags) {
    query.tags = { $all: params.tags };
  }

  let articles = await this.find(query).populate<{
    course: Course;
    creator: User;
  }>(['course', 'creator']);

  if (params.keyword) {
    const fuseOptions = {
      keys: [
        'title',
        'course.names',
        'course.lecturer',
        'course.curriculum',
        'course.semester',
      ],
      threshold: 0.6,
    };
    const fuse = new Fuse(articles, fuseOptions);

    const result = fuse.search(params.keyword);

    articles = result.map(result => result.item);
  }

  return articles;
};

articleSchema.static('searchArticles', staticSearchArticles);

const ArticleModel = model<Article, ArticleModel>('Article', articleSchema);

export {
  ZRatingSchema,
  type Article,
  ZArticleSchema,
  ArticleModel,
  type PopulatedArticle,
};
