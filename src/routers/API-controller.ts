import { type ErrorRequestHandler, Router } from 'express';
import articleController from './article-controller.ts';
import quizController from './quiz-controller.ts';
import userInfoController from './user-controller.ts';

const router = Router();

/* istanbul ignore next */
const uncatchErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.sendStatus(500);
};

router.use('/articles', articleController);
router.use('/quizzes', quizController);
router.use('/users', userInfoController);

router.use(uncatchErrorHandler);

export default router;
