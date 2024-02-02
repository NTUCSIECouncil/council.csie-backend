import { Schema } from 'mongoose';

interface Article {
  title: string;
  lecturer: string;
  tag?: string[];
  content?: string;
}

const articleSchema = new Schema<Article>({
  title: { type: String, required: true },
  lecturer: { type: String, required: true },
  tag: { type: [{ type: String, required: false }], required: false },
  content: { type: String, required: false }
});

export { type Article, articleSchema };
