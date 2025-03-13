# council.csie 後端

國立臺灣大學資訊工程學系學生會網站的後端。

## API

支援的 API 請參考[這裡](https://hackmd.io/@seantsao00/council_csie)。

## Usage

- 使用 `npm ci` 安裝 packages。
- 使用 `npm run dev` 跑起來。
  - 除了 `./node_modules`，所有檔案都會被監聽；當有變更時會自動重新啟動。
  - 在終端機中按下 `Enter` 來手動重新啟動。
  - 在終端機中按下 `Ctrl+C` 來關閉。
- 使用 `npm run lint` 來在整個專案的 TypeScript 檔案上運行 ESLint。
  - 使用 `npm run lint -- --fix` 修復所有可自動修復的問題。

## `.env` 相關

`git clone` 下來會有一個 `.default.env` 檔案，其中有一些環境變數的預設值。請建立一個叫做 `.env` 的空白檔案，並且將任何你想要覆蓋或新定義的環境變數寫入其中，參考 `default.env` 的格式。

## Firebase service account 相關

為了安全因素，存取 `firebase-admin` 使用的密鑰不應該離開本機。[這裡](https://firebase.google.com/docs/admin/setup?hl=zh-tw#initialize_the_sdk_in_non-google_environments)的密鑰應該被放進 `./service-account-file.json`。這個檔名用環境變數 `FIREBASE_CERT_PATH` 指定。
