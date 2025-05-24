import { type UUID, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { type Request, Router } from 'express';
import { type HydratedDocument } from 'mongoose';
import { env } from '@/config.ts';
import { type Article, type PopulatedArticle, ZArticleSchema } from '@models/article-schema.ts';
import { models } from '@models/index.ts';
import { type ArticleEmbedQueryParam, type ArticleSearchQueryParam, ZArticleEmbedQueryParam, ZArticleSearchQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { fileUploader, paginationParser } from './middleware.ts';

const router = Router();

const ArticleModel = models.Article;

const getArticleContent = async (articleId: UUID, sliceLength = 50): Promise<string | null> => {
  const filePath = path.join(env.PWD, env.ARTICLE_FILE_DIR, `${articleId}.md`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data.slice(0, sliceLength);
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
  const articleId = randomUUID();
  let article: Article;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- safe inside parse
    article = ZArticleSchema.parse({ ...req.body.article, _id: articleId });
  } catch (err) {
    logger.warn('Failed to parse request body in POST /articles: ', err);
    res.sendStatus(400);
    return;
  }

  const articleDoc = new ArticleModel(article);
  await articleDoc.save();
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
  let articleId: UUID;
  let articleUpdates: Partial<Omit<Article, '_id'>>;
  try {
    articleId = ZUuidSchema.parse(req.params.articleId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- safe inside parse
    articleUpdates = ZArticleSchema.omit({ _id: true }).partial().parse(req.body.article);
  } catch (err) {
    logger.warn('Failed to parse articleId or request body in PATCH /articles/:articleId: ', err);
    res.sendStatus(400);
    return;
  }

  const articleDoc = await ArticleModel.findById(articleId).exec();
  if (articleDoc === null) {
    res.sendStatus(404);
  } else {
    articleDoc.set(articleUpdates);
    await articleDoc.save();
    res.sendStatus(204);
  }
});

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
  if (article === null) {
    res.sendStatus(404);
    return;
  }
  const fileName = `${articleId}.md`;
  const filePath = path.join(env.PWD, env.ARTICLE_FILE_DIR, fileName);
  try {
    await fs.access(filePath);
  } catch (err) {
    logger.error(`File not found for article ${articleId}: ${filePath}`, err);
    res.sendStatus(500);
    return;
  }
  res.sendFile(filePath);
});

// Use the file uploader middleware for articles (MD only)
const articleFileUploader = fileUploader({
  fileDir: env.ARTICLE_FILE_DIR,
  allowedMimeTypes: ['text/markdown'],
  getFilename: (req: Request) => {
    return `${req.params.uuid}.md`;
  },
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
    res.status(400).json({ error: 'No file uploaded or invalid file format' });
    return;
  }

  res.sendStatus(204); // Successfully updated
});

export default router;
