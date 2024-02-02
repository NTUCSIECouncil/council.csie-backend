import { type DecodedIdToken } from 'firebase-admin/auth';

declare module 'express-serve-static-core' {
  interface Request {
    guser?: DecodedIdToken; // expect a string from getIdToken()
  }
  interface Response {
    createTime?: string;
  }
}
