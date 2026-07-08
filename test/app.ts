import express from 'express';
import { type DecodedIdToken } from 'firebase-admin/auth';

import { UserModel } from '@/models/user-schema.ts';
import APIController from '@routers/API-controller.ts';

const expressApp = express();

expressApp.set('query parser', 'extended');

// Mirror the production auth middleware: verifying the token yields a
// DecodedIdToken (no getUser round-trip). The `gid` header stands in for a
// verified token belonging to that user.
expressApp.use(async (req, res, next) => {
  const gidHeader = req.headers.gid;
  if (typeof gidHeader == 'string') {
    const decodedToken: DecodedIdToken = {
      aud: 'mock-project',
      auth_time: 1706174486,
      exp: 1745000000,
      iat: 1745000000,
      iss: 'https://securetoken.google.com/mock-project',
      sub: gidHeader,
      uid: gidHeader,
      email: 'mock@csie.ntu.edu.tw',
      email_verified: true,
      name: 'Mock Person',
      firebase: {
        identities: { 'google.com': [gidHeader] },
        sign_in_provider: 'google.com',
      },
    };
    req.decodedToken = decodedToken;
    const userId = (await UserModel.findOne({ gid: gidHeader }).exec())?._id;
    req.userId = userId;
  }

  next();
});

expressApp.use(express.json({ limit: '10mb' }));
expressApp.use('/api', APIController);

export default expressApp;
