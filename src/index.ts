import express from 'express'
import cors from 'cors'
import { getAuth, DecodedIdToken } from 'firebase-admin/auth'
import { initializeApp } from 'firebase-admin/app'
import admin from 'firebase-admin'

declare global {
    namespace Express {
        interface Request {
            user?: DecodedIdToken | null;
        }
    }
}

const auth = getAuth(initializeApp({ credential: admin.credential.cert('./service-account-file.json') }));
// The file is generated from 
// https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk?hl=zh-tw&_gl=1*z361db*_ga*MTUwNDEzMzY1Ni4xNzA2MDQ1MzY0*_ga_CW55HF8NVT*MTcwNjA5NTQ1My40LjEuMTcwNjA5OTM4MS4yMC4wLjA.
// Please refer to
// https://firebase.google.com/docs/admin/setup?hl=zh-tw#initialize_the_sdk_in_non-google_environments

const app = express()
const port = 3000

app.use(cors())

app.use(async (req, res, next) => {
    let token = req.headers.authorization;
    if (!token) next();
    // 驗證 token
    else {
        try {
            token = token.split(' ')[1];
            const decodedToken = await auth.verifyIdToken(token);
            req.user = decodedToken;
            console.log(req.user);
            next();
        } catch (error) {
            console.log(error);
            next();
        }
    }
})

app.listen(port)
console.log('Start listening')
