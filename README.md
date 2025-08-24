# council.csie 後端

國立臺灣大學資訊工程學系學生會網站的後端服務。

## 需求

- Node.js 22（專案提供 `.nvmrc`）
- 本機可用的 MongoDB（預設 `mongodb://127.0.0.1:27017`）
- Firebase service account JSON 憑證檔

## 快速開始

1. 安裝相依

```bash
npm ci
```

1. 設定環境變數

- 版本庫提供 `.env.default` 預設值；建立 `.env` 覆蓋需要的變數（見下方）。

1. 啟動開發伺服器

```bash
# 一次性啟動
npm run dev

# 監聽 src/ 和 openapi/ 檔案變更
# 在終端機按 Enter 可手動重啟；Ctrl+C 結束。
npm run dev:watch
```

## API 文件

- 規格：`openapi/`
- Swagger UI：`http://localhost:3010/api-docs`（或依 `.env` 的 PORT）

## 常用指令

```bash
# 型別檢查
npm run type-check

# 程式碼格式（Prettier）
npm run format
npm run format:check

# 程式碼品質（ESLint）
npm run lint
npm run lint:check

# 測試（Vitest）
npm run test
npm run test:watch
```

## 初始化開發資料與檔案

按順序執行：

```bash
npm run fetch-courses     # 下載課程資料到 samples/course-original.json
npm run generate-samples  # 產生樣本資料到 samples/
npm run setup-dev-db      # 建立 dev 資料庫並放置檔案到 uploads/
```

測試前請先完成上述資料建立（資料位於 `samples/`）。

## 環境變數

專案會讀取 `.env.default` 與 `.env`，並以 `.env` 覆蓋預設值。

- MONGODB_URI（預設 `mongodb://127.0.0.1:27017`）
- MONGODB_DB_NAME（預設 `csie-council-dev`）
- PORT（預設 `3010`）
- FIREBASE_CERT_PATH（預設 `./service-account-file.json`）
- UPLOADS_DIR（預設 `./uploads`）
- SAMPLES_DIR（預設 `./samples`）

## Firebase service account

為了安全，`firebase-admin` 的密鑰只放在本機。[官方說明](https://firebase.google.com/docs/admin/setup?hl=zh-tw#initialize_the_sdk_in_non-google_environments) 下載後，放在 `./service-account-file.json`，或以 `FIREBASE_CERT_PATH` 指定路徑。

## 日誌與資料夾

- 伺服器與 HTTP 日誌：`logs/combined.log`, `logs/error.log`
- 資料庫查詢日誌：`logs/database.log`
- 測試日誌：`logs/test/`
- 上傳檔案：`uploads/`

## 專案結構

- `src/` 伺服器程式碼（Express, Mongoose 等）
- `openapi/` OpenAPI 規格與路徑
- `scripts/` 初始化與資料產生腳本（tsx 執行）
- `samples/` 開發與測試用資料
- `uploads/` 測試題庫/評價文等檔案
- `test/` 端點測試（Vitest + Supertest）
- `logs/` 伺服器/DB 日誌

## 疑難排解

- 連線不到 MongoDB：確認本機 MongoDB 已啟動或調整 `MONGODB_URI`。
- Firebase 初始化失敗：確認 `FIREBASE_CERT_PATH` 指向正確的 service account 檔案。
- Swagger UI 無法開啟：確認服務已啟動與 `PORT` 未被占用。
