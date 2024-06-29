import { type DecodedIdToken } from 'firebase-admin/auth';

declare module 'express-serve-static-core' {
  interface Request {
    guser?: DecodedIdToken;
    portionSize?: number;
    portionNum?: number;
  }
  interface Response {
    createTime?: string;
  }
}
