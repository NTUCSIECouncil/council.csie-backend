import 'dotenv/config';
import express from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import mongoose from 'mongoose';
import APIController from '@/routers/APIController';
import { models } from '@/models/index';
import { ArticleSearchQueryParam } from '@type/query-param';

// Open connection to the "test" database on locally running instance of mongodb
(async () => {
  if (process.env.MONGODB_URL === undefined) { throw new Error('MONGODB_URL is not defined.'); }
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connect to MongoDB');
  /* testing
  
  const article1 = new models.Article({
    title: "abc",
    lecturer: "def",
    tag: ['a', 'b'], 
    grade: 2,   // what grade is the creator when posted
    categories: ['a', 'b'], // more official tags, ex: elective, required, etc.
    creator: new models.User({ name: 'user1' })
  });
  await article1.save();
  console.log(article1.title);
  const article2 = new models.Article({
    title: "cba",
    lecturer: "qwe",
    tag: ['c', 'e'], 
    grade: 2,   // what grade is the creator when posted
    categories: ['a', 'b'], // more official tags, ex: elective, required, etc.
    creator: new models.User({ name: 'user1' })
  });
  await article2.save();
  console.log(article2.title);
  const searchParams: ArticleSearchQueryParam = {
    grade: 1
  };
  console.log(models.Article);
  
  async function searchArticles() {
    try {
      const { result } = await models.Article.findArticles(searchParams);
      console.log('Found articles:', result);
    } catch (error) {
      console.error('Error searching articles:', error);
    }
  }
  
  
  // Don't forget to call the function where appropriate
  searchArticles();

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
