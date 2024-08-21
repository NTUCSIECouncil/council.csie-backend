import { randomUUID, type UUID } from 'crypto';
import { Router } from 'express';
import { models } from '@models/index.ts';
import { type Quiz, ZQuizSchema } from '@models/quiz-schema.ts';
import { ZUuidSchema, type QuizSearchParam, ZQuizSearchParam } from '@models/util-schema.ts';
import { paginationParser } from './middleware.ts';
import { ZodError } from 'zod';
import path from 'path';

const router = Router();

const QuizModel = models.Quiz;

// get all quizzes
router.get('/', paginationParser(QuizModel), (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [offset, limit] = [req.offset!, req.limit!];
    const data = await QuizModel.find().skip(offset).limit(limit).exec();
    res.json({ data });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.post('/', (req, res, next) => {
  (async () => {
    const uuid = randomUUID();
    let newInfo: Quiz;
    try {
      newInfo = ZQuizSchema.parse({ _id: uuid, ...req.body });
    } catch (err: unknown) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

    const targetQuiz = new QuizModel(newInfo);
    await targetQuiz.save();
    res.status(201).send({ uuid });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/search', paginationParser(QuizModel), (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [offset, limit] = [req.offset!, req.limit!];

    let searchParams: QuizSearchParam;
    try {
      searchParams = ZQuizSearchParam.parse(req.query);
    } catch (err: unknown) {
      if (err instanceof ZodError) console.log(err.format());
      res.sendStatus(400);
      return;
    }

    const data = await QuizModel.searchQuizzes(searchParams, offset, limit);
    res.send({ data });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/:uuid/file', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
    } catch (err: unknown) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

    const targetQuiz = await QuizModel.findById(uuid).exec();
    if (targetQuiz === null) {
      res.sendStatus(404);
    } else {
      // Some how getting filename
      const fileName = 'not implemented';
      if (process.env.QUIZ_FILE_DIR === undefined) throw new Error('QUIZ_FILE_DIR is not defined.');
      const options = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PWD must exist
        root: path.join(process.env.PWD!, process.env.QUIZ_FILE_DIR),
      };
      res.sendFile(fileName, options);
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
    } catch (err: unknown) {
      if (err instanceof ZodError) console.log(err.format());
      res.sendStatus(400);
      return;
    }

    const targetQuiz = await QuizModel.findById(uuid).exec();
    if (targetQuiz === null) {
      res.sendStatus(404);
    } else {
      res.send({ data: targetQuiz });
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

router.put('/:uuid', (req, res, next) => {
  (async () => {
    let uuid: UUID;
    let newInfo: Partial<Quiz>;
    try {
      uuid = ZUuidSchema.parse(req.params.uuid);
      newInfo = ZQuizSchema.partial().parse(req.body);
    } catch (err: unknown) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

    const targetQuiz = await QuizModel.findById(uuid).exec();
    if (targetQuiz === null) {
      res.sendStatus(400);
    } else {
      targetQuiz.set(newInfo);
      await targetQuiz.save();
      res.sendStatus(204);
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

export default router;
