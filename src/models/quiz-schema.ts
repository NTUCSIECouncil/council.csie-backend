import { randomUUID } from 'crypto';
import { Schema, type FilterQuery, type Model } from 'mongoose';
import { z } from 'zod';
import { type QuizSearchParam, ZUuidSchema } from './util-schema';

const ZQuizSchema = z.object({
  _id: ZUuidSchema,
  title: z.string(),
  course: ZUuidSchema,
  semester: z.string(),
  downloadLink: z.string(),
});

interface Quiz extends z.infer<typeof ZQuizSchema> {};

interface QuizWithOptionalId extends Omit<Quiz, '_id'>, Partial<Pick<Quiz, '_id'>> {};

interface QuizModel extends Model<QuizWithOptionalId> {
  searchQuizzes: (this: QuizModel, params: QuizSearchParam, portionNum: number, portionSize: number) => Promise<Quiz[]>;
}

const quizSchema = new Schema<QuizWithOptionalId, QuizModel>({
  _id: { type: String, default: () => randomUUID() },
  title: { type: String, required: true },
  course: { type: String, ref: 'Course', required: true },
  semester: { type: String, required: true },
  downloadLink: { type: String, required: true },
});

const staticSearchQuizzes: QuizModel['searchQuizzes'] = async function (params, portionNum, portionSize) {
  const query: FilterQuery<Quiz> = {};

  query.course = params.course;
  if (params.keyword != null) {
    query.$or = [
      { title: { $regex: params.keyword, $options: 'i' } },
      { semester: { $regex: params.keyword, $options: 'i' } },
    ];
  }

  const result = await this.find(query).skip(portionNum * portionSize).limit(portionSize).exec();
  return result;
};

quizSchema.static('searchQuizzes', staticSearchQuizzes);

export { type Quiz, type QuizModel, type QuizWithOptionalId, quizSchema, ZQuizSchema };
