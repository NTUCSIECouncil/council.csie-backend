import { type UUID, randomUUID } from 'crypto';
import { Router } from 'express';
import { ZodError } from 'zod';
import { type Article, ZArticleSchema } from '@models/article-schema.ts';
import { models } from '@models/index.ts';
import { type ArticleSearchQueryParam, ZArticleSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const ArticleModel = models.Article;

// get all articles
router.get('/', paginationParser, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
    const [offset, limit] = [req.offset!, req.limit!];
    const items = await ArticleModel.find().skip(offset).limit(limit).exec();
    res.json({ items });
  })().catch(next);
});

router.post('/', (req, res, next) => {
  (async () => {
    const uuid = randomUUID();
    let article: Article;
    try {
      article = ZArticleSchema.parse({ ...req.body, _id: uuid });
    } catch (err) {
      if (err instanceof ZodError) console.error('Validation failed:', err.errors);
      res.sendStatus(400);
      return;
    }

    const articleDoc = new ArticleModel(article);
    await articleDoc.save();
    res.status(201).json({ uuid });
  })().catch(next);
});

router.get('/search', paginationParser, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [offset, limit] = [req.offset!, req.limit!];
    const param: ArticleSearchQueryParam = ZArticleSearchQueryParam.parse(req.query);

    const items = await ArticleModel.searchArticles(param, offset, limit);
    res.send({ items });
  })().catch(next);
});

router.get('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
    } catch (err) {
      if (err instanceof ZodError) console.error('Validation failed:', err.errors);
      res.sendStatus(400);
      return;
    }

    const target = await ArticleModel.findById(uuid).exec();
    if (target === null) {
      res.sendStatus(404);
    } else {
      res.send({ item: target });
    }
  })().catch(next);
});

router.patch('/:uuid', (req, res, next) => {
  (async () => {
    const patch: Partial<Article> = ZArticleSchema.partial().parse(req.body);
    let uuid: UUID;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
    } catch (err) {
      if (err instanceof ZodError) console.error('Validation failed:', err.errors);
      res.sendStatus(400);
      return;
    }

    const target = await ArticleModel.findById(uuid).exec();
    if ((patch._id !== undefined && patch._id !== uuid) || target === null) {
      res.sendStatus(400);
    } else {
      target.set(patch);
      await target.save();
      res.sendStatus(204);
    }
  })().catch(next);
});

export default router;
