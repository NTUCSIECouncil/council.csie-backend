import SwaggerParser from '@apidevtools/swagger-parser';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import mongoose from 'mongoose';
import morgan, { type StreamOptions } from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { UserModel } from '@models/user-schema.ts';
import APIController from '@routers/API-controller.ts';
import dbLogger from '@utils/db-logger.ts';
import logger from '@utils/logger.ts';
import { env } from './config.ts';

let auth;
try {
  const firebaseApp = initializeApp({ credential: applicationDefault() });
  logger.info('Connected to Firebase');
  auth = getAuth(firebaseApp);
  logger.info('Initialized Firebase Auth');
} catch (err) {
  logger.error('Error initializing Firebase: ', err);
  logger.error('Exiting...');
  process.exit(1);
}

const expressApp = express();

expressApp.set('query parser', 'extended');

expressApp.use(express.json({ limit: '10mb' }));

const stream: StreamOptions = {
  write: (message: string) => logger.info(message.trim()), // Log HTTP requests using Winston
};

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream },
);

expressApp.use(morganMiddleware);

// Limit each IP to 100 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

expressApp.use(limiter);

expressApp.use(async (req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  const token = req.headers.authorization;

  if (token?.startsWith('Bearer ')) {
    try {
      const decodedToken = await auth.verifyIdToken(token.slice(7));
      const userRecord = await auth.getUser(decodedToken.uid);
      req.guser = userRecord;
      const userId = (await UserModel.findOne({ gid: decodedToken.uid }).exec())
        ?._id;
      req.userId = userId;
      console.log(`Authenticated user: ${userRecord.uid}`);
      // okay
    } catch (err) {
      logger.error('Error verifying Firebase token: ', err);
    }
  }

  next();
});

expressApp.use('/api', APIController);

const api = await SwaggerParser.dereference('./openapi/openapi.yaml');
await SwaggerParser.validate(api);
expressApp.use('/api-docs', swaggerUi.serve, swaggerUi.setup(api));

mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- required function signature
  const truncatedArray = (key: string, value: any): any => {
    const maxArrayLength = 5;
    if (Array.isArray(value) && value.length > maxArrayLength) {
      return value
        .slice(0, maxArrayLength)
        .concat(`...and ${(value.length - maxArrayLength).toString()} more`);
    }
    return value;
  };
  const methodArgsString = methodArgs
    .map(val => JSON.stringify(val, truncatedArray))
    .join(', ');
  dbLogger.debug(
    `Mongoose Query: ${collectionName}.${methodName}(${methodArgsString})`,
  );
});

mongoose.connection.on('connected', () => {
  dbLogger.info('Mongoose connected to database');
});

mongoose.connection.on('disconnected', () => {
  dbLogger.warn('Mongoose disconnected');
});

mongoose.connection.on('error', err => {
  dbLogger.error('Mongoose connection error: ', err);
});

await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });

logger.info(`Connected to ${env.MONGODB_URI}/${env.MONGODB_DB_NAME}`);

expressApp.listen(env.PORT, err => {
  if (err) {
    logger.error(`Failed to start server at port ${env.PORT}: `, err);
    logger.error('Exiting...');
    process.exit(1);
  }

  logger.info(`Listening at port ${env.PORT}`);
});
