import { randomUUID, type UUID } from 'crypto';
import { Schema, type FilterQuery, type Model } from 'mongoose';
import { type QuizSearchParam } from '@type/query-param';

interface Quiz {
  _id?: UUID;
  title: string;
  course: UUID;
  semester: string;
  download_link: string;
}

interface QuizModel extends Model<Quiz> {
  searchQuizzes: (this: QuizModel, params: QuizSearchParam, portionNum: number, portionSize: number) => Promise<Quiz[]>;
}

const quizSchema = new Schema<Quiz, QuizModel>({
  _id: { type: String, default: () => randomUUID() },
  title: { type: String, required: true },
  course: { type: String, ref: 'Course', required: true },
  semester: { type: String, required: true },
  download_link: { type: String, required: true }
});

const staticSearchQuizzes: QuizModel['searchQuizzes'] = async function (params, portionNum, portionSize) {
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

  const result = await this.find(query).skip(portionNum * portionSize).limit(portionSize).exec();
  return result;
};

quizSchema.static('searchQuizzes', staticSearchQuizzes);

export { type Quiz, type QuizModel, quizSchema };
