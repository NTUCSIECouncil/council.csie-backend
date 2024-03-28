import { model, Schema, SchemaTypes, Model } from 'mongoose';
import { type User } from '@models/UserSchema';
import { ArticleSearchQueryParam } from '@type/query-param';

interface Article {
  title: string;
  lecturer: string;
  tag?: string[];  // any tags the creator wants to add
  grade?: number;   // what grade is the creator when posted
  categories?: string[]; // more official tags, ex: elective, required, etc.
  content?: string;
  creator: User;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ArticleModel extends Model<Article> {
    findArticles(params: ArticleSearchQueryParam): Promise<{ result: Article[] }>;
}

const articleSchema = new Schema<Article, ArticleModel>({
  title: { type: String, required: true },
  lecturer: { type: String, required: true },
  tag: { type: [{ type: String, required: false }], required: false },
  grade: { type: Number, required: false },
  categories: { type: [{ type: String, required: false }], required: false },
  content: { type: String, required: false },
  creator: { type: SchemaTypes.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, required: false, immutable: true, default: () => Date.now() },
  updatedAt: { type: Date, required: false, default: () => Date.now() }
});

articleSchema.statics.findArticles = async function(params: ArticleSearchQueryParam) {
  let query: any = {};

  if (params.tag && params.tag.length) {
    query.tag = { $all: params.tag };
  }

  if (params.categories && params.categories.length) {
    query.categories = { $in: params.categories };
  }

  if (params.lecturer) {
    query.lecturer = params.lecturer;
  }

  if (params.grade) {
    query.grade = params.grade;
  }

  if (params.keyword) {
    query.$or = [
      { title: { $regex: params.keyword, $options: 'i' } },
      { content: { $regex: params.keyword, $options: 'i' } }
    ];
  }

  const result = await this.find(query);
  return { result };
};

export { type Article, ArticleModel, articleSchema };
