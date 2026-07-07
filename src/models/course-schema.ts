import { randomUUID } from 'crypto';

import Fuse from 'fuse.js';
import { model, Schema, type HydratedDocument, type Model } from 'mongoose';
import { z } from 'zod';

import { ZUuidSchema, type CourseSearchQueryParam } from './util-schema.ts';

const ZCourseSchema = z.object({
  _id: ZUuidSchema,
  curriculum: z.string(), // 課號, e.g. 'CSIE1212'
  lecturer: z.string(), // 授課教師, e.g. 'HT Lin'
  class: z.string().optional(), // 班次, e.g. '01'
  names: z.string().array(), // 課程名稱, e.g. ['資料結構與演算法', 'Data Structures and Algorithms', 'DSA']
  credit: z.number().nonnegative(), // 學分數, e.g. 3
  semester: z.string(), // 學期, e.g. '113-2'
});

interface Course extends z.infer<typeof ZCourseSchema> {}

interface CourseModel extends Model<Course> {
  searchCourses: (
    this: CourseModel,
    params: CourseSearchQueryParam,
  ) => Promise<HydratedDocument<Course>[]>;
}

const courseSchema = new Schema<Course, CourseModel>(
  {
    _id: { type: String, default: () => randomUUID() },
    curriculum: { type: String, required: true },
    lecturer: { type: String, required: true },
    class: { type: String },
    names: { type: [String], required: true },
    credit: { type: Number, required: true },
    semester: { type: String, required: true },
  },
  { toObject: { versionKey: false } },
);

const staticSearchCourses: CourseModel['searchCourses'] = async function (
  params,
) {
  let courses = await this.find().exec();

  if (params.keyword) {
    const fuseOptions = {
      keys: ['lecturer', 'names', 'semester'],
      threshold: 0.6,
    };

    const fuse = new Fuse(courses, fuseOptions);

    const result = fuse.search(params.keyword);
    courses = result.map(item => item.item);
  }

  return courses;
};

courseSchema.static('searchCourses', staticSearchCourses);

const CourseModel = model<Course, CourseModel>('Course', courseSchema);

export { type Course, CourseModel, ZCourseSchema };
