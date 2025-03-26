import { type UUID, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { type Article, ZArticleSchema } from '@models/article-schema.ts';
import { models } from '@models/index.ts';
import { type ArticleSearchQueryParam, ZArticleSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { fileUploader, paginationParser } from './middleware.ts';

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
  let param: ArticleSearchQueryParam;
  try {
    param = ZArticleSearchQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse query in GET /articles/search: ', err);
    res.sendStatus(400);
    return;
  }

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

// Add file retrieval endpoint
router.get('/:uuid/file', async (req, res) => {
  let articleId: UUID;
  try {
    articleId = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in GET /articles/:uuid/file: ', err);
    res.sendStatus(400);
    return;
  }

  const article = await ArticleModel.findById(articleId).lean().exec();
  // If uuid is not found
  if (article === null) {
    res.sendStatus(404);
  } else {
    const fileName = `${articleId}.md`;
    const options = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PWD must exist, ARTICLE_FILE_DIR was checked in index.ts
      root: path.join(process.env.PWD!, process.env.ARTICLE_FILE_DIR!),
    };

    // If the uuid exists but the file does not exist
    if (!fs.existsSync(path.join(options.root, fileName))) {
      res.sendStatus(500);
      return;
    }

    res.sendFile(fileName, options);
  }
});

// Use the file uploader middleware for articles (MD only)
const articleFileUploader = fileUploader({
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ARTICLE_FILE_DIR was checked in index.ts
  fileDir: process.env.ARTICLE_FILE_DIR!,
  allowedMimeTypes: ['text/markdown'],
  getFilename: req => `${req.params.uuid}.md`,
});

// Add file upload endpoint
router.put('/:uuid/file', articleFileUploader.single('file'), async (req, res) => {
  let articleId: UUID;
  try {
    articleId = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in PUT /articles/:uuid/file: ', err);
    res.sendStatus(400);
    return;
  }

  const article = await ArticleModel.findById(articleId).lean().exec();
  // If uuid is not found
  if (article === null) {
    res.sendStatus(404);
    return;
  }

  // Check if file was uploaded successfully
  if (!req.file) {
    res.status(400).send({ error: 'No Markdown file uploaded or invalid file format' });
    return;
  }

  res.sendStatus(204); // Successfully updated
});

export default router;
