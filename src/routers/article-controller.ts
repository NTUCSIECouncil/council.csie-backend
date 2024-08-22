import { type UUID, randomUUID } from 'crypto';
import { Router } from 'express';
import { type Article, ZArticleSchema } from '@models/article-schema.ts';
import { models } from '@models/index.ts';
import { ArticleSearchQueryParam, ZArticleSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const ArticleModel = models.Article;

// get all articles
router.get('/', paginationParser, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [offset, limit] = [req.offset!, req.limit!];
    const items = await ArticleModel.find().skip(offset).limit(limit).exec();
    res.json({ items });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.post('/', (req, res, next) => {
  (async () => {
    const uuid = randomUUID();
    let article: Article;
    try {
      article = ZArticleSchema.parse({ ...req.body, _id: uuid });
    } catch (err: unknown) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

    const targetArticle = new ArticleModel(article);
    await targetArticle.save();
    res.status(201).json({ uuid });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/search', paginationParser, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [offset, limit] = [req.offset!, req.limit!];
    let queryParam: ArticleSearchQueryParam;
    try {
      queryParam = ZArticleSearchQueryParam.parse(req.query);
    } catch (err: unknown) {
      console.log(err);
      res.sendStatus(400);
      return;
    }
    const items = await ArticleModel.searchArticles(queryParam, offset, limit);
    res.send({ items });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
    } catch (err: unknown) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

    const target = await ArticleModel.findById(uuid).exec();
    if (target === null) {
      res.sendStatus(404);
    } else {
      res.send({ item: target });
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

router.patch('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    let patch: Partial<Article>;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
      patch = ZArticleSchema.partial().parse(req.body);
    } catch (err) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

    const targetArticle = await ArticleModel.findById(uuid).exec();
    if ((patch._id !== undefined && patch._id !== uuid) || targetArticle === null) {
      res.sendStatus(400);
    } else {
      targetArticle.set(patch);
      await targetArticle.save();
      res.sendStatus(204);
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

export default router;
