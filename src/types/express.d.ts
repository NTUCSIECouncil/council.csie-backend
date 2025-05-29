import { type UUID } from 'crypto';
import { type UserRecord } from 'firebase-admin/auth';

declare global {
  declare namespace Express {
    export interface Request {
      guser?: UserRecord;
      userId?: UUID;
      limit?: number;
      offset?: number;
    }
  }
}
