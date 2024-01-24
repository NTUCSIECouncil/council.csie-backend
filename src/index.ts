import express from 'express'
import cors from 'cors'
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'
import { initializeApp } from 'firebase-admin/app'
import admin from 'firebase-admin'

declare module 'express-serve-static-core' {
  interface Request {
    user?: DecodedIdToken
  }
}

const firebaseApp = initializeApp({ credential: admin.credential.cert('./service-account-file.json') })
const auth = getAuth(firebaseApp)
// The file is generated from
// https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk?hl=zh-tw&_gl=1*z361db*_ga*MTUwNDEzMzY1Ni4xNzA2MDQ1MzY0*_ga_CW55HF8NVT*MTcwNjA5NTQ1My40LjEuMTcwNjA5OTM4MS4yMC4wLjA.
// Please refer to
// https://firebase.google.com/docs/admin/setup?hl=zh-tw#initialize_the_sdk_in_non-google_environments

const expressApp = express()
const port = 3000

expressApp.use(cors())

expressApp.use((req, res, next) => {
  let token = req.headers.authorization
  if (token === undefined) next()
  // 驗證 token
  else {
    (async () => {
      token = token.split(' ')[1]
      const decodedToken = await auth.verifyIdToken(token)
      req.user = decodedToken
      console.log(req.user)
      next()
    })().catch((err) => {
      console.log(err)
    })
  }
})

expressApp.listen(port)
console.log('Start listening')
