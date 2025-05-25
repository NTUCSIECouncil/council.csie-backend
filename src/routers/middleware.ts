import fs from 'fs';
import path from 'path';
import { type Request, type RequestHandler } from 'express';
import multer from 'multer';
import { env } from '@/config.ts';
import { ZPaginationQueryParam } from '@models/util-schema.ts';

const authChecker: RequestHandler = (req, res, next) => {
  const userId = req.params.userId;

  if (req.guser?.uid === undefined || req.guser.uid !== userId) {
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
