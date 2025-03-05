import { randomUUID } from 'crypto';
import { type Model, Schema, model } from 'mongoose';
import { z } from 'zod';
import { ZUuidSchema } from './util-schema.ts';

const ZCourseSchema = z.object({
  _id: ZUuidSchema,
  curriculum: z.string(), // 課號, e.g. 'CSIE1212'
  lecturer: z.string(),
  class: z.string().optional(), // 班次, e.g. '01'
  names: z.string().array(), // 課程名稱, e.g. ['資料結構與演算法', 'Data Structures and Algorithms', 'DSA']
  credit: z.number().nonnegative(), // 學分數, e.g. 3
  categories: z.string().array(), // 課程類別, e.g. ['compulsory', 'programming']
});

interface Course extends z.infer<typeof ZCourseSchema> {};

interface CourseWithOptionalId extends Omit<Course, '_id'>, Partial<Pick<Course, '_id'>> {};

interface CourseModel extends Model<CourseWithOptionalId> {};

const courseSchema = new Schema<CourseWithOptionalId>({
  _id: { type: String, default: () => randomUUID() },
  curriculum: { type: String, required: true },
  lecturer: { type: String, required: true },
  class: { type: String },
  names: { type: [String], required: true },
  credit: { type: Number, required: true },
  categories: { type: [String], required: true },
});

const CourseModel = model<CourseWithOptionalId>('Course', courseSchema);

export { type Course, CourseModel, ZCourseSchema };
