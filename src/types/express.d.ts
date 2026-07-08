import { type UUID } from 'crypto';

import { type DecodedIdToken } from 'firebase-admin/auth';

declare global {
  declare namespace Express {
    export interface Request {
      decodedToken?: DecodedIdToken;
      userId?: UUID;
      rawToken?: string;
      limit?: number;
      offset?: number;
    }
  }
}
