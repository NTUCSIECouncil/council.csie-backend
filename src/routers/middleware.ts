import { type RequestHandler } from 'express';
import { ZPaginationQueryParam } from '@models/util-schema.ts';

const authChecker: RequestHandler = (req, res, next) => {
  const uuid = req.params.uuid;

  if (req.guser?.uid === undefined || req.guser.uid !== uuid) {
    res.sendStatus(403);
    return;
  }
  next();
};

const paginationParser: RequestHandler = (req, res, next) => {
  req.limit = 10;
  req.offset = 0;

  const param = ZPaginationQueryParam.parse(req.query);
  if (param.limit !== undefined) req.limit = param.limit;
  if (param.offset !== undefined) req.offset = param.offset;

  next();
};

export { authChecker, paginationParser };
