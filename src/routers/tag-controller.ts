import { Router } from 'express';
import { models } from '@models/index.ts';

const router = Router();

const ArticleModel = models.Article;

router.get('/', async (req, res) => {
  const tags = await ArticleModel.aggregate<{ _id: string }>([
    { $unwind: '$tags' },
    { $group: { _id: '$tags' } },
    { $sort: { _id: 1 } },
  ]).exec().then(tags => tags.map(tag => tag._id));

  res.json({ items: tags });
});

export default router;
