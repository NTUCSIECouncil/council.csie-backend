import { type UUID, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { type Request, Router } from 'express';
import { env } from '@/config.ts';
import { models } from '@models/index.ts';
import { type Quiz, ZQuizSchema } from '@models/quiz-schema.ts';
import { type QuizEmbedQueryParam, ZQuizEmbedQueryParam, ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { fileUploader, paginationParser } from './middleware.ts';

const router = Router();

const QuizModel = models.Quiz;

// get all quizzes
router.get('/', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const [offset, limit] = [req.offset!, req.limit!];
  let embedParam: QuizEmbedQueryParam;
  try {
    embedParam = ZQuizEmbedQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse query parameters in GET /quizzes: ', err);
    res.sendStatus(400);
    return;
  }

  let query = QuizModel.find().skip(offset).limit(limit);
  if (embedParam.embed?.includes('course')) {
    query = query.populate('course');
  }
  if (embedParam.embed?.includes('uploader')) {
    query = query.populate('uploader');
  }

  const quizzes = await query.lean({ versionKey: false }).exec();
  const total = await QuizModel.countDocuments().exec();
  res.json({ quizzes, meta: { total, offset, limit } });
});

router.post('/', async (req, res) => {
  const quizId = randomUUID();
  let quiz: Quiz;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- safe inside parse
    quiz = ZQuizSchema.parse({ ...req.body.quiz, _id: quizId });
  } catch (err) {
    logger.warn('Failed to parse request body in POST /quizzes: ', err);
    res.sendStatus(400);
    return;
  }

  const quizDoc = new QuizModel(quiz);
  await quizDoc.save();
  res.status(201).json({ quizId });
});

router.get('/:quizId', async (req, res) => {
  let quizId: UUID;
  let embedParam: QuizEmbedQueryParam;
  try {
    quizId = ZUuidSchema.parse(req.params.quizId);
    embedParam = ZQuizEmbedQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse quizId in GET /quizzes/:quizId: ', err);
    res.sendStatus(400);
    return;
  }

  let query = QuizModel.findById(quizId);
  if (embedParam.embed?.includes('course')) {
    query = query.populate('course');
  }
  if (embedParam.embed?.includes('uploader')) {
    query = query.populate('uploader');
  }

  const quiz = await query.lean({ versionKey: false }).exec();
  if (quiz === null) {
    res.sendStatus(404);
  } else {
    res.json({ quiz });
  }
});

// not actually required by API document
// istanbul ignore next
router.patch('/:quizId', async (req, res) => {
  let quizId: UUID;
  let quizUpdates: Partial<Quiz>;
  try {
    quizId = ZUuidSchema.parse(req.params.quizId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- safe inside parse
    quizUpdates = ZQuizSchema.partial().parse(req.body.quiz);
  } catch (err) {
    logger.warn('Failed to parse quizId or patch in PATCH /quizzes/:quizId: ', err);
    res.sendStatus(400);
    return;
  }

  const target = await QuizModel.findById(quizId).exec();
  if ((quizUpdates._id !== undefined && quizUpdates._id !== quizId) || target === null) {
    res.sendStatus(400);
  } else {
    target.set(quizUpdates);
    await target.save();
    res.sendStatus(204);
  }
});

router.get('/:quizId/file', async (req, res) => {
  let quizId: UUID;
  try {
    quizId = ZUuidSchema.parse(req.params.quizId);
  } catch (err) {
    logger.warn('Failed to parse quizId in GET /quizzes/:quizId/file: ', err);
    res.sendStatus(400);
    return;
  }

  const quiz = await QuizModel.findById(quizId).lean().exec();
  if (quiz === null) {
    res.sendStatus(404);
    return;
  }
  const fileName = `${quizId}.pdf`;
  const filePath = path.join(env.PWD, env.QUIZ_FILE_DIR, fileName);
  try {
    await fs.access(filePath);
  } catch (err) {
    logger.error(`File not found for quiz ${quizId}: ${filePath}`, err);
    res.sendStatus(500);
    return;
  }
  res.sendFile(filePath);
});

// Use the file uploader middleware for quizzes (PDF and MD)
const quizFileUploader = fileUploader({
  fileDir: env.QUIZ_FILE_DIR,
  allowedMimeTypes: ['application/pdf'],
  getFilename: (req: Request) => {
    return `${req.params.uuid}.pdf`;
  },
});

router.put('/:uuid/file', quizFileUploader.single('file'), async (req, res) => {
  let quizId: UUID;
  try {
    quizId = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in PUT /quizzes/:uuid/file: ', err);
    res.sendStatus(400);
    return;
  }

  const quiz = await QuizModel.findById(quizId).lean().exec();
  // If uuid is not found
  if (quiz === null) {
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
