import express from 'express';
import { type DecodedIdToken } from 'firebase-admin/auth';
import APIController from '@routers/API-controller.ts';

const expressApp = express();

process.env.QUIZ_FILE_DIR = 'uploads/quizzes';

expressApp.use((req, res, next) => {
  const uidHeader = req.headers.uid;
  let uid = 'uid';
  if (typeof uidHeader == 'string') { uid = uidHeader; }

  const guser: DecodedIdToken = {
    name: 'Mock Person',
    iss: 'https://securetoken.google.com/csie-council',
    aud: 'csie-council',
    auth_time: 1724052294,
    user_id: uid,
    sub: uid,
    iat: 1724144419,
    exp: 1724148019,
    email: 'mock-email@gail.com',
    email_verified: true,
    firebase: {
      identities: { 'google.com': [Array], 'email': [Array] },
      sign_in_provider: 'google.com',
    },
    uid: uid,
  };
  req.guser = guser;
  next();
});

expressApp.use(express.json());
expressApp.use('/api', APIController);

export default expressApp;
