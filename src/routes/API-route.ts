import { Router, type ErrorRequestHandler } from 'express';

import logger from '@utils/logger.ts';
import articleRouter from './article-route.ts';
import courseRouter from './course-route.ts';
import quizRoute from './quiz-route.ts';
import tagRoute from './tag-route.ts';
import userRoute from './user-route.ts';

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
