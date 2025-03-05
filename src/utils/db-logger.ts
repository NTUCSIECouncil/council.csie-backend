import winston from 'winston';

const logFormat = winston.format.printf((info: winston.Logform.TransformableInfo) => {
  return `${info.timestamp as string} [${(info.level).toUpperCase()}]: ${info.message as string}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    logFormat,
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/database.log' }),
  ],
});

export default logger;
