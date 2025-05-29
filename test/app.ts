import express from 'express';
import { type UserRecord } from 'firebase-admin/auth';
import { UserModel } from '@/models/user-schema.ts';
import APIController from '@routers/API-controller.ts';

const expressApp = express();

expressApp.set('query parser', 'extended');

expressApp.use(async (req, res, next) => {
  const gidHeader = req.headers.gid;
  if (typeof gidHeader == 'string') {
    const guser: UserRecord = {
      uid: gidHeader,
      email: 'mock@gmail.com',
      emailVerified: true,
      displayName: 'Mock Person',
      photoURL: 'https://mock.com/photo.jpg',
      phoneNumber: undefined,
      disabled: false,
      metadata: {
        creationTime: 'Thu, 25 Jan 2024 09:21:26 GMT',
        lastSignInTime: 'Wed, 16 Apr 2025 16:38:59 GMT',
        lastRefreshTime: 'Wed, 16 Apr 2025 18:34:38 GMT',
        toJSON: () => ({}),
      },
      providerData: [
        {
          uid: '106273168733193938381',
          displayName: 'Mock Person',
          email: 'mock@gmail.com',
          photoURL: 'https://mock.com/photo.jpg',
          providerId: 'google.com',
          phoneNumber: '+886912345678',
          toJSON: () => ({}),
        },
      ],
      passwordHash: undefined,
      passwordSalt: undefined,
      tokensValidAfterTime: 'Thu, 25 Jan 2024 09:21:26 GMT',
      tenantId: undefined,
      toJSON: () => ({}),
    };
    req.guser = guser;
    const userId = (await UserModel.findOne({ gid: gidHeader }).exec())?._id;
    req.userId = userId;
  }

  next();
});

expressApp.use(express.json());
expressApp.use('/api', APIController);

export default expressApp;
