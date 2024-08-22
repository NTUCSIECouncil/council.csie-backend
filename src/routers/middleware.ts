import { type RequestHandler } from 'express';
import { type ArticleModel } from '@models/article-schema.ts';
import { type CourseModel } from '@models/course-schema.ts';
import { type QuizModel } from '@models/quiz-schema.ts';
import { ZPaginationQueryParam } from '@models/util-schema.ts';

const authChecker: RequestHandler = (req, res, next) => {
  if (req.guser?.uid === undefined || req.guser.uid !== req.params.uuid) {
    res.sendStatus(403);
  } else {
    next();
  }
};

const paginationParser = (model: ArticleModel | QuizModel | CourseModel): RequestHandler => {
  return (req, res, next) => {
    (async () => {
      req.limit = 10;
      req.offset = 0;

      let param;
      try {
        param = ZPaginationQueryParam.parse(req.query);
      } catch (err: unknown) {
        console.log(err);
        res.sendStatus(400);
        return;
      }
      if (param.limit !== undefined) req.limit = param.limit;
      if (param.offset !== undefined) req.offset = param.offset;

      if (req.offset >= await model.countDocuments().exec()) {
        res.sendStatus(400);
        return;
      }

      next();
    })().catch((err: unknown) => {
      console.log(err);
      res.sendStatus(500);
      return;
    });
  };
};

export { authChecker, paginationParser };
