import { type ErrorRequestHandler, Router } from 'express';
import logger from '@utils/logger.ts';
import articleController from './article-controller.ts';
import courseController from './course-controller.ts';
import quizController from './quiz-controller.ts';
import tagController from './tag-controller.ts';
import userInfoController from './user-controller.ts';

const router = Router();

const uncaughtErrorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  logger.error('Uncaught error: ', err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ message: 'Internal server error' });
};

router.use('/articles', articleController);
router.use('/courses', courseController);
router.use('/quizzes', quizController);
router.use('/tags', tagController);
router.use('/users', userInfoController);

router.use(uncaughtErrorHandler);

export default router;
