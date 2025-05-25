import { randomUUID } from 'crypto';
import { type Model, Schema, model } from 'mongoose';
import { z } from 'zod/v4';
import { ZUuidSchema } from './util-schema.ts';

const ZQuizSchema = z.object({
  _id: ZUuidSchema,
  session: z.enum(['midterm', 'final', 'first', 'second']),
  course: ZUuidSchema, // foreign key to Course
  uploader: ZUuidSchema, // foreign key to User
});

interface Quiz extends z.infer<typeof ZQuizSchema> {};

interface QuizWithOptionalId extends Omit<Quiz, '_id'>, Partial<Pick<Quiz, '_id'>> {};

interface QuizModel extends Model<QuizWithOptionalId> {}

const quizSchema = new Schema<QuizWithOptionalId, QuizModel>({
  _id: { type: String, default: () => randomUUID() },
  session: { type: String, required: true },
  course: { type: String, ref: 'Course', required: true },
  uploader: { type: String, ref: 'User', required: true },
});

const QuizModel = model<QuizWithOptionalId, QuizModel>('Quiz', quizSchema);

export { type Quiz, QuizModel, ZQuizSchema };
