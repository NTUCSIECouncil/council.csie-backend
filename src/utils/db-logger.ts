import path from 'path';

import winston from 'winston';

import { env } from '@/config.ts';

const logFormat = winston.format.printf(
  (info: winston.Logform.TransformableInfo) => {
    return `${info.timestamp as string} [${info.level.toUpperCase()}]: ${info.message as string}`;
  },
);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(env.LOGS_DIR, 'database.log'),
      level: 'silly',
    }),
  ],
});

export default logger;
