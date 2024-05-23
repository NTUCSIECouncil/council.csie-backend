import express from 'express';
import APIController from '../src/routers/API-controller';
import { DecodedIdToken } from 'firebase-admin/auth';

const expressApp = express();
const port = 3010;

expressApp.use((req, res, next) => {
  const uidHeader = req.headers.uid;
  let uid: string = 'uid';
  if (typeof uidHeader == 'string') { uid = uidHeader; }
  const guser: DecodedIdToken = {
    iss: 'https://securetoken.google.com/YOUR_PROJECT_ID',
    aud: 'YOUR_PROJECT_ID',
    auth_time: 1592566566,
    sub: uid,
    iat: 1592566566,
    exp: 1592570166,
    firebase: {
      identities: {},
      sign_in_provider: 'google.com'
    },
    uid: uid
  }  
  if (guser) {
    req.guser = guser;
  }
  next(); 
});

expressApp.use(express.json());
expressApp.use('/api', APIController);

export default expressApp