import { type RequestHandler } from 'express';
import { z } from 'zod';

import { ZPaginationQueryParam } from '@models/util-schema.ts';
import logger from '@utils/logger.ts';

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

export { paginationParser };
