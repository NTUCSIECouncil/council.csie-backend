import { type DecodedIdToken } from 'firebase-admin/auth';

declare module 'express-serve-static-core' {
  interface Request {
    guser?: DecodedIdToken;
  }
  interface Response {
    createTime?: string;
  }
}
