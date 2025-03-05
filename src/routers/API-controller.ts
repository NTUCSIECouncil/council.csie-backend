import { type ErrorRequestHandler, Router } from 'express';
import logger from '@utils/logger.ts';
import articleController from './article-controller.ts';
import categoryController from './category-controller.ts';
import courseController from './course-controller.ts';
import quizController from './quiz-controller.ts';
import tagController from './tag-controller.ts';
import userInfoController from './user-controller.ts';

const router = Router();

/* istanbul ignore next */
const uncaughtErrorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  logger.error('Uncaught error: ', err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.sendStatus(500);
};

router.use('/articles', articleController);
router.use('/categories', categoryController);
router.use('/courses', courseController);
router.use('/quizzes', quizController);
router.use('/tags', tagController);
router.use('/users', userInfoController);

router.use(uncaughtErrorHandler);

export default router;
