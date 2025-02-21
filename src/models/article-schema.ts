import { type UUID, randomUUID } from 'crypto';
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
  /**
 * Fuzzy search articles by course name or lecturer.
 * @param keyword The keyword to search.
 * @param offset The offset of the result.
 * @param limit The limit of the result.
 * @returns The articles that match the keyword.
 */
  fuzzySearch: (this: ArticleModel, keyword: string, offset: number, limit: number) => Promise<Article[]>;
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

  if (params.tags) {
    query.tags = { $all: params.tags };
  }
  if (params.categories) {
    query.categories = { $all: params.categories };
  }

  let articles = await this.find(query)
    .populate<{ course: { names: string[]; lecturer: string } }>('course', 'names lecturer')
    .exec();

  if (params.course) {
    const courseName = params.course;
    articles = articles.filter(article =>
      article.course.names.includes(courseName),
    );
  }

  if (params.lecturer) {
    const lecturer = params.lecturer;
    articles = articles.filter(article =>
      article.course.lecturer === lecturer,
    );
  }

  if (params.keyword) {
    const fuseOptions = {
      keys: [
        'title',
        'course.names',
        'course.lecturer',
      ],
      threshold: 0.3,
    };
    const fuse = new Fuse(articles, fuseOptions);

    const result = fuse.search(params.keyword);

    articles = result.map(result => result.item);
  }

  articles = articles.slice(offset, offset + limit);

  return articles.map(article => article.depopulate<{ course: UUID }>());
};

articleSchema.static('searchArticles', staticSearchArticles);

const ArticleModel = model<ArticleWithOptionalId, ArticleModel>('Article', articleSchema);

export { type Article, ArticleModel, ZArticleSchema };
