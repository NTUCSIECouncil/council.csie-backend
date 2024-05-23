import { randomUUID, type UUID } from 'crypto';
import { Schema, type Model, type FilterQuery } from 'mongoose';
import { type ArticleSearchQueryParam } from '@type/query-param';

interface Article {
  _id?: UUID;
  title: string;
  lecturer: string;
  tag?: string[]; // any tags the creator wants to add
  grade?: number; // what grade is the creator when posted
  categories?: string[]; // more official tags, ex: elective, required, etc.
  content?: string;
  creator: UUID;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ArticleModel extends Model<Article> {
  searchArticles: (params: ArticleSearchQueryParam) => Promise<{ result: Article[] }>;
}

const articleSchema = new Schema<Article, ArticleModel>({
  _id: { type: String, default: () => randomUUID() },
  title: { type: String, required: true },
  lecturer: { type: String, required: true },
  tag: { type: [{ type: String, required: false }], required: false },
  grade: { type: Number, required: false },
  categories: { type: [{ type: String, required: false }], required: false },
  content: { type: String, required: false },
  creator: { type: String, ref: 'User', required: true },
  createdAt: { type: Date, required: false, immutable: true, default: () => Date.now() },
  updatedAt: { type: Date, required: false, default: () => Date.now() }
});

articleSchema.statics.searchArticles = async function (params: ArticleSearchQueryParam) {
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
      { content: { $regex: params.keyword, $options: 'i' } }
    ];
  }

  const result = await this.find(query).exec();
  return result;
};

export { type Article, type ArticleModel, articleSchema };
