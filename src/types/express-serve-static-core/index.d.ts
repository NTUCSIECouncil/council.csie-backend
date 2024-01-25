import { type DecodedIdToken } from 'firebase-admin/auth'

declare module 'express-serve-static-core' {
  interface Request {
    token?: DecodedIdToken // expect a string from getIdToken()
    uid?: string
  }
  interface Responce {
    createTime?: string
  }
}
