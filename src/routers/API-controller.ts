import { Router, type ErrorRequestHandler } from 'express';
import articleController from './article-controller';
import exampleController from './example-controller';
import userInfoController from './userInfo-controller';

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
router.use('/example', exampleController);
router.use('/users', userInfoController);

router.use(uncatchErrorHandler);

export default router;
