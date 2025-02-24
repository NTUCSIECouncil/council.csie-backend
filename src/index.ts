import express from 'express';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import mongoose from 'mongoose';
import morgan, { type StreamOptions } from 'morgan';
import APIController from '@routers/API-controller.ts';
import dbLogger from '@utils/db-logger.ts';
import logger from '@utils/logger.ts';

// File back/service-account-file.json is the private key to access firebase-admin
// It is ignored by git intentionally. Please refer to back/README.md
if (process.env.FIREBASE_CERT_PATH === undefined) {
  throw new Error('FIREBASE_CERT_PATH is not defined.');
}
const firebaseApp = initializeApp({ credential: cert(process.env.FIREBASE_CERT_PATH) });
const auth = getAuth(firebaseApp);

const expressApp = express();

expressApp.use(express.json());

// TODO: necessity
// import cors from 'cors';
// expressApp.use(cors({
//   origin: [
//     'http://localhost:3000'
//   ]
// }));

const stream: StreamOptions = {
  write: (message: string) => logger.info(message.trim()), // Log HTTP requests using Winston
};

const morganMiddleware = morgan(':method :url :status :res[content-length] - :response-time ms', { stream });

expressApp.use(morganMiddleware);

expressApp.use((req, res, next) => {
  (async () => {
    const token = req.headers.authorization;

    if (!token?.startsWith('Bearer ')) {
      next();
      return;
    }

    const decodedToken = await auth.verifyIdToken(token.slice(7));
    req.guser = decodedToken;
    next();
  })().catch((err: unknown) => {
    console.error(err);
    next();
  });
});

expressApp.use('/api', APIController);

mongoose.set('debug', (collectionName, method, query, doc) => {
  dbLogger.debug(`Mongoose Query: ${collectionName}.${method} ${JSON.stringify(query)} ${JSON.stringify(doc)}`);
});

if (process.env.MONGODB_URL === undefined) throw new Error('MONGODB_URL is not defined.');
if (process.env.MONGODB_DB_NAME === undefined) throw new Error('MONGODB_DB_NAME is not defined.');
await mongoose.connect(process.env.MONGODB_URL, { dbName: process.env.MONGODB_DB_NAME });
console.log(`Connected to ${process.env.MONGODB_URL}/${process.env.MONGODB_DB_NAME}`);

mongoose.connection.on('connected', () => {
  dbLogger.info('Mongoose connected to database');
});

mongoose.connection.on('disconnected', () => {
  dbLogger.warn('Mongoose disconnected');
});

mongoose.connection.on('error', (err) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  dbLogger.error(`Mongoose connection error: ${errorMessage}`);
});

const port = process.env.PORT;
if (port === undefined) {
  throw new Error('PORT is not defined.');
}

expressApp.listen(port, () => {
  console.log(`Start listening at port ${port}`);
});
