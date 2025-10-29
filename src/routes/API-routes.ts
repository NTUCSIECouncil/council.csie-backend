import { Router, type ErrorRequestHandler } from 'express';

import logger from '@utils/logger.ts';
import articleRouter from './article-routes.ts';
import courseRouter from './course-routes.ts';
import quizRoute from './quiz-routes.ts';
import tagRoute from './tag-routes.ts';
import userRoute from './user-routes.ts';

const router = Router();

const uncaughtErrorHandler: ErrorRequestHandler = (
  err: unknown,
  req,
  res,
  next,
) => {
  logger.error('Uncaught error: ', err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ message: 'Internal server error' });
};

router.use('/articles', articleRouter);
router.use('/courses', courseRouter);
router.use('/quizzes', quizRoute);
router.use('/tags', tagRoute);
router.use('/users', userRoute);

router.use(uncaughtErrorHandler);

export default router;
