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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- paginationParser() checked
  const [offset, limit] = [req.offset!, req.limit!];
  let embedParam: QuizEmbedQueryParam;
  try {
    embedParam = ZQuizEmbedQueryParam.parse(req.query);
  } catch (err) {
    logger.warn('Failed to parse query parameters in GET /quizzes: ', err);
    res.status(400).json({ message: 'Invalid query parameters' });
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
    res.status(400).json({ message: 'Invalid request body' });
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
    res.status(400).json({ message: 'Invalid quiz ID or query parameters' });
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
    res.status(404).json({ message: 'Quiz not found' });
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
    res.status(400).json({ message: 'Invalid quiz ID or request body' });
    return;
  }

  const target = await QuizModel.findById(quizId).exec();
  if ((quizUpdates._id !== undefined && quizUpdates._id !== quizId) || target === null) {
    res.status(400).json({ message: 'Invalid request or quiz not found' });
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
    res.status(400).json({ message: 'Invalid quiz ID' });
    return;
  }

  const quiz = await QuizModel.findById(quizId).lean().exec();
  if (quiz === null) {
    res.status(404).json({ message: 'Quiz not found' });
    return;
  }
  const fileName = `${quizId}.pdf`;
  const filePath = path.join(env.PWD, env.QUIZ_FILE_DIR, fileName);
  try {
    await fs.access(filePath);
  } catch (err) {
    logger.error(`File not found for quiz ${quizId}: ${filePath}`, err);
    res.status(500).json({ message: 'Failed to read quiz file' });
    return;
  }
  res.sendFile(filePath);
});

const quizFileUploader = fileUploader(
  env.QUIZ_FILE_DIR,
  ['application/pdf'],
  (req: Request) => {
    return `${req.params.quizId}.pdf`;
  },
);

router.put('/:quizId/file', quizFileUploader, async (req, res) => {
  let quizId: UUID;
  try {
    quizId = ZUuidSchema.parse(req.params.quizId);
  } catch (err) {
    logger.warn('Failed to parse quizId in PUT /quizzes/:quizId/file: ', err);
    res.status(400).json({ message: 'Invalid quiz ID' });
    return;
  }

  const quiz = await QuizModel.findById(quizId).lean().exec();
  if (quiz === null) {
    res.status(404).json({ message: 'Quiz not found' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded or invalid file format' });
    return;
  }

  res.sendStatus(204);
});

export default router;
