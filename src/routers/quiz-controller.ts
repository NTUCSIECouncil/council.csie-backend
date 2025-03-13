import { type UUID, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { models } from '@models/index.ts';
import { type Quiz, ZQuizSchema } from '@models/quiz-schema.ts';
import { ZUuidSchema } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';
import { paginationParser } from './middleware.ts';

const router = Router();

const QuizModel = models.Quiz;

// get all quizzes
router.get('/', paginationParser, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const [offset, limit] = [req.offset!, req.limit!];
  const items = await QuizModel.find().skip(offset).limit(limit).exec();
  res.json({ items });
});

router.post('/', async (req, res) => {
  const uuid = randomUUID();
  let quiz: Quiz;
  try {
    quiz = ZQuizSchema.parse({ ...req.body, _id: uuid });
  } catch (err) {
    logger.warn('Failed to parse quiz in POST /quizzes: ', err);
    res.sendStatus(400);
    return;
  }

  const quizDoc = new QuizModel(quiz);
  await quizDoc.save();
  res.status(201).send({ uuid });
});

router.get('/:uuid', async (req, res) => {
  let uuid: UUID;
  try {
    uuid = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in GET /quizzes/:uuid: ', err);
    res.sendStatus(400);
    return;
  }

  const target = await QuizModel.findById(uuid).exec();
  if (target === null) {
    res.sendStatus(404);
  } else {
    res.send({ item: target });
  }
});

// not actually required by API document
// istanbul ignore next
router.patch('/:uuid', async (req, res) => {
  let uuid: UUID;
  let patch: Partial<Quiz>;
  try {
    uuid = ZUuidSchema.parse(req.params.uuid);
    patch = ZQuizSchema.partial().parse(req.body);
  } catch (err) {
    logger.warn('Failed to parse UUID or patch in PATCH /quizzes/:uuid: ', err);
    res.sendStatus(400);
    return;
  }

  const target = await QuizModel.findById(uuid).exec();
  if ((patch._id !== undefined && patch._id !== uuid) || target === null) {
    res.sendStatus(400);
  } else {
    target.set(patch);
    await target.save();
    res.sendStatus(204);
  }
});

router.get('/:uuid/file', async (req, res) => {
  let uuid: UUID;
  try {
    uuid = ZUuidSchema.parse(req.params.uuid);
  } catch (err) {
    logger.warn('Failed to parse UUID in GET /quizzes/:uuid/file: ', err);
    res.sendStatus(400);
    return;
  }

  const target = await QuizModel.findById(uuid).exec();
  // If uuid is not found
  if (target === null) {
    res.sendStatus(404);
  } else {
    // Some how getting filename
    const fileName = `${uuid}.pdf`;
    const options = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PWD must exist, QUIZ_FILE_DIR was checked in index.ts
      root: path.join(process.env.PWD!, process.env.QUIZ_FILE_DIR!),
    };

    // If the uuid exists but the file does not exist
    if (!fs.existsSync(path.join(options.root, fileName))) {
      res.sendStatus(500);
      return;
    }

    res.sendFile(fileName, options);
  }
});

export default router;
