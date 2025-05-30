import fs from 'fs';
import path from 'path';
import { type Request, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod/v4';
import { env } from '@/config.ts';
import logger from '@/utils/logger.ts';
import { ZPaginationQueryParam } from '@models/util-schema.ts';

const authChecker: RequestHandler = (req, res, next) => {
  if (!req.userId) {
    res.sendStatus(401);
    logger.warn(`Unauthorized access in ${req.method} ${req.baseUrl}: userId is undefined`);
    return;
  }
  if (req.userId !== req.params.userId) {
    res.sendStatus(403);
    logger.warn(`Forbidden access in ${req.method} ${req.baseUrl}: userId mismatch`);
    return;
  }

  next();
};

const paginationParser: RequestHandler = (req, res, next) => {
  req.limit = 10;
  req.offset = 0;

  const result = ZPaginationQueryParam.safeParse(req.query);
  if (!result.success) {
    logger.warn(`Failed to parse pagination query parameters in ${req.method} ${req.baseUrl}:\n${z.prettifyError(result.error)}`);
    res.sendStatus(400);
    return;
  }

  if (result.data.limit !== undefined) req.limit = result.data.limit;
  if (result.data.offset !== undefined) req.offset = result.data.offset;

  next();
};

const fileUploader = (
  fileDir: string,
  allowedMimeTypes: string[],
  getFilename: (req: Request) => string,
): RequestHandler => {
  const uploadDir = path.join(env.PWD, fileDir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, getFilename(req));
    },
  });

  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid file type'));
      }
    },
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  });

  const handler: RequestHandler = async (req, res, next) => {
    try {
      await upload.single('file')(req, res, next);
    } catch (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'File too large. Max size is 10MB.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          res.status(400).json({ error: 'Invalid file type.' });
        }
        res.status(400).json({ error: err.message });
      } else if (err) {
        console.error('File upload error:', err);
        res.status(500).json({ error: 'File upload failed' });
      }
    }
  };
  return handler;
};

export { authChecker, paginationParser, fileUploader };
