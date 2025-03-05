import { Router } from 'express';
import { models } from '@models/index.ts';

const router = Router();

const CourseModel = models.Course;

router.get('/', (req, res, next) => {
  (async () => {
    const categories = await CourseModel.aggregate<{ _id: string }>([
      { $unwind: '$categories' },
      { $group: { _id: '$categories' } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ items: categories.map(category => category._id) });
  })().catch(next);
});

export default router;
