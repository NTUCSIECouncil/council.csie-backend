import express from 'express';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import mongoose from 'mongoose';
import APIController from '@routers/API-controller.ts';

// File back/service-account-file.json is the private key to access firebase-admin
// It is ignored by git intentionally. Please refer to back/README.md
if (process.env.FIREBASE_CERT_PATH === undefined) {
  throw new Error('FIREBASE_CERT_PATH is not defined.');
}
const firebaseApp = initializeApp({ credential: cert(process.env.FIREBASE_CERT_PATH) });
const auth = getAuth(firebaseApp);

const expressApp = express();
const port = process.env.PORT;
if (port === undefined) {
  throw new Error('PORT is not defined.');
}

// TODO: necessity
// import cors from 'cors';
// expressApp.use(cors({
//   origin: [
//     'http://localhost:3000'
//   ]
// }));

expressApp.use((req, res, next) => {
  (async () => {
    const token = req.headers.authorization;
    if (!token?.startsWith('Bearer ')) {
      next();
    } else {
      const decodedToken = await auth.verifyIdToken(token.slice(7));
      req.guser = decodedToken;
      // console.log('guser:', decodedToken);
      next();
    }
  })().catch((err: unknown) => {
    console.log(err);
    next();
  });
});

expressApp.use(express.json());
expressApp.use('/api', APIController);

// Open connection to the "test" database on locally running instance of mongodb
(async () => {
  if (process.env.MONGODB_URL === undefined) throw new Error('MONGODB_URL is not defined.');
  if (process.env.MONGODB_DB_NAME === undefined) throw new Error('MONGODB_DB_NAME is not defined.');
  await mongoose.connect(process.env.MONGODB_URL, { dbName: process.env.MONGODB_DB_NAME });
  console.log(`Connected to ${process.env.MONGODB_DB_NAME} at ${process.env.MONGODB_URL}.`);

  expressApp.listen(port, () => {
    console.log(`Start listening at port ${port}`);
  });
})().catch((err: unknown) => {
  console.log(err);
});
