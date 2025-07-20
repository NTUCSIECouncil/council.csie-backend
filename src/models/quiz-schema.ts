import { randomUUID } from 'crypto';
import { type Model, Schema, model } from 'mongoose';
import { z } from 'zod';
import { ZUuidSchema } from './util-schema.ts';

const ZQuizSchema = z.object({
  _id: ZUuidSchema,
  session: z.enum(['midterm', 'final', 'first', 'second', 'other']),
  course: ZUuidSchema, // foreign key to Course
  uploader: ZUuidSchema, // foreign key to User
});

interface Quiz extends z.infer<typeof ZQuizSchema> {};

interface QuizModel extends Model<Quiz> {}

const quizSchema = new Schema<Quiz, QuizModel>({
  _id: { type: String, default: randomUUID },
  session: { type: String, required: true, immutable: true, enum: ['midterm', 'final', 'first', 'second', 'other'] },
  course: { type: String, ref: 'Course', required: true, immutable: true },
  uploader: { type: String, ref: 'User', required: true, immutable: true },
});

const QuizModel = model<Quiz, QuizModel>('Quiz', quizSchema);

export { type Quiz, QuizModel, ZQuizSchema };
