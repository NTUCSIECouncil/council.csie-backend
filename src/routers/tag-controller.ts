import { Router } from 'express';
import { models } from '@models/index.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const ArticleModel = models.Article;

router.get('/', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
  const [offset, limit] = [req.offset!, req.limit!];
  const tagsAgg = await ArticleModel.aggregate<{ _id: string }>([
    { $unwind: '$tags' },
    { $group: { _id: '$tags' } },
    { $sort: { _id: 1 } },
  ]).exec();
  const total = tagsAgg.length;
  const tags = tagsAgg.slice(offset, offset + limit).map(tag => tag._id);
  res.json({ tags, meta: { total, offset, limit } });
});

export default router;
