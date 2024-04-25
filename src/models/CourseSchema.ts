import { Schema, type Types } from 'mongoose';

interface Course {
  _id: Types.UUID | string;
  title: string;
  semester: string;
  credit: number;
  lecturer: string;
  time: string;
  classroom: string;
  past_quiz?: string; // link to course's past quiz page
  ratings?: string; // link to course's rating page
}

const courseSchema = new Schema<Course>({
  _id: { type: Schema.Types.UUID, required: true },
  title: { type: String, required: true },
  semester: { type: String, required: true },
  credit: { type: Number, required: true },
  lecturer: { type: String, required: true },
  time: { type: String, required: true },
  classroom: { type: String, required: true },
  past_quiz: { type: String, required: false },
  ratings: { type: String, required: false }
});

export { type Course, courseSchema };
