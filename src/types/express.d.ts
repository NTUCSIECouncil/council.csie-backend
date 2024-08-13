import { type DecodedIdToken } from 'firebase-admin/auth';

declare global {
  declare namespace Express {
    export interface Request {
      guser?: DecodedIdToken;
      portionSize?: number;
      portionNum?: number;
    }
  }
}
