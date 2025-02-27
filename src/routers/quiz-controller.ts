import { type UUID, randomUUID } from 'crypto';
import path from 'path';
import { Router } from 'express';
import { ZodError } from 'zod';
import { models } from '@models/index.ts';
import { type Quiz, ZQuizSchema } from '@models/quiz-schema.ts';
import { type QuizSearchParam, ZQuizSearchParam, ZUuidSchema } from '@models/util-schema.ts';
import { paginationParser } from './middleware.ts';
import fs from 'fs';

const router = Router();

const QuizModel = models.Quiz;

// get all quizzes
router.get('/', paginationParser, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [offset, limit] = [req.offset!, req.limit!];
    const items = await QuizModel.find().skip(offset).limit(limit).exec();
    res.json({ items });
  })().catch(next);
});

router.post('/', (req, res, next) => {
  (async () => {
    const uuid = randomUUID();
    let quiz: Quiz;
    try {
      quiz = ZQuizSchema.parse({ ...req.body, _id: uuid });
    } catch (err) {
      if (err instanceof ZodError) console.error(err.format());
      res.sendStatus(400);
      return;
    }

    const quizDoc = new QuizModel(quiz);
    await quizDoc.save();
    res.status(201).send({ uuid });
  })().catch(next);
});

router.get('/search', paginationParser, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [offset, limit] = [req.offset!, req.limit!];

    let params: QuizSearchParam;
    try {
      params = ZQuizSearchParam.parse(req.query);
    } catch (err) {
      if (err instanceof ZodError) console.error(err.format());
      res.sendStatus(400);
      return;
    }

    const items = await QuizModel.searchQuizzes(params, offset, limit);
    res.send({ items });
  })().catch(next);
});

router.get('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
    } catch (err) {
      if (err instanceof ZodError) console.error(err.format());
      res.sendStatus(400);
      return;
    }

    const target = await QuizModel.findById(uuid).exec();
    if (target === null) {
      res.sendStatus(404);
    } else {
      res.send({ item: target });
    }
  })().catch(next);
});

// not actually required by API document
// istanbul ignore next
router.patch('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    let patch: Partial<Quiz>;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
      patch = ZQuizSchema.partial().parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) console.error(err.format());
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
  })().catch(next);
});

router.get('/:uuid/file', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
    } catch (err) {
      if (err instanceof ZodError) console.error(err.format());
      res.sendStatus(400);
      return;
    }

    const target = await QuizModel.findById(uuid).exec();
    // if uuid is not found
    if (target === null) {
      res.sendStatus(404);
    } else {
      // Some how getting filename
      const fileName = `${uuid}.pdf`;
      if (process.env.QUIZ_FILE_DIR === undefined) throw new Error('QUIZ_FILE_DIR is not defined.');
      const options = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PWD must exist
        root: path.join(process.env.PWD!, process.env.QUIZ_FILE_DIR),
      };

      // if the uuid exists but the file does not exist
      if (!fs.existsSync(path.join(options.root, fileName))) res.sendStatus(404);
      else res.sendFile(fileName, options);
    }
  })().catch(next);
});

export default router;
