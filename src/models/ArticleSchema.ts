import { Schema, SchemaTypes } from 'mongoose';
import { type User } from '@models/UserSchema';

interface Article {
  id: number;
  title: string;
  lecturer: string;
  tag?: string[];
  grade?: number;
  categories?: string[];
  content?: string;
  creator?: User;
  createdAt?: Date;
  updatedAt?: Date;
}

const articleSchema = new Schema<Article>({
  id: { type: Number, required: true },
  title: { type: String, required: true },
  lecturer: { type: String, required: true },
  tag: { type: [{ type: String, required: false }], required: false },
  grade: { type: Number, required: false },
  categories: { type: [{ type: String, required: false }], required: false },
  content: { type: String, required: false },
  creator: { type: SchemaTypes.ObjectId, ref: 'User', required: false },
  createdAt: { type: Date, required: false, immutable: true, default: () => Date.now() },
  updatedAt: { type: Date, required: false, default: () => Date.now() }
});

export { type Article, articleSchema };
