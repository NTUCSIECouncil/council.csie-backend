import { type UUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Router } from 'express';
import { type HydratedDocument } from 'mongoose';
import { z } from 'zod/v4';
import { env } from '@/config.ts';
import { type Article, ArticleModel, type PopulatedArticle, ZArticleSchema } from '@models/article-schema.ts';
import { type ArticleEmbedQueryParam, type ArticleSearchQueryParam, ZArticleEmbedQueryParam, ZArticleSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const getArticleContent = async (articleId: UUID, sliceLength = 50): Promise<string | null> => {
  const filePath = path.join(env.PWD, env.ARTICLE_FILE_DIR, `${articleId}.md`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data.length <= sliceLength ? data : data.slice(0, sliceLength) + '...';
  } catch (err) {
    logger.error(`File not found for article ${articleId}: ${filePath}`, err);
    return null;
  }
};

router.get('/', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
  const [offset, limit] = [req.offset!, req.limit!];
  let searchParam: ArticleSearchQueryParam;
  let embedParam: ArticleEmbedQueryParam;
  try {
    searchParam = ZArticleSearchQueryParam.parse(req.query);
    embedParam = ZArticleEmbedQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse query parameters in GET /articles/search: ', err);
    res.sendStatus(400);
    return;
  }

  let articleDocs: HydratedDocument<Article | PopulatedArticle>[] = await ArticleModel.searchArticles(searchParam);

  const total = articleDocs.length;
  articleDocs = articleDocs.slice(offset, offset + limit);

  if (!embedParam.embed?.includes('course')) {
    articleDocs = articleDocs.map(article => article.depopulate('course'));
  }
  if (!embedParam.embed?.includes('creator')) {
    articleDocs = articleDocs.map(article => article.depopulate('creator'));
  }

  const articles = await Promise.all(articleDocs.map(async (articleDoc) => {
    const article = articleDoc.toObject<Article>();

    if (!embedParam.embed?.includes('content')) return article;

    const content = await getArticleContent(articleDoc._id);
    return { ...article, content };
  }));

  res.json({ articles, meta: { total, offset, limit } });
});

router.post('/', async (req, res) => {
  if (!req.userId) {
    logger.warn('Unauthorized access to POST /articles');
    res.sendStatus(401);
    return;
  }

  let articleCreate: Omit<Article, '_id' | 'creator'>;
  try {
    articleCreate = ZArticleSchema.omit({ _id: true, creator: true }).parse(req.body);
  } catch (err) {
    logger.warn('Failed to parse request body in POST /articles: ', err);
    res.sendStatus(400);
    return;
  }

  const articleDoc = new ArticleModel({ ...articleCreate, creator: req.userId });
  await articleDoc.save();
  const articleId = articleDoc._id;
  res.status(201).json({ articleId });
});

router.get('/:articleId', async (req, res) => {
  let articleId: UUID;
  let embedParam: ArticleEmbedQueryParam;
  try {
    articleId = ZUuidSchema.parse(req.params.articleId);
    embedParam = ZArticleEmbedQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse path parameter or query parameters in GET /articles/:articleId: ', err);
    res.sendStatus(400);
    return;
  }

  let query = ArticleModel.findById(articleId);
  if (embedParam.embed?.includes('course')) {
    query = query.populate('course');
  }
  if (embedParam.embed?.includes('creator')) {
    query = query.populate('creator');
  }
  const article = await query.lean({ versionKey: false }).exec();
  if (article === null) {
    res.sendStatus(404);
    return;
  }

  if (!embedParam.embed?.includes('content')) {
    res.json({ article });
  } else {
    const content = await getArticleContent(articleId);
    if (content === null) {
      res.sendStatus(500);
      return;
    }
    res.json({ article: { ...article, content } });
  }
});

router.patch('/:articleId', async (req, res) => {
  if (!req.userId) {
    logger.warn('Unauthorized access to PATCH /articles/:articleId');
    res.sendStatus(401);
    return;
  }

  let articleId: UUID;
  let articleUpdates;
  try {
    articleId = ZUuidSchema.parse(req.params.articleId);
    articleUpdates = ZArticleSchema.omit({ _id: true, course: true, creator: true }).partial().parse(req.body);
  } catch (err) {
    logger.warn('Failed to parse articleId or request body in PATCH /articles/:articleId: ', err);
    res.sendStatus(400);
    return;
  }

  const articleDoc = await ArticleModel.findById(articleId).exec();
  if (articleDoc === null) {
    res.sendStatus(404);
  } else if (articleDoc.creator !== req.userId) {
    logger.warn(`Unauthorized access to PATCH /articles/${articleId} by user ${req.userId}`);
    res.sendStatus(403);
  } else {
    articleDoc.set(articleUpdates);
    await articleDoc.save();
    res.sendStatus(204);
  }
});

router.get('/:articleId/file', async (req, res) => {
  let articleId: UUID;
  try {
    articleId = ZUuidSchema.parse(req.params.articleId);
  } catch (err) {
    logger.warn('Failed to parse articleId in GET /articles/:articleId/file: ', err);
    res.sendStatus(400);
    return;
  }

  const article = await ArticleModel.findById(articleId).lean().exec();
  if (article === null) {
    res.sendStatus(404);
    return;
  }
  const fileName = `${articleId}.md`;
  const filePath = path.join(env.PWD, env.ARTICLE_FILE_DIR, fileName);
  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    logger.error(`File not found for article ${articleId}: ${filePath}`, err);
    res.sendStatus(500);
    return;
  }
  res.json({ file: content });
});

router.put('/:articleId/file', async (req, res) => {
  if (!req.userId) {
    logger.warn('Unauthorized access to PUT /articles/:articleId/file');
    res.sendStatus(401);
    return;
  }

  let articleId: UUID;
  try {
    articleId = ZUuidSchema.parse(req.params.articleId);
  } catch (err) {
    logger.warn('Failed to parse articleId in PUT /articles/:articleId/file: ', err);
    res.sendStatus(400);
    return;
  }

  let content;
  try {
    content = z.object({ file: z.string() }).parse(req.body);
  } catch (err) {
    logger.warn('Failed to parse request body in PUT /articles/:articleId/file: ', err);
    res.sendStatus(400);
    return;
  }

  const article = await ArticleModel.findById(articleId).lean().exec();
  if (article === null) {
    res.sendStatus(404);
    return;
  }
  if (article.creator !== req.userId) {
    logger.warn(`Unauthorized access to PUT /articles/${articleId}/file by user ${req.userId}`);
    res.sendStatus(403);
    return;
  }
  const fileName = `${articleId}.md`;
  const filePath = path.join(env.PWD, env.ARTICLE_FILE_DIR, fileName);
  try {
    await fs.writeFile(filePath, content.file, 'utf-8');
  } catch (err) {
    logger.error(`Failed to write file for article ${articleId}: ${filePath}`, err);
    res.sendStatus(500);
    return;
  }
  res.sendStatus(204);
});

export default router;
