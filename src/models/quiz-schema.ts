import { randomUUID } from 'crypto';
import { type FilterQuery, type Model, Schema, model } from 'mongoose';
import { z } from 'zod';
import { type QuizSearchParam, ZUuidSchema } from './util-schema.ts';

const ZQuizSchema = z.object({
  _id: ZUuidSchema,
  course: ZUuidSchema,
  uploader: ZUuidSchema,
  semester: z.string(), // 學期, e.g. '113-2'
  session: z.enum(['midterm', 'final', 'first', 'second']),
});

interface Quiz extends z.infer<typeof ZQuizSchema> {};

interface QuizWithOptionalId extends Omit<Quiz, '_id'>, Partial<Pick<Quiz, '_id'>> {};

interface QuizModel extends Model<QuizWithOptionalId> {
  searchQuizzes: (this: QuizModel, params: QuizSearchParam, offset: number, limit: number) => Promise<Quiz[]>;
}

const quizSchema = new Schema<QuizWithOptionalId, QuizModel>({
  _id: { type: String, default: () => randomUUID() },
  course: { type: String, ref: 'Course', required: true },
  uploader: { type: String, ref: 'User', required: true },
  semester: { type: String, required: true },
  session: { type: String, required: true },
});

const staticSearchQuizzes: QuizModel['searchQuizzes'] = async function (params, offset, limit) {
  const query: FilterQuery<Quiz> = {};

  query.course = params.course;
  if (params.keyword != null) {
    query.$or = [
      { title: { $regex: params.keyword, $options: 'i' } },
      { semester: { $regex: params.keyword, $options: 'i' } },
    ];
  }

  const result = await this.find(query).skip(offset).limit(limit).exec();
  return result;
};

quizSchema.static('searchQuizzes', staticSearchQuizzes);

const QuizModel = model<QuizWithOptionalId, QuizModel>('Quiz', quizSchema);

export { type Quiz, QuizModel, ZQuizSchema };
