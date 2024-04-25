import { Schema, type Types } from 'mongoose';

interface Quiz {
  _id: Types.UUID | string;
  title: string;
  course: string;
  semester: string;
  download_link: string;
}

const quizSchema = new Schema<Quiz>({
  _id: { type: Schema.Types.UUID, required: true },
  title: { type: String, required: true },
  course: { type: String, required: true },
  semester: { type: String, required: true },
  download_link: { type: String, required: true }
});

export { type Quiz, quizSchema };
