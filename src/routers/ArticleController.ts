import { Router } from 'express';
import { type Article } from '@models/ArticleSchema';
import { models } from '@models/index';

const router = Router();

// TODO: use such form for articles search?
router.get('/', (req, res) => {
  (async () => {
    const articles = await models.Article.find().exec();
    res.json({ result: articles })
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

export default router;
