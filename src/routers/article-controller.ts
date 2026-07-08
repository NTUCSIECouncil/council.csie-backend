import { type UUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { Router } from 'express';
import { type HydratedDocument } from 'mongoose';
import { z } from 'zod';

import { env } from '@/config.ts';
import {
  ArticleModel,
  ZArticleSchema,
  ZRatingSchema,
  type Article,
  type PopulatedArticle,
} from '@models/article-schema.ts';
import {
  ZArticleEmbedQueryParam,
  ZArticleSearchQueryParam,
  ZUuidSchema,
  type ArticleEmbedQueryParam,
  type ArticleSearchQueryParam,
} from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const getArticleContent = async (
  articleId: UUID,
  sliceLength = 50,
): Promise<string> => {
  const filePath = path.join(env.UPLOADS_DIR, 'articles', `${articleId}.md`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data.length <= sliceLength
      ? data
      : data.slice(0, sliceLength) + '...';
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      logger.info(
        `File not found for article ${articleId}: ${filePath}, returning empty string`,
      );
      return '';
    }
    logger.error(
      `Error reading file for article ${articleId}: ${filePath}`,
      err,
    );
    throw err;
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
    logger.warn('Failed to parse query parameters in GET /articles: ', err);
    res.status(400).json({ message: 'Invalid query parameters' });
    return;
  }

  let articleDocs: HydratedDocument<Article | PopulatedArticle>[] =
    await ArticleModel.searchArticles(searchParam);

  const total = articleDocs.length;
  articleDocs = articleDocs.slice(offset, offset + limit);

  if (!embedParam.embed?.includes('course')) {
    articleDocs = articleDocs.map(article => article.depopulate('course'));
  }
  if (!embedParam.embed?.includes('creator')) {
    articleDocs = articleDocs.map(article => article.depopulate('creator'));
  }

  const articles = await Promise.all(
    articleDocs.map(async articleDoc => {
      const article = articleDoc.toObject<Article>();

      if (!embedParam.embed?.includes('content')) return article;

      const content = await getArticleContent(articleDoc._id);
      return { ...article, content };
    }),
  );

  res.json({ articles, meta: { total, offset, limit } });
});

