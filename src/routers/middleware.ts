import { type RequestHandler } from 'express';
import z from 'zod';
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
      const queryParams = req.query;

      let limit = 10, offset = 0;
      try {
        if (queryParams.limit != null) limit = z.coerce.number().positive().parse(queryParams.limit);
        if (queryParams.offset != null) offset = z.coerce.number().nonnegative().parse(queryParams.offset);
      } catch (err: unknown) {
        console.log(err);
        res.sendStatus(400);
        return;
      }

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
