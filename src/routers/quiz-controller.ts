import { randomUUID, type UUID } from 'crypto';
import { Router } from 'express';
import { models } from '@models/index';
import { type Quiz, ZQuizSchema } from '@models/quiz-schema';
import { ZUuidSchema, type QuizSearchParam, ZQuizSearchParam } from '@models/util-schema';
import { portionParser } from './middleware';
import { ZodError } from 'zod';

const router = Router();

const QuizModel = models.Quiz;

// get all quizzes
router.get('/', portionParser(QuizModel), (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [portionNum, portionSize] = [req.portionNum!, req.portionSize!];
    const quizzes = await QuizModel.find().skip(portionNum * portionSize).limit(portionSize).exec();
    res.json({ result: quizzes });
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

router.get('/search', (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [portionNum, portionSize] = [req.portionNum!, req.portionSize!];

    let searchParams: QuizSearchParam;
    try {
      searchParams = ZQuizSearchParam.parse(req.query);
    } catch (err: unknown) {
      if (err instanceof ZodError) console.log(err.format());
      res.sendStatus(400);
      return;
    }

    const result = await QuizModel.searchQuizzes(searchParams, portionNum, portionSize);
    res.send({ result });
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
      res.status(200).json({ result: targetQuiz });
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
