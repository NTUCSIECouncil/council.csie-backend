import { Schema } from 'mongoose';

interface Quiz {
  title: string;
  course: string;
  semester: string;
  download_link: string;
}

const quizSchema = new Schema<Quiz>({
  title: { type: String, required: true },
  course: { type: String, required: true },
  semester: { type: String, required: true },
  download_link: { type: String, required: true }
});

export { type Quiz, quizSchema };
