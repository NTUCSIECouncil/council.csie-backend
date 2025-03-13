import { type UUID, randomUUID } from 'crypto';
import { Router } from 'express';
import { type Article, ZArticleSchema } from '@models/article-schema.ts';
import { models } from '@models/index.ts';
import { type ArticleSearchQueryParam, ZArticleSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const ArticleModel = models.Article;
const QuizModel = models.Quiz;

router.get('/', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
  const [offset, limit] = [req.offset!, req.limit!];
  const items = await ArticleModel.find().skip(offset).limit(limit).exec();
  res.json({ items });
});

router.post('/', async (req, res) => {
  const uuid = randomUUID();
  let article: Article;
  try {
    article = ZArticleSchema.parse({ ...req.body, _id: uuid });
  } catch (err) {
    logger.warn('Failed to parse article in POST /articles: ', err);
    res.sendStatus(400);
    return;
  }

  const articleDoc = new ArticleModel(article);
  await articleDoc.save();
  res.status(201).json({ uuid });
});

router.get('/search', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const [offset, limit] = [req.offset!, req.limit!];
  const param: ArticleSearchQueryParam = ZArticleSearchQueryParam.parse(req.query);

  const items = await ArticleModel.searchArticles(param, offset, limit);
  res.send({ items });
});

router.get('/:uuid', async (req, res) => {
  let uuid: UUID;
  try {
    uuid = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in GET /articles/:uuid: ', err);
    res.sendStatus(400);
    return;
  }

  const target = await ArticleModel.findById(uuid).exec();
  if (target === null) {
    res.sendStatus(404);
  } else {
    res.send({ item: target });
  }
});

router.patch('/:uuid', async (req, res) => {
  const patch: Partial<Article> = ZArticleSchema.partial().parse(req.body);
  let uuid: UUID;
  try {
    uuid = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in PATCH /articles/:uuid: ', err);
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
});

router.get('/:uuid/quizzes', async (req, res) => {
  let uuid: UUID;
  try {
    uuid = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in GET /articles/:uuid/quizzes: ', err);
    res.sendStatus(400);
    return;
  }

  const article = await ArticleModel.findById(uuid).exec();
  if (article === null) {
    res.sendStatus(404);
    return;
  }

  const quizzes = await QuizModel.find({ course: uuid }).exec();
  res.send({ items: quizzes });
});

export default router;
