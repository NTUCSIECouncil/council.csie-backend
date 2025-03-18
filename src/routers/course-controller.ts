import { type UUID } from 'crypto';
import { Router } from 'express';
import { models } from '@models/index.ts';
import { type CourseSearchQueryParam, ZCourseSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const CourseModel = models.Course;
const QuizModel = models.Quiz;

router.get('/search', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const [offset, limit] = [req.offset!, req.limit!];
  let param: CourseSearchQueryParam;
  try {
    param = ZCourseSearchQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse query in GET /courses/search: ', err);
    res.sendStatus(400);
    return;
  }

  const courses = await CourseModel.searchCourses(param, offset, limit);
  res.send({ items: courses });
});

router.get('/:uuid', async (req, res) => {
  let courseId: UUID;
  try {
    courseId = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in GET /courses/:uuid: ', err);
    res.sendStatus(400);
    return;
  }

  const course = await CourseModel.findById(courseId).lean({ versionKey: false }).exec();
  if (course === null) {
    res.sendStatus(404);
  } else {
    res.send({ item: course });
  }
});

router.get('/:uuid/quizzes', async (req, res) => {
  let courseId: UUID;
  try {
    courseId = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in GET /courses/:uuid/quizzes: ', err);
    res.sendStatus(400);
    return;
  }

  const course = await CourseModel.findById(courseId).lean().exec();
  if (course === null) {
    res.sendStatus(404);
    return;
  }

  const quizzes = await QuizModel.find({ course: courseId }).lean({ versionKey: false }).exec();
  res.send({ items: quizzes });
});

export default router;
