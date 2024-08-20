import { randomUUID } from 'crypto';
import { model, type Model, Schema } from 'mongoose';
import { z } from 'zod';
import { ZUuidSchema } from './util-schema.ts';

const ZCourseSchema = z.object({
  _id: ZUuidSchema,
  title: z.string(),
  semester: z.string().optional(),
  credit: z.number().nonnegative(),
  lecturer: z.string(),
  pastQuiz: z.string().optional(), // link to course's past quiz page
  ratings: z.string().optional(), // link to course's rating page
});

interface Course extends z.infer<typeof ZCourseSchema> {};

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

export { type Course, CourseModel, ZCourseSchema };
