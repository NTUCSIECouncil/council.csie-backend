# council.csie 後端

[開發文件](https://hackmd.io/MJnE9jwfSZiR0ehygAGW5Q)

## Usage

- 使用 `npm ci` 安裝 packages。
- 使用 `npm start` 跑起來。
- 使用 `npm run lint` 在整個 `/src` 上運行 ESLint，`npm run lint -- --fix` 修復所有可自動修復的問題。

## `dotenv` 相關

`git clone` 下來會有一個 `dotenv` 檔案。這是本地的 `.env` 的預設值。請 `cp dotenv .env` 後，視個人需要更改 `.env`。

## Firebase service account 相關

為了安全因素，存取 `firebase-admin` 使用的密鑰不應該離開本機。參考[官方教學](https://firebase.google.com/docs/admin/setup?hl=zh-tw#initialize_the_sdk_in_non-google_environments)，請以已加入 Firebase 的 Google 帳號身分到[這裡](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk?hl=zh-tw&_gl=1*z361db*_ga*MTUwNDEzMzY1Ni4xNzA2MDQ1MzY0*_ga_CW55HF8NVT*MTcwNjA5NTQ1My40LjEuMTcwNjA5OTM4MS4yMC4wLjA)生成並下載密鑰檔，並更改檔名 `service-account-file.json` 放置到 `back/` 底下。這個檔名可以在 `.env` 更改。
