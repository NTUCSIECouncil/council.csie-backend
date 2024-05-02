import { type RequestHandler } from 'express';

const authChecker: RequestHandler = (req, res, next) => {
  if (req.guser?.uid === undefined || req.guser?.uid !== req.params.uid) {
    res.sendStatus(403);
  } else {
    next();
  }
};

export { authChecker };
