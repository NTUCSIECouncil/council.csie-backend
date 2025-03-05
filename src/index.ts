import express from 'express';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import mongoose from 'mongoose';
import morgan, { type StreamOptions } from 'morgan';
import APIController from '@routers/API-controller.ts';
import dbLogger from '@utils/db-logger.ts';
import logger from '@utils/logger.ts';

if (process.env.FIREBASE_CERT_PATH === undefined) {
  logger.error('FIREBASE_CERT_PATH is not defined.');
  logger.error('Exiting...');
  process.exit(1);
}

if (process.env.MONGODB_URL === undefined) {
  logger.error('MONGODB_URL is not defined.');
  logger.error('Exiting...');
  process.exit(1);
}
if (process.env.MONGODB_DB_NAME === undefined) {
  logger.error('MONGODB_DB_NAME is not defined.');
  logger.error('Exiting...');
  process.exit(1);
}

if (process.env.PORT === undefined) {
  logger.error('PORT is not defined.');
  logger.error('Exiting...');
  process.exit(1);
}

if (process.env.QUIZ_FILE_DIR === undefined) {
  logger.error('QUIZ_FILE_DIR is not defined.');
  logger.error('Exiting...');
  process.exit(1);
}

let auth;
try {
  const firebaseApp = initializeApp({ credential: cert(process.env.FIREBASE_CERT_PATH) });
  logger.info('Connected to Firebase');
  auth = getAuth(firebaseApp);
  logger.info('Initialized Firebase Auth');
} catch (err) {
  logger.error('Error initializing Firebase: ', err);
  logger.error('Exiting...');
  process.exit(1);
}

const expressApp = express();

expressApp.use(express.json());

const stream: StreamOptions = {
  write: (message: string) => logger.info(message.trim()), // Log HTTP requests using Winston
};

const morganMiddleware = morgan(':method :url :status :res[content-length] - :response-time ms', { stream });

expressApp.use(morganMiddleware);

expressApp.use(async (req, res, next) => {
  const token = req.headers.authorization;

  if (token?.startsWith('Bearer ')) {
    try {
      const decodedToken = await auth.verifyIdToken(token.slice(7));
      req.guser = decodedToken;
    } catch (err) {
      logger.error('Error verifying Firebase token: ', err);
    }
  }

  next();
});

expressApp.use('/api', APIController);

mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- required function signature
  const truncatedArray = (key: string, value: any): any => {
    const maxArrayLength = 5;
    if (Array.isArray(value) && value.length > maxArrayLength) {
      return value.slice(0, maxArrayLength).concat(
        `...and ${(value.length - maxArrayLength).toString()} more`);
    }
    return value;
  };
  const methodArgsString = methodArgs.map(val => JSON.stringify(val, truncatedArray)).join(', ');
  dbLogger.debug(`Mongoose Query: ${collectionName}.${methodName}(${methodArgsString})`);
});

mongoose.connection.on('connected', () => {
  dbLogger.info('Mongoose connected to database');
});

mongoose.connection.on('disconnected', () => {
  dbLogger.warn('Mongoose disconnected');
});

mongoose.connection.on('error', (err) => {
  dbLogger.error('Mongoose connection error: ', err);
});

await mongoose.connect(process.env.MONGODB_URL, { dbName: process.env.MONGODB_DB_NAME });

logger.info(`Connected to ${process.env.MONGODB_URL}/${process.env.MONGODB_DB_NAME}`);

expressApp.listen(process.env.PORT, (err) => {
  if (err) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PORT is defined
    logger.error(`Failed to start server at port ${process.env.PORT!}: `, err);
    logger.error('Exiting...');
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PORT is defined
  logger.info(`Listening at port ${process.env.PORT!}`);
});
