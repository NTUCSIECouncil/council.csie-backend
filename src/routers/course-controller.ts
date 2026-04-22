import { type UUID } from 'crypto';

import { Router } from 'express';

import { models } from '@models/index.ts';
import {
  ZCourseSearchQueryParam,
  ZQuizEmbedQueryParam,
  ZUuidSchema,
  type CourseSearchQueryParam,
  type QuizEmbedQueryParam,
} from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser, requireCsie } from './middleware.ts';

const router = Router();

const CourseModel = models.Course;
const QuizModel = models.Quiz;

router.get('/', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
  const [offset, limit] = [req.offset!, req.limit!];
  let param: CourseSearchQueryParam;
  try {
    // The parse is not supposed to failed as we want an optional string field from a string dict.
    param = ZCourseSearchQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse query in GET /courses/search: ', err);
    res.status(400).json({ message: 'Invalid query parameters' });
    return;
  }

  const courseDocs = await CourseModel.searchCourses(param);
  const total = courseDocs.length;
  const courses = courseDocs
    .slice(offset, offset + limit)
    .map(course => course.toObject());

  res.json({ courses, meta: { total, offset, limit } });
});

router.get('/:courseId', async (req, res) => {
  let courseId: UUID;
  try {
    courseId = ZUuidSchema.parse(req.params.courseId);
  } catch (err) {
    logger.warn('Failed to parse courseId in GET /courses/:courseId: ', err);
    res.status(400).json({ message: 'Invalid course ID' });
    return;
  }

  const course = await CourseModel.findById(courseId)
    .lean({ versionKey: false })
    .exec();
  if (course === null) {
    res.status(404).json({ message: 'Course not found' });
  } else {
    res.json({ course });
  }
});

router.get(
  '/:courseId/quizzes',
  requireCsie,
  paginationParser,
  async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
    const [offset, limit] = [req.offset!, req.limit!];
    let courseId: UUID;
    let embedParam: QuizEmbedQueryParam;
    try {
      courseId = ZUuidSchema.parse(req.params.courseId);
      embedParam = ZQuizEmbedQueryParam.parse(req.query);
    } catch (err) {
      logger.warn(
        'Failed to parse courseId or query parameters in GET /courses/:courseId/quizzes: ',
        err,
      );
      res
        .status(400)
        .json({ message: 'Invalid course ID or query parameters' });
      return;
    }

    const course = await CourseModel.findById(courseId).lean().exec();
    if (course === null) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    const totalCount = await QuizModel.countDocuments({
      course: courseId,
    }).exec();

    let query = QuizModel.find({ course: courseId }).skip(offset).limit(limit);
    if (embedParam.embed?.includes('course')) {
      query = query.populate('course');
    }
    if (embedParam.embed?.includes('uploader')) {
      query = query.populate('uploader');
    }

    const quizzes = await query.lean({ versionKey: false }).exec();
    res.json({ quizzes, meta: { total: totalCount, offset, limit } });
  },
);

export default router;
