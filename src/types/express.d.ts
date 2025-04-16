import { type UserRecord } from 'firebase-admin/auth';

declare global {
  declare namespace Express {
    export interface Request {
      guser?: UserRecord;
      limit?: number;
      offset?: number;
    }
  }
}
