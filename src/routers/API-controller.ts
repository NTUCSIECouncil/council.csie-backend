import { type ErrorRequestHandler, Router } from 'express';
import articleController from './article-controller.ts';
import quizController from './quiz-controller.ts';
import userInfoController from './user-controller.ts';

const router = Router();

const uncatchErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  console.log(err);
  res.sendStatus(500);
};

router.use('/articles', articleController);
router.use('/quizzes', quizController);
router.use('/users', userInfoController);

router.use(uncatchErrorHandler);

export default router;
