# council.csie backend

Backend service for the NTU CSIE Student Council website.

## Prerequisites

- Node.js (see [Manage Node.js version](#manage-nodejs-version) below)
- pnpm (see [Setup pnpm](#setup-pnpm) below)
- MongoDB 8.x running locally (see [official documentation](https://www.mongodb.com/docs/manual/installation/))
- Firebase service account JSON credentials (see [Firebase service account](#firebase-service-account) below)

### Manage Node.js version

This project requires Node.js with the version specified in `.nvmrc`. We recommend using a Node.js version manager for easy switching between projects:

- **fnm** (preferred for speed): Install and enable `--use-on-cd` to automatically switch to the correct version when entering the project directory.
- **nvm**: Install and run `nvm use` when entering the project directory.

Both tools automatically detect and use the Node.js version specified in `.nvmrc`.

### Setup pnpm

This project uses pnpm as the package manager. The recommended way to install pnpm is using corepack (included with Node.js):

```bash
corepack enable

# In project directory - automatic installation will be triggered
pnpm install
```

Corepack automatically detects and updates pnpm every time `pnpm` is run.

Alternatively, you can install pnpm directly with `npm install -g pnpm` or other methods, but you'll be responsible for ensuring the correct version is used.

## Getting started

### Install dependencies

```bash
pnpm install --frozen-lockfile
```

### Configuration (environment variables)

Runtime loads both `.env.default` and `.env`, with `.env` overriding defaults. The environment variables and their defaults are:

```ini
# .env.default
MONGODB_URI='mongodb://127.0.0.1:27017' # MongoDB connection URI
MONGODB_DB_NAME='csie-council-dev' # Database name
PORT='3010' # Server port
FIREBASE_CERT_PATH='./service-account-file.json' # Firebase service account key file path
UPLOADS_DIR='./uploads' # Directory for uploaded files
SAMPLES_DIR='./samples' # Directory for sample data files
```

Tests also read dedicated files at `test/.env.default` and `test/.env`. `test/.env.default` sets a test-only uploads directory:

```ini
# test/.env.default
UPLOADS_DIR='./test/uploads' # Directory for uploaded files in tests
```

> [!IMPORTANT]
> `UPLOADS_DIR` used in tests will be cleaned up before and after each test run.

### Start the dev server

```bash
# One-off start
pnpm run dev

# Watch src/ and api-spec/ for changes
# Press Enter in the terminal to restart; Ctrl+C to stop
pnpm run dev:watch
```

## API docs

- Spec: `api-spec/`
- Swagger UI: `http://localhost:3010/api-docs` (or your `PORT` in `.env`)

## Sample data (optional)

Run in order if you want prefilled data locally:

```bash
pnpm run fetch-courses     # Fetch course data to samples/course-original.json
pnpm run generate-samples  # Generate sample data to samples/
pnpm run setup-dev-db      # Create dev DB and place files under uploads/
```

## Tests

```bash
# One-off start
pnpm run test

# Watch for changes
pnpm run test:watch
```

Notes:

- Tests use `test/.env.default` to set `UPLOADS_DIR` to `./test/uploads`.
- It's required to run at least the first two commands in [Sample data (optional)](#sample-data-optional).

## Code quality

Type checking:

```bash
pnpm run type-check
```

Linting (fix or check only):

```bash
# Report all linting issues and fix all auto-fixable ones
pnpm run lint

# Check only
pnpm run lint:check
```

Formatting (write or check only):

```bash
# Report all formatting issues and fix all auto-fixable ones
pnpm run format

# Check only
pnpm run format:check
```

Notes:

- There are Git precommit hooks checking linting and formatting.
- CI runs all checks on PRs to `main` and `develop`.

## Logs

- Server & HTTP logs: `logs/combined.log`, `logs/error.log`
- Database query logs: `logs/database.log`
- Test logs: `logs/test/`

## Firebase service account

For security, keep the `firebase-admin` credential only on your machine. Download it per the
[official guide](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments)
and place it at `./service-account-file.json`, or point `FIREBASE_CERT_PATH` to your file.

## Troubleshooting

- Cannot connect to MongoDB: ensure MongoDB is running locally or adjust `MONGODB_URI`.
- Firebase init fails: verify `FIREBASE_CERT_PATH` points to a valid service account file.
- Swagger UI not reachable: ensure the server is running and `PORT` is free.
- Downloading MongoDB and tests fail: run `pnpm rebuild` to ensure `mongodb-memory-server` is properly installed.

## Contribution

- `main` branch is protected. Please open a PR against `develop`.
- Linear history is required for PRs.
- Commit messages should follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- Squash commits are used to keep the history clean. Use same style as commit messages in title and description of PRs.
