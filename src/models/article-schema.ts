import { randomUUID } from 'crypto';
import Fuse from 'fuse.js';
import { type FilterQuery, type HydratedDocument, type Model, Schema, model } from 'mongoose';
import { z } from 'zod/v4';
import { type Course } from './course-schema.ts';
import { type User } from './user-schema.ts';
import { type ArticleSearchQueryParam, ZUuidSchema } from './util-schema.ts';

const ZArticleSchema = z.object({
  _id: ZUuidSchema,
  title: z.string(),
  tags: z.string().array(), // e.g. ['資料結構', '演算法', '田涼']
  ratings: z.object({
    sweetness: z.number().int().min(1).max(5), // 甜度
    coolness: z.number().int().min(1).max(5), // 涼度
    usefulness: z.number().int().min(1).max(5), // 有用度
  }),
  course: ZUuidSchema, // foreign key to Course
  creator: ZUuidSchema, // foreign key to User
});

interface Article extends z.infer<typeof ZArticleSchema> {};

interface PopulatedArticle extends Omit<Omit<Article, 'course'>, 'creator'> {
  course: Course;
  creator: User;
}

interface ArticleModel extends Model<Article> {
  /**
   * Search articles.
   * @param params - Search parameters. No additional parsing is needed.
   * @returns The articles that match the query parameters.
   */
  searchArticles: (this: ArticleModel, params: ArticleSearchQueryParam) => Promise<HydratedDocument<PopulatedArticle>[]>;
}

const articleSchema = new Schema<Article, ArticleModel>({
  _id: { type: String, immutable: true },
  title: { type: String, required: true },
  tags: { type: [String], default: [] },
  ratings: {
    sweetness: { type: Number, min: 1, max: 5, required: true, validate: { validator: Number.isInteger } },
    coolness: { type: Number, min: 1, max: 5, required: true, validate: { validator: Number.isInteger } },
    usefulness: { type: Number, min: 1, max: 5, required: true, validate: { validator: Number.isInteger } },
  },
  course: { type: String, ref: 'Course', required: true, immutable: true },
  creator: { type: String, ref: 'User', required: true, immutable: true },
}, {
  toObject: { versionKey: false },
});

articleSchema.pre('validate', function (next) {
  if (this.isNew) this._id = randomUUID();
  next();
});

const staticSearchArticles: ArticleModel['searchArticles'] = async function (params) {
  const query: FilterQuery<Article> = {};

  if (params.tags) {
    query.tags = { $all: params.tags };
  }

  let articles = await this.find(query).populate<{ course: Course; creator: User }>(['course', 'creator']);

  if (params.keyword) {
    const fuseOptions = {
      keys: [
        'title',
        'course.names',
        'course.lecturer',
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

export { type Article, ArticleModel, ZArticleSchema, type PopulatedArticle };
