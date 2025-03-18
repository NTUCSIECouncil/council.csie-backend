import { type UUID, randomUUID } from 'crypto';
import { Router } from 'express';
import { type Article, ZArticleSchema } from '@models/article-schema.ts';
import { models } from '@models/index.ts';
import { type ArticleSearchQueryParam, ZArticleSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const ArticleModel = models.Article;

router.get('/', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
  const [offset, limit] = [req.offset!, req.limit!];
  const items = await ArticleModel.find().skip(offset).limit(limit).lean({ versionKey: false }).exec();
  res.json({ items });
});

router.post('/', async (req, res) => {
  const articleId = randomUUID();
  let article: Article;
  try {
    article = ZArticleSchema.parse({ ...req.body, _id: articleId });
  } catch (err) {
    logger.warn('Failed to parse article in POST /articles: ', err);
    res.sendStatus(400);
    return;
  }

  const articleDoc = new ArticleModel(article);
  await articleDoc.save();
  res.status(201).json({ uuid: articleId });
});

router.get('/search', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const [offset, limit] = [req.offset!, req.limit!];
  const param: ArticleSearchQueryParam = ZArticleSearchQueryParam.parse(req.query);

  const articles = await ArticleModel.searchArticles(param, offset, limit);
  res.send({ items: articles });
});

router.get('/:uuid', async (req, res) => {
  let articleId: UUID;
  try {
    articleId = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in GET /articles/:uuid: ', err);
    res.sendStatus(400);
    return;
  }

  const article = await ArticleModel.findById(articleId).lean({ versionKey: false }).exec();
  if (article === null) {
    res.sendStatus(404);
  } else {
    res.send({ item: article });
  }
});

router.patch('/:uuid', async (req, res) => {
  const articleUpdates: Partial<Article> = ZArticleSchema.partial().parse(req.body);
  let articleId: UUID;
  try {
    articleId = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in PATCH /articles/:uuid: ', err);
    res.sendStatus(400);
    return;
  }

  const articleDoc = await ArticleModel.findById(articleId).exec();
  if ((articleUpdates._id !== undefined && articleUpdates._id !== articleId) || articleDoc === null) {
    res.sendStatus(400);
  } else {
    articleDoc.set(articleUpdates);
    await articleDoc.save();
    res.sendStatus(204);
  }
});

export default router;
