import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logFormat = winston.format.printf((info: winston.Logform.TransformableInfo) => {
  const log = `${info.timestamp as string} [${(info.level)}]: ${info.message as string}`;

  return info.stack
  // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- properly handled by winston
    ? `${log}\n${info.stack}`
    : log;
},
);

const logDir = 'logs';
const testLogDir = path.join(logDir, 'test');

if (process.env.NODE_ENV === 'test') {
  try {
    await fs.promises.rm(testLogDir, { recursive: true, force: true });
  } catch (err) {
    console.warn('Failed to remove test log directory: ', err);
  }
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format((info) => {
      info.level = info.level.toUpperCase();
      return info;
    })(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.File({
      filename: path.join((process.env.NODE_ENV === 'test') ? testLogDir : logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join((process.env.NODE_ENV === 'test') ? testLogDir : logDir, 'combined.log'),
    }),
  ],
});

if (process.env.NODE_ENV !== 'test') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat,
    ),
  }));
}

export default logger;
