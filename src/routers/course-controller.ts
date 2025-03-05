import { type UUID } from 'crypto';
import { Router } from 'express';
import { models } from '@models/index.ts';
import { ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';

const router = Router();

const CourseModel = models.Course;

// get course
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
