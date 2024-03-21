import { Schema, SchemaTypes } from 'mongoose';

interface Course {
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
