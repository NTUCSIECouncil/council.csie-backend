import { UUID } from 'crypto';
import { type RequestHandler } from 'express';
import { ZPaginationQueryParam, ZUuidSchema } from '@models/util-schema.ts';

const authChecker: RequestHandler = (req, res, next) => {
  let uuid: UUID;
  try {
    uuid = ZUuidSchema.parse(req.params.uuid);
  } catch (err: unknown) {
    console.log(err);
    res.sendStatus(400);
    return;
  }

  if (req.guser?.uid === undefined || req.guser.uid !== uuid) {
    res.sendStatus(403);
  } else {
    next();
  }
};

const paginationParser: RequestHandler = (req, res, next) => {
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

  next();
};

export { authChecker, paginationParser };
