import { type RequestHandler } from 'express';
import { z } from 'zod';

import logger from '@/utils/logger.ts';
import { ZPaginationQueryParam } from '@models/util-schema.ts';

const requireCsie: RequestHandler = (req, res, next) => {
  const email = req.decodedToken?.email ?? '';
  const emailVerified = req.decodedToken?.email_verified ?? false;
  if (!emailVerified || !email.endsWith('@csie.ntu.edu.tw')) {
    logger.warn(
      `Access denied for non-csie user: ${email || 'unauthenticated'}`,
    );
    res
      .status(403)
      .json({ message: 'Access restricted to csie.ntu.edu.tw accounts' });
    return;
  }
  next();
};

const paginationParser: RequestHandler = (req, res, next) => {
  req.limit = 10;
  req.offset = 0;

  const result = ZPaginationQueryParam.safeParse(req.query);
  if (!result.success) {
    logger.warn(
      `Failed to parse pagination query parameters in ${req.method} ${req.baseUrl}:\n${z.prettifyError(result.error)}`,
    );
    res.status(400).json({ message: 'Invalid query parameters' });
    return;
  }

  if (result.data.limit !== undefined) req.limit = result.data.limit;
  if (result.data.offset !== undefined) req.offset = result.data.offset;

  next();
};

export { paginationParser, requireCsie };
