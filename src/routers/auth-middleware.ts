import { type RequestHandler } from 'express';
import { type Auth } from 'firebase-admin/auth';

import { UserModel } from '@models/user-schema.ts';
import logger from '@utils/logger.ts';

/**
 * Global auth middleware backed by Firebase. Reads a bearer token or `token`
 * cookie, verifies it, and populates `req.decodedToken` / `req.rawToken` /
 * `req.userId`. Auth is optional here: a missing or invalid token simply leaves
 * these unset and handlers enforce auth themselves.
 *
 * Exposed as a factory over its `Auth` dependency so it can be unit-tested and
 * so `index.ts` stays a thin bootstrap (see `createApp`).
 */
export const firebaseAuth =
  (auth: Auth): RequestHandler =>
  async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const cookieToken = (req.cookies as Record<string, string | undefined>)
      .token;
    const rawToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : cookieToken;

    if (rawToken !== undefined) {
      try {
        const decodedToken = await auth.verifyIdToken(rawToken);
        req.decodedToken = decodedToken;
        req.rawToken = rawToken;
        req.userId = (
          await UserModel.findOne({ gid: decodedToken.uid })
            .select('_id')
            .lean()
            .exec()
        )?._id;
      } catch (err) {
        logger.error('Error verifying Firebase token: ', err);
      }
    }

    next();
  };
