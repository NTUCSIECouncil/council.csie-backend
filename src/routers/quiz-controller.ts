import { randomUUID, type UUID } from 'crypto';
import { Router } from 'express';
import { models } from '@models/index';
import { type Quiz } from '@models/quiz-schema';
import { type QuizSearchParam } from '@models/util-schema';
import { portionParser } from './middleware';

const router = Router();

const QuizModel = models.Quiz;

const verifyQuiz = (quizInfo: Partial<Quiz>, uuid: UUID, complete: boolean): boolean => {
  if (quizInfo._id !== undefined && quizInfo._id !== uuid) {
    return false;
  }

  if (complete && !(quizInfo._id !== undefined
    && quizInfo.title !== undefined
    && quizInfo.course !== undefined
    && quizInfo.download_link !== undefined
    && quizInfo.semester !== undefined)) {
    return false;
  }

  return true;
};

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
    const newInfo: Quiz = { _id: uuid, ...req.body };

    if (!verifyQuiz(newInfo, uuid, true)) {
      res.sendStatus(400);
      return;
    }

    const targetQuiz = new QuizModel(newInfo);
    await targetQuiz.save();
    res.status(201).json({ uuid });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/search', (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const [portionNum, portionSize] = [req.portionNum!, req.portionSize!];

    const searchParams = req.query;

    if (searchParams.course === undefined) {
      res.sendStatus(400);
    }
    const queryParams: QuizSearchParam = { course: searchParams.course as UUID };

    if (searchParams.keyword != null) {
      queryParams.keyword = searchParams.keyword as string;
    }

    const result = await QuizModel.searchQuizzes(queryParams, portionNum, portionSize);
    res.send({ result });
  })().catch((err: unknown) => {
    next(err);
  });
});

router.get('/:uuid', (req, res, next) => {
  (async () => {
    const uuid = req.params.uuid as UUID;

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
    const uuid = req.params.uuid as UUID;
    const newInfo: Partial<Quiz> = req.body;

    if (!verifyQuiz(newInfo, uuid, false)) {
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
