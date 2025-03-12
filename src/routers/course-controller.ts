import { type UUID } from 'crypto';
import { Router } from 'express';
import { models } from '@models/index.ts';
import { type CourseSearchQueryParam, ZCourseSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const CourseModel = models.Course;

router.get('/search', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const [offset, limit] = [req.offset!, req.limit!];
  const param: CourseSearchQueryParam = ZCourseSearchQueryParam.parse(req.query);

  const items = await CourseModel.searchCourses(param, offset, limit);
  res.send({ items });
});

router.get('/:uuid', async (req, res) => {
  let uuid: UUID;
  try {
    uuid = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.error('Failed to parse UUID in GET /courses/:uuid: ', err);
    res.sendStatus(400);
    return;
  }

  const target = await CourseModel.findById(uuid).exec();
  if (target === null) {
    res.sendStatus(404);
  } else {
    res.send({ item: target });
  }
});

export default router;
