import winston from 'winston';

const logFormat = winston.format.printf((info: winston.Logform.TransformableInfo) => {
  const log = `${info.timestamp as string} [${(info.level)}]: ${info.message as string}`;

  return info.stack
  // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- properly handled by winston
    ? `${log}\n${info.stack}`
    : log;
},
);

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
    new winston.transports.Console({
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat,
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

export default logger;
