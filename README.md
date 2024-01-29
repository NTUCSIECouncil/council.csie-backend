# council.csie 後端

[開發文件](https://hackmd.io/MJnE9jwfSZiR0ehygAGW5Q)

## Usage

- 使用 `npm ci` 安裝 packages。
- 使用 `npm start` 跑起來。
- 使用 `npm lint` 修復所有可自動修復的 ESLint 問題。這基本上可以修復所有 styling rule 的問題。

## Firebase service account 相關

為了安全因素，存取 `firebase-admin` 使用的密鑰不應該離開本機。參考[官方教學](https://firebase.google.com/docs/admin/setup?hl=zh-tw#initialize_the_sdk_in_non-google_environments)，請以已加入 Firebase 的 Google 帳號身分到[這裡](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk?hl=zh-tw&_gl=1*z361db*_ga*MTUwNDEzMzY1Ni4xNzA2MDQ1MzY0*_ga_CW55HF8NVT*MTcwNjA5NTQ1My40LjEuMTcwNjA5OTM4MS4yMC4wLjA)生成並下載密鑰檔，並更改檔名 `service-account-file.json` 放置到 `back/` 底下。
