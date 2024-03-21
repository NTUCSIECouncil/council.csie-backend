import 'dotenv/config';
import express from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import mongoose from 'mongoose';
import APIController from '@/routers/APIController';

// Open connection to the "test" database on locally running instance of mongodb
(async () => {
  if (process.env.MONGODB_URL === undefined) { throw new Error('MONGODB_URL is not defined.'); }
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connect to MongoDB');
  /* testing
  const user = new models.users({
    name: 'John'
  });
  await user.save();
  console.log(user.name);
  */
})().catch((err) => {
  console.log(err);
});

// File back/service-account-file.json is the private key to access firebase-admin
// It is ignored by git intentionally. Please refer to back/README.md
if (process.env.FIREBASE_CERT_PATH === undefined) {
  throw new Error('FIREBASE_CERT_PATH is not defined.');
}
const firebaseApp = initializeApp({ credential: cert(process.env.FIREBASE_CERT_PATH) });
const auth = getAuth(firebaseApp);

const expressApp = express();
const port = 3010;

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
    if (token === undefined || !token.startsWith('Bearer ')) {
      next();
    } else {
      const decodedToken = await auth.verifyIdToken(token.slice(7));
      req.guser = decodedToken;
      // console.log('guser:', decodedToken);
      next();
    }
  })().catch((err) => {
    console.log(err);
    next();
  });
});

expressApp.get('/api/create-time', (req, res) => {
  (async () => {
    if (req.guser?.uid === undefined) {
      res.sendStatus(403);
    } else {
      const userRecord = await auth.getUser(req.guser?.uid); // raise error if invalid
      res.json({ createTime: userRecord.metadata.creationTime });
    }
  })().catch((err) => {
    console.log(err);
  });
});

expressApp.use(express.json());
expressApp.use('/api', APIController);

expressApp.listen(port, () => {
  console.log(`Start listening at port ${port}`);
});
