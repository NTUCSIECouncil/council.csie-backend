import { Schema } from 'mongoose';

interface Article {
  title: string;
  tag?: string[];
}

const articleSchema = new Schema<Article>({
  title: { type: String, required: true },
  tag: { type: String, required: false }
});

export { type Article, articleSchema };
