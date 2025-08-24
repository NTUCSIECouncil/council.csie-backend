# council.csie backend

Backend service for the NTU CSIE Student Council website.

## Prerequisites

- Node.js 22 (repo includes `.nvmrc`)
- MongoDB available locally (default `mongodb://127.0.0.1:27017`)
- Firebase service account JSON credentials

## Quick start

1. Install dependencies

   ```bash
   npm ci
   ```

1. Configure environment variables
   - `.env.default` provides defaults; create `.env` to override values (see “Environment variables”).

1. Start the dev server

   ```bash
   # One-off start
   npm run dev

   # Watch src/ and openapi/ for changes
   # Press Enter in the terminal to restart; Ctrl+C to stop
   npm run dev:watch
   ```

## API docs

- Spec: `openapi/`
- Swagger UI: `http://localhost:3010/api-docs` (or your `PORT` in `.env`)

## Sample data (optional)

Run in order if you want prefilled data locally:

```bash
npm run fetch-courses     # Fetch course data to samples/course-original.json
npm run generate-samples  # Generate sample data to samples/
npm run setup-dev-db      # Create dev DB and place files under uploads/
```

## Environment variables

Runtime loads both `.env.default` and `.env`, with `.env` overriding defaults.

- MONGODB_URI (default `mongodb://127.0.0.1:27017`)
- MONGODB_DB_NAME (default `csie-council-dev`)
- PORT (default `3010`)
- FIREBASE_CERT_PATH (default `./service-account-file.json`)
- UPLOADS_DIR (default `./uploads`)
- SAMPLES_DIR (default `./samples`)

Tests also read dedicated files at `test/.env.default` and `test/.env`. `test/.env.default` sets a test-only uploads directory:

```ini
# test/.env.default
UPLOADS_DIR='./test/uploads'
```

## Development

In addition to the steps in [Quick start](#quick-start) and [Sample data (optional)](#sample-data-optional), you can run the following commands during development.

### TypeScript type-checking

```bash
npm run type-check
```

### Code quality

Linting (fix or check only):

```bash
# Report all linting issues and fix all auto-fixable ones
npm run lint

# Check only
npm run lint:check
```

Formatting (write or check only):

```bash
# Report all formatting issues and fix all auto-fixable ones
npm run format

# Check only
npm run format:check
```

### Tests

```bash
# One-off start
npm run test

# Watch for changes
npm run test:watch
```

Notes:

- Tests use `test/.env.default` to set `UPLOADS_DIR` to `./test/uploads`.
- Run the data initialization steps before tests if they rely on sample data.

## Logs

- Server & HTTP logs: `logs/combined.log`, `logs/error.log`
- Database query logs: `logs/database.log`
- Test logs: `logs/test/`

## Project structure

- `src/` Server code (Express, Mongoose, etc.)
- `openapi/` OpenAPI spec and paths
- `scripts/` Setup and data-generation scripts (run with tsx)
- `samples/` Dev and test sample data
- `uploads/` Files for quizzes/reviews, etc.
- `test/` Endpoint tests (Vitest + Supertest)
- `logs/` Server/DB logs

## Firebase service account

For security, keep the `firebase-admin` credential only on your machine. Download it per the
[official guide](https://firebase.google.com/docs/admin/setup?hl=zh-tw#initialize_the_sdk_in_non-google_environments)
and place it at `./service-account-file.json`, or point `FIREBASE_CERT_PATH` to your file.

## Troubleshooting

- Cannot connect to MongoDB: ensure MongoDB is running locally or adjust `MONGODB_URI`.
- Firebase init fails: verify `FIREBASE_CERT_PATH` points to a valid service account file.
- Swagger UI not reachable: ensure the server is running and `PORT` is free.
