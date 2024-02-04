import { Schema, SchemaTypes } from 'mongoose';
import { type User } from '@models/UserSchema';

interface Article {
  title: string;
  lecturer: string;
  tag?: string[];
  grade?: number;
  categories?: string[];
  content?: string;
  creator: User;
  createdAt: Date;
  updatedAt: Date;
}

const articleSchema = new Schema<Article>({
  title: { type: String, required: true },
  lecturer: { type: String, required: true },
  tag: { type: [{ type: String, required: false }], required: false },
  grade: { type: Number, required: false },
  categories: { type: [{ type: String, required: false }], required: false },
  content: { type: String, required: false },
  creator: { type: SchemaTypes.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, required: true, immutable: true, default: () => Date.now() },
  updatedAt: { type: Date, required: true, default: () => Date.now() }
});

export { type Article, articleSchema };
