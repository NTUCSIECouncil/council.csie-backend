import { type RequestHandler } from 'express';
import { ZPaginationQueryParam } from '@models/util-schema.ts';
import { type ArticleModel } from '@models/article-schema.ts';
import { type QuizModel } from '@models/quiz-schema.ts';
import { type CourseModel } from '@models/course-schema.ts';

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
      let limit = 10, offset = 0;

      const queryParams = req.query;
      console.log(req.query);
      let paginationQueryParam;
      try {
        paginationQueryParam = ZPaginationQueryParam.parse(queryParams);
      } catch (err: unknown) {
        console.log(err);
        res.sendStatus(400);
        return;
      }
      if (paginationQueryParam.limit !== undefined) limit = paginationQueryParam.limit;
      if (paginationQueryParam.offset !== undefined) offset = paginationQueryParam.offset;

      if (offset >= await model.countDocuments().exec()) {
        res.sendStatus(400);
        return;
      }

      req.limit = limit;
      req.offset = offset;
      next();
    })().catch((err: unknown) => {
      console.log(err);
      res.sendStatus(500);
      return;
    });
  };
};

export { authChecker, paginationParser };
