import { randomUUID, type UUID } from 'crypto';
import { model, type Model, Schema } from 'mongoose';

interface Course {
  _id: UUID;
  title: string;
  semester?: string;
  credit: number;
  lecturer: string;
  pastQuiz?: string; // link to course's past quiz page
  ratings?: string; // link to course's rating page
}

interface CourseWithOptionalId extends Omit<Course, '_id'>, Partial<Pick<Course, '_id'>> {};

interface CourseModel extends Model<CourseWithOptionalId> {};

const courseSchema = new Schema<CourseWithOptionalId>({
  _id: { type: String, default: () => randomUUID() },
  title: { type: String, required: true },
  semester: { type: String, required: false },
  credit: { type: Number, required: true },
  lecturer: { type: String, required: true },
  pastQuiz: { type: String, required: false },
  ratings: { type: String, required: false },
});

const CourseModel = model<CourseWithOptionalId>('Course', courseSchema);

export { type Course, CourseModel };
