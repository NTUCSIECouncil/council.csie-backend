import { type UUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { Router } from 'express';

import { env } from '@/config.ts';
import { models } from '@models/index.ts';
import {
  ZQuizEmbedQueryParam,
  ZUuidSchema,
  type QuizEmbedQueryParam,
} from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

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
  const filePath = path.join(env.UPLOADS_DIR, 'quizzes', fileName);
  try {
    await fs.access(filePath);
  } catch (err) {
    logger.error(`File not found for quiz ${quizId}: ${filePath}`, err);
    res.status(500).json({ message: 'Failed to read quiz file' });
    return;
  }
  res.sendFile(filePath);
});

export default router;
