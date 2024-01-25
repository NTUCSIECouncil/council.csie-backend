import express from 'express'
import cors from 'cors'
import { getAuth } from 'firebase-admin/auth'
import { initializeApp, cert } from 'firebase-admin/app'

const firebaseApp = initializeApp({ credential: cert('./service-account-file.json') })
const auth = getAuth(firebaseApp)
// The file is generated from
// https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk?hl=zh-tw&_gl=1*z361db*_ga*MTUwNDEzMzY1Ni4xNzA2MDQ1MzY0*_ga_CW55HF8NVT*MTcwNjA5NTQ1My40LjEuMTcwNjA5OTM4MS4yMC4wLjA.
// Please refer to
// https://firebase.google.com/docs/admin/setup?hl=zh-tw#initialize_the_sdk_in_non-google_environments

const expressApp = express()
const port = 3010

expressApp.use(cors())

expressApp.use((req, res, next) => {
  (async () => {
    const token = req.headers.authorization
    if (token === undefined) {
      next()
    } else {
      const decodedToken = await auth.verifyIdToken(token)
      req.token = decodedToken
      req.uid = decodedToken.uid
      next()
    }
  })().catch((err) => {
    console.log(err)
  })
})

expressApp.get('/create-time', (req, res) => {
  (async () => {
    if (req.uid === undefined) {
      return res.sendStatus(403)
    } else {
      const userRecord = await auth.getUser(req.uid) // raise error if invalid
      res.json({ createTime: userRecord.metadata.creationTime })
    }
  })().catch((err) => {
    console.log(err)
  })
})

expressApp.listen(port)
console.log(`Start listening at port ${port}`)
