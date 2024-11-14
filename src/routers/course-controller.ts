import { type UUID } from 'crypto';
import { Router } from 'express';
import { ZodError } from 'zod';
import { models } from '@models/index.ts';
import { ZUuidSchema } from '@models/util-schema.ts';

const router = Router();

const CourseModel = models.Course;

// get course
router.get('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
    } catch (err) {
      if (err instanceof ZodError) console.error(err.format());
      res.sendStatus(400);
      return;
    }

    const target = await CourseModel.findById(uuid).exec();
    if (target === null) {
      res.sendStatus(404);
    } else {
      res.send({ item: target });
    }
  })().catch(next);
});

export default router;
