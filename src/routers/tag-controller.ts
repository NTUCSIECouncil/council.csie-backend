import { Router } from 'express';
import { models } from '@models/index.ts';

const router = Router();

const ArticleModel = models.Article;

router.get('/', (req, res, next) => {
  (async () => {
    const tags = await ArticleModel.aggregate<{ _id: string }>([
      { $unwind: '$tags' },
      { $group: { _id: '$tags' } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ items: tags.map(tag => tag._id) });
  })().catch(next);
});

export default router;
