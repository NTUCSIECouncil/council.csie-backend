import { randomUUID } from 'crypto';
import Fuse from 'fuse.js';
import { type FilterQuery, type Model, Schema, model } from 'mongoose';
import { z } from 'zod';
import { type CourseSearchQueryParam, ZUuidSchema } from './util-schema.ts';

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

interface CourseModel extends Model<CourseWithOptionalId> {
  searchCourses: (this: CourseModel, params: CourseSearchQueryParam, offset: number, limit: number) => Promise<Course[]>;
};

const courseSchema = new Schema<CourseWithOptionalId, CourseModel>({
  _id: { type: String, default: () => randomUUID() },
  curriculum: { type: String, required: true },
  lecturer: { type: String, required: true },
  class: { type: String },
  names: { type: [String], required: true },
  credit: { type: Number, required: true },
  categories: { type: [String], default: [] },
});

const staticSearchCourses: CourseModel['searchCourses'] = async function (params, offset, limit) {
  const query: FilterQuery<Course> = {};

  if (params.categories) {
    query.categories = { $all: params.categories };
  }

  let courses = await this.find(query).exec();

  if (params.keyword) {
    const fuseOptions = {
      keys: [
        'lecturer',
        'names',
      ],
      threshold: 0.6,
    };

    const fuse = new Fuse(courses, fuseOptions);

    const result = fuse.search(params.keyword);
    courses = result.map(item => item.item);
  }

  return courses.slice(offset, offset + limit);
};

courseSchema.static('searchCourses', staticSearchCourses);

const CourseModel = model<CourseWithOptionalId, CourseModel>('Course', courseSchema);

export { type Course, CourseModel, ZCourseSchema };
