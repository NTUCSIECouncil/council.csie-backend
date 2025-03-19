import path from 'path';
import { type Request, type RequestHandler } from 'express';
import multer from 'multer';
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

const fileUploader = (options: {
  fileDir: string; // Directory where files will be saved
  allowedMimeTypes: string[]; // List of allowed file types (e.g., 'application/pdf')
  getFilename: (req: Request) => string; // Function to generate filename
}) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- fileDir is required
      cb(null, path.join(process.env.PWD!, options.fileDir));
    },
    filename: (req, file, cb) => {
      cb(null, options.getFilename(req));
    },
  });

  return multer({
    storage,
    fileFilter: (req, file, cb) => {
      if (options.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  });
};

export { authChecker, paginationParser, fileUploader };
