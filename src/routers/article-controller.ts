import { randomUUID, type UUID } from 'crypto';
import { Router } from 'express';
import { models } from '@models/index';
import { type Article, ZArticleSchema } from '@models/article-schema';
import { ZArticleSearchQueryParam, ZUuidSchema } from '@models/util-schema';
import { portionParser } from './middleware';

const router = Router();

const ArticleModel = models.Article;

// get all articles
router.get('/', portionParser(ArticleModel), (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [portionNum, portionSize] = [req.portionNum!, req.portionSize!];
    const articles = await ArticleModel.find().skip(portionNum * portionSize).limit(portionSize).exec();
    res.json({ result: articles });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.post('/', (req, res, next) => {
  (async () => {
    const uuid = randomUUID();

    const result = ZArticleSchema.safeParse({ _id: uuid, ...req.body });
    if (!result.success) {
      console.log(result.error);
      res.sendStatus(400);
      return;
    }

    const targetArticle = new ArticleModel(result.data);
    await targetArticle.save();
    res.status(201).json({ uuid });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/search', portionParser(ArticleModel), (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [portionNum, portionSize] = [req.portionNum!, req.portionSize!];

    const result = ZArticleSearchQueryParam.safeParse(req.query);
    if (!result.success) {
      console.log(result.error);
      res.sendStatus(400);
      return;
    }
    const searchResult = await ArticleModel.searchArticles(result.data, portionNum, portionSize);
    res.send({ result: searchResult });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/:uuid', (req, res, next) => {
  (async () => {
    const result = ZUuidSchema.safeParse(req.params.uuid);
    if (!result.success) {
      console.log(result.error);
      res.sendStatus(400);
      return;
    }

    const targetArticle = await ArticleModel.findById(result.data).exec();
    if (targetArticle === null) {
      res.sendStatus(404);
    } else {
      res.send({ result: targetArticle });
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

router.put('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    let newInfo: Partial<Article>;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
      newInfo = ZArticleSchema.partial().parse(req.body);
    } catch (err) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

    const targetArticle = await ArticleModel.findById(uuid).exec();
    if (targetArticle === null) {
      res.sendStatus(400);
    } else {
      targetArticle.set(newInfo);
      await targetArticle.save();
      res.sendStatus(204);
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

export default router;
