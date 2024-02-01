import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert } from 'firebase-admin/app';
import mongoose from 'mongoose';
import { registerSchemas } from '@/models/';
import exampleController from '@/routers/ExampleController';

// Open connection to the "test" database on locally running instance of mongodb
main().catch(err => { console.log(err); });

async function main (): Promise<void> {
  await mongoose.connect('mongodb://127.0.0.1:27017/test');
  registerSchemas();
  const models = {
    users: mongoose.model('User')
  };
  /* testing
  const user = new models.users({
    name: 'John'
  });
  await user.save();
  console.log(user.name);
  */
}

// File back/service-account-file.json is the private key to access firebase-admin
// It is ignored by git intentionally. Please refer to back/README.md
const firebaseApp = initializeApp({ credential: cert('./service-account-file.json') });
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
    if (token === undefined) {
      next();
    } else {
      const decodedToken = await auth.verifyIdToken(token);
      req.token = decodedToken;
      req.uid = decodedToken.uid;
      next();
    }
  })().catch((err) => {
    console.log(err);
  });
});

expressApp.get('/api/create-time', (req, res) => {
  (async () => {
    if (req.uid === undefined) {
      return res.sendStatus(403);
    } else {
      const userRecord = await auth.getUser(req.uid); // raise error if invalid
      res.json({ createTime: userRecord.metadata.creationTime });
    }
  })().catch((err) => {
    console.log(err);
  });
});

expressApp.use('/api/example', exampleController);

expressApp.listen(port);
console.log(`Start listening at port ${port}`);
