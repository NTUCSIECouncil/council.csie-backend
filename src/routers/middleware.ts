import { type RequestHandler } from 'express';
import { type ArticleModel } from '@models/article-schema';
import { type QuizModel } from '@models/quiz-schema';
import { type CourseModel } from '@models/course-schema';

const authChecker: RequestHandler = (req, res, next) => {
  if (req.guser?.uid === undefined || req.guser.uid !== req.params.uid) {
    res.sendStatus(403);
  } else {
    next();
  }
};

const portionParser = (Model: ArticleModel | QuizModel | CourseModel): RequestHandler => {
  return (req, res, next) => {
    (async () => {
      const queryParams = req.query;

      let portionSize = 10;
      if (queryParams.portionSize != null) {
        portionSize = Number(queryParams.portionSize);
        if (![10, 20, 50, 100].includes(portionSize)) {
          res.sendStatus(400);
        }
      }

      const articleNum = await Model.countDocuments().exec();
      let portionNum = 0;
      if (queryParams.portionNum != null) {
        portionNum = Number(queryParams.portionNum);
        if (portionNum > Math.ceil(articleNum / portionSize) - 1) {
          res.sendStatus(400);
        }
      }

      req.portionSize = portionSize;
      req.portionNum = portionNum;
      next();
    })().catch((err: unknown) => {
      next(err);
    });
  };
};

export { authChecker, portionParser };
