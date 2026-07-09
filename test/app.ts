import { type RequestHandler } from 'express';
import { type DecodedIdToken } from 'firebase-admin/auth';

import { createApp } from '@/app.ts';
import { UserModel } from '@/models/user-schema.ts';

// Mirror the production auth middleware: verifying the token yields a
// DecodedIdToken (no getUser round-trip). The `gid` header stands in for a
// verified token belonging to that user.
const mockAuth: RequestHandler = async (req, res, next) => {
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
};

// Build the test app through the same factory production uses. The request logger and rate limiter are operational-only and left out here.
export default createApp({ auth: mockAuth });
