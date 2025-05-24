import { type UUID } from 'crypto';
import { Router } from 'express';
import { models } from '@models/index.ts';
import { type CourseSearchQueryParam, ZCourseSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const CourseModel = models.Course;
const QuizModel = models.Quiz;

router.get('/', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
  const [offset, limit] = [req.offset!, req.limit!];
  let param: CourseSearchQueryParam;
  try {
    param = ZCourseSearchQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse query in GET /courses/search: ', err);
    res.sendStatus(400);
    return;
  }

  const courseDocs = await CourseModel.searchCourses(param);
  const total = courseDocs.length;
  const courses = courseDocs.slice(offset, offset + limit).map(course => course.toObject());

  res.json({ courses, meta: { total, offset, limit } });
});

router.get('/:courseId', async (req, res) => {
  let courseId: UUID;
  try {
    courseId = ZUuidSchema.parse(req.params.courseId);
  } catch (err) {
    logger.warn('Failed to parse courseId in GET /courses/:courseId: ', err);
    res.sendStatus(400);
    return;
  }

  const course = await CourseModel.findById(courseId).lean({ versionKey: false }).exec();
  if (course === null) {
    res.sendStatus(404);
  } else {
    res.json({ course });
  }
});

router.get('/:courseId/quizzes', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
  const [offset, limit] = [req.offset!, req.limit!];
  let courseId: UUID;
  try {
    courseId = ZUuidSchema.parse(req.params.courseId);
  } catch (err) {
    logger.warn('Failed to parse courseId in GET /courses/:courseId/quizzes: ', err);
    res.sendStatus(400);
    return;
  }

  const course = await CourseModel.findById(courseId).lean().exec();
  if (course === null) {
    res.sendStatus(404);
    return;
  }

  const totalCount = await QuizModel.countDocuments({ course: courseId }).exec();

  const quizzes = await QuizModel.find({ course: courseId }).skip(offset).limit(limit)
    .lean({ versionKey: false }).exec();
  res.json({ quizzes, meta: { total: totalCount, offset, limit } });
});

export default router;
