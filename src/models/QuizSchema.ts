import { randomUUID } from 'crypto';
import { Schema, type FilterQuery, type Model } from 'mongoose';
import { type QuizSearchParam } from '@type/query-param';

interface Quiz {
  _id: string;
  title: string;
  course: string;
  semester: string;
  download_link: string;
}

interface QuizModel extends Model<Quiz> {
  searchQuizzes: (params: QuizSearchParam) => Promise<{ result: Quiz[] }>;
}

const quizSchema = new Schema<Quiz>({
  _id: { type: String, default: () => randomUUID() },
  title: { type: String, required: true },
  course: { type: String, required: true },
  semester: { type: String, required: true },
  download_link: { type: String, required: true }
});

quizSchema.statics.searchQuizzes = async function (params: QuizSearchParam) {
  const query: FilterQuery<Quiz> = {};

  if (params.course != null) {
    query.course = params.course;
  }
  if (params.keyword != null) {
    query.$or = [
      { title: { $regex: params.keyword, $options: 'i' } },
      { semester: { $regex: params.keyword, $options: 'i' } }
    ];
  }

  const result = await this.find(query);
  return result;
};

export { type Quiz, type QuizModel, quizSchema };