router.post('/', async (req, res) => {
  if (!req.userId) {
    logger.warn('Unauthorized access to POST /articles');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  let articleCreate: Omit<
    Article,
    '_id' | 'creator' | 'createdAt' | 'updatedAt'
  >;
  try {
    articleCreate = ZArticleSchema.omit({
      _id: true,
      creator: true,
      createdAt: true,
      updatedAt: true,
    }).parse(req.body);
  } catch (err) {
    logger.warn('Failed to parse request body in POST /articles: ', err);
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  const courseExists = await ArticleModel.exists({
    course: articleCreate.course,
  });
  if (!courseExists) {
    logger.warn(
      `Course not found for article creation: ${articleCreate.course}`,
    );
    res.status(400).json({ message: 'Invalid course ID' });
    return;
  }

  const articleDoc = new ArticleModel({
    ...articleCreate,
    creator: req.userId,
  });
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
    logger.warn(
      'Failed to parse path parameter or query parameters in GET /articles/:articleId: ',
      err,
    );
    res.status(400).json({ message: 'Invalid request parameters' });
    return;
  }

  let query = ArticleModel.findById(articleId);
  if (embedParam.embed?.includes('course')) {
    query = query.populate('course');
  }
  if (embedParam.embed?.includes('creator')) {
    query = query.populate('creator', '_id nickname');
  }
  const article = await query.lean({ versionKey: false }).exec();
  if (article === null) {
    res.status(404).json({ message: 'Article not found' });
    return;
  }

  if (!embedParam.embed?.includes('content')) {
    res.json({ article });
  } else {
    try {
      const content = await getArticleContent(articleId);
      res.json({ article: { ...article, content } });
    } catch (err) {
      logger.error(`Failed to read article content for ${articleId}`, err);
      res.status(500).json({ message: 'Failed to read article content' });
      return;
    }
  }
});

router.patch('/:articleId', async (req, res) => {
  if (!req.userId) {
    logger.warn('Unauthorized access to PATCH /articles/:articleId');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  let articleId: UUID;
  let articleUpdates;
  try {
    articleId = ZUuidSchema.parse(req.params.articleId);
    articleUpdates = ZArticleSchema.omit({
      _id: true,
      course: true,
      creator: true,
      createdAt: true,
      updatedAt: true,
    })
      .extend({ ratings: ZRatingSchema.partial() })
      .partial()
      .parse(req.body);
  } catch (err) {
    logger.warn(
      'Failed to parse articleId or request body in PATCH /articles/:articleId: ',
      err,
    );
    res.status(400).json({ message: 'Invalid request' });
    return;
  }

  const articleDoc = await ArticleModel.findById(articleId).exec();
  if (articleDoc === null) {
    res.status(404).json({ message: 'Article not found' });
  } else if (articleDoc.creator !== req.userId) {
    logger.warn(
      `Unauthorized access to PATCH /articles/${articleId} by user ${req.userId}`,
    );
    res.status(403).json({ message: 'Forbidden' });
  } else {
    articleDoc.set(articleUpdates, null, { merge: true });
    await articleDoc.save();
    res.sendStatus(204);
  }
});

router.get('/:articleId/file', async (req, res) => {
  let articleId: UUID;
  try {
    articleId = ZUuidSchema.parse(req.params.articleId);
  } catch (err) {
    logger.warn(
      'Failed to parse articleId in GET /articles/:articleId/file: ',
      err,
    );
    res.status(400).json({ message: 'Invalid request' });
    return;
  }

  const article = await ArticleModel.findById(articleId).lean().exec();
  if (article === null) {
    res.status(404).json({ message: 'Article not found' });
    return;
  }
  const fileName = `${articleId}.md`;
  const filePath = path.join(env.UPLOADS_DIR, 'articles', fileName);
  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      logger.info(
        `File not found for article ${articleId}: ${filePath}, returning empty string`,
      );
      content = '';
    } else {
      logger.error(
        `Error reading file for article ${articleId}: ${filePath}`,
        err,
      );
      res.status(500).json({ message: 'Failed to read article file' });
      return;
    }
  }
  res.json({ file: content });
});

router.put('/:articleId/file', async (req, res) => {
  if (!req.userId) {
    logger.warn('Unauthorized access to PUT /articles/:articleId/file');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  let articleId: UUID;
  try {
    articleId = ZUuidSchema.parse(req.params.articleId);
  } catch (err) {
    logger.warn(
      'Failed to parse articleId in PUT /articles/:articleId/file: ',
      err,
    );
    res.status(400).json({ message: 'Invalid request' });
    return;
  }

  let content;
  try {
    content = z.object({ file: z.string().max(1000000) }).parse(req.body);
  } catch (err) {
    logger.warn(
      'Failed to parse request body in PUT /articles/:articleId/file: ',
      err,
    );
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  const article = await ArticleModel.findById(articleId).exec();
  if (article === null) {
    res.status(404).json({ message: 'Article not found' });
    return;
  }
  if (article.creator !== req.userId) {
    logger.warn(
      `Unauthorized access to PUT /articles/${articleId}/file by user ${req.userId}`,
    );
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  const fileName = `${articleId}.md`;
  const filePath = path.join(env.UPLOADS_DIR, 'articles', fileName);
  try {
    await fs.writeFile(filePath, content.file, 'utf-8');
  } catch (err) {
    logger.error(
      `Failed to write file for article ${articleId}: ${filePath}`,
      err,
    );
    res.status(500).json({ message: 'Failed to write article file' });
    return;
  }
  await article.updateOne({ updatedAt: true });
  res.sendStatus(204);
});

export default router;
