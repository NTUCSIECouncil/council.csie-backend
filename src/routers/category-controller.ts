import { Router } from 'express';
import { models } from '@models/index.ts';

const router = Router();

const CourseModel = models.Course;

router.get('/', async (req, res) => {
  const categories = await CourseModel.aggregate<{ _id: string }>([
    { $unwind: '$categories' },
    { $group: { _id: '$categories' } },
    { $sort: { _id: 1 } },
  ]).exec();

  res.json({ items: categories.map(category => category._id) });
});

export default router;
