import { Router } from 'express';
import { type Article } from '@models/ArticleSchema';
import { models } from '@models/index';

const router = Router();

// TODO: use such form for articles search?
router.get('/', (req, res) => {
  (async () => {
    const articles = await models.Article.find(req.params).exec();
    res.json({ result: articles });
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

// TODO: search articles by keyword
//       (unchecked)
router.get('/:keyword', (req, res) => {
  (async () => {
    const articles: Article[] = await models.Article.find({
      $or: [
        { title: { $regex: req.params.keyword, $options: 'i' } },
        { lecturer: { $regex: req.params.keyword, $options: 'i' } },
        { tag: { $regex: req.params.keyword, $options: 'i' } },
        { content: { $regex: req.params.keyword, $options: 'i' } }
      ]
    }).exec();
    res.json({ result: articles });
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

export default router;
