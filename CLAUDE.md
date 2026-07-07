# CLAUDE.md

Guidance for AI agents working in this repository. For human-oriented setup (installing
Node/pnpm/MongoDB, Firebase credentials, generating sample data), see `README.md` — this file
covers architecture and conventions rather than repeating it.

## Project

Backend REST API for the NTU CSIE Student Council website — a course-review platform where
authenticated users post reviews ("articles") and quiz files about courses. Stack: Express 5 +
TypeScript (ESM) + MongoDB via Mongoose 8 + Firebase Admin for auth, Zod for validation, and an
OpenAPI spec served through Swagger UI.

## Commands

```bash
pnpm run dev          # run the server via tsx (no build step)
pnpm run dev:watch    # restart on changes to src/ and openapi/
pnpm run build        # bundle to dist/ with tsdown; `pnpm start` runs dist/index.js
pnpm run type-check   # tsc --noEmit
pnpm run lint         # eslint --fix; lint:check = report only
pnpm run format       # prettier --write; format:check = check only
pnpm run test         # vitest run; test:watch to watch
```

Before committing or opening a PR, all four CI gates must pass:
`pnpm run lint:check`, `pnpm run format:check`, `pnpm run type-check`, `pnpm run test`.
A Husky pre-commit hook runs `lint-staged` (prettier + eslint on staged files).

`pnpm test` needs sample data on disk. Run `pnpm run fetch-courses` then `pnpm run generate-samples`
at least once before testing (details in README).

## Runtime & tooling gotchas

- **ESM with explicit `.ts` extensions.** Every relative/alias import MUST include the `.ts`
  suffix, e.g. `import logger from '@utils/logger.ts'`. This is intentional
  (`allowImportingTsExtensions`, executed by `tsx`); omitting the extension breaks type-check.
- **Path aliases** (from `tsconfig.json` `paths`): `@/*` → `src/*`, plus `@models/*`, `@routers/*`,
  `@utils/*`, `@type/*` → `src/types/*`, `@scripts/*`. Prefer aliases over deep relative paths.
- Imports are auto-ordered by the prettier import-sort plugin — don't hand-order; run `pnpm format`.
- pnpm is the only allowed package manager (`only-allow pnpm`); Node version is pinned in `.nvmrc`.

## Architecture

Entry `src/index.ts` uses top-level `await`: it initializes Firebase Admin (and `process.exit(1)`
if that fails), wires global Express middleware, mounts the API, serves Swagger UI at `/api-docs`,
connects Mongoose, and listens.

Request flow:

1. **Global middleware** (`src/index.ts`): CORS (credentials on, origin = `FRONTEND_URL`),
   `express.json` (10 MB limit), cookie-parser, morgan → winston, rate limit (100 req/min/IP), then
   an auth middleware that verifies a Firebase ID token from an `Authorization: Bearer <token>`
   header **or** a `token` cookie. When valid it sets `req.guser` (Firebase `UserRecord`),
   `req.rawToken`, and `req.userId` (our Mongo user `_id`). Auth here is optional — a missing or
   invalid token simply leaves these `undefined`; handlers enforce auth themselves.
2. **`src/routers/API-controller.ts`** mounts one router per resource under
   `/api/{articles,courses,quizzes,tags,users}` and ends with a catch-all 500 error handler.
3. **Controllers** `src/routers/*-controller.ts` hold the route handlers.
4. **Models** `src/models/*-schema.ts` hold persistence + domain logic.

Layering is routers (HTTP + validation) → Mongoose models (persistence + domain logic as schema
statics). There is no separate service layer.

## Data & model conventions

- Each `*-schema.ts` exports three things for its resource: a Zod schema `Z<Name>Schema`, a TS type
  (`interface Name extends z.infer<typeof Z...Schema> {}`), and the Mongoose `<Name>Model`. **Zod is
  the source of truth** for shape/validation; the Mongoose `Schema` mirrors it. Register new models
  in `src/models/index.ts`.
- **IDs are string UUIDs**, not Mongo ObjectIds: `_id: { type: String, default: randomUUID }`.
  Foreign keys are UUID strings declared with `ref`.
- Domain/query logic lives as Mongoose schema **statics** (e.g. `ArticleModel.searchArticles`);
  fuzzy search uses Fuse.js.
- Large/free-form content (article markdown, quiz files) is stored **on disk** under
  `UPLOADS_DIR/<resource>/<id>.<ext>`, not in Mongo. Mongo holds metadata only.

## Controller conventions (match the existing handlers)

- Validate every input with Zod inside a `try/catch` — `req.params`, `req.query`, `req.body`. On a
  parse failure respond `res.status(400).json({ message: '...' })`.
- Auth: `if (!req.userId)` → `401`. Ownership mismatch (e.g. `doc.creator !== req.userId`) → `403`.
  Missing document → `404`.
- Error responses are always `{ message: string }`. Successful mutations typically
  `res.sendStatus(204)`; creation returns `201` with the new id.
- Pagination: use the `paginationParser` middleware (`src/routers/middleware.ts`), which sets
  `req.limit` / `req.offset` (defaults 10 / 0). `requireCsie` restricts a route to
  `@csie.ntu.edu.tw` emails (403 otherwise).
- Embedding related data: handlers read an `?embed=course,creator,content` query param and
  conditionally `.populate()` refs or attach on-disk file content.
- Log with the winston `logger` from `@utils/logger.ts`, not `console`. (`index.ts` still has a
  couple of legacy `console.log`s — don't add more.) Mongoose query logging goes through the
  separate `dbLogger` (`@utils/db-logger.ts`).

## Keeping the OpenAPI spec in sync

The spec in `openapi/` (root `openapi.yaml`, split into `paths/*.yaml` and `components/schemas.yaml`)
is dereferenced and **validated at boot** — an invalid spec crashes startup. When you add or change
an endpoint, request, or response shape, update the matching `openapi/paths/*.yaml` and
`components/schemas.yaml`.

## Testing

- Vitest. Each worker starts an in-memory MongoDB via `mongodb-memory-server`
  (`test/setup-file.ts`) and copies sample files into a per-worker `UPLOADS_DIR`.
- Tests run against `test/app.ts`, a slimmed Express app whose **mock auth reads a `gid` request
  header** instead of a real Firebase token: send `gid: <googleId>` to act as that user (it's looked
  up to `req.userId`). Drive it with supertest.
- Test env is loaded from `test/.env` + `test/.env.default` (then root `.env*`); `UPLOADS_DIR` is
  redirected to `./test/uploads` and wiped before/after each run.
- Shared response-shape assertions live in `test/response-schemas.ts`.

## Config / environment

`src/config.ts` validates env with Zod and is the source of truth. Required vars:
`MONGODB_URI`, `MONGODB_DB_NAME`, `PORT`, `GOOGLE_APPLICATION_CREDENTIALS`, `UPLOADS_DIR`,
`LOGS_DIR`, `FRONTEND_URL`. Defaults live in `.env.default`; override locally in `.env` (dotenv is
only loaded when `NODE_ENV !== 'production'`). Firebase auth uses `applicationDefault()`, which reads
the service-account path from `GOOGLE_APPLICATION_CREDENTIALS`.

> In production (`NODE_ENV=production`, as in the Dockerfile) dotenv is **not** loaded — there is no
> `.env` fallback, so every required var must be present in the real environment, and
> `GOOGLE_APPLICATION_CREDENTIALS` must point at a service-account file available in the container.

## Adding a new resource (recipe)

1. `src/models/<name>-schema.ts`: Zod schema + TS type + Mongoose model (UUID `_id`); register it in
   `src/models/index.ts`.
2. `src/routers/<name>-controller.ts`: an Express `Router` whose handlers follow the
   validation/auth/response conventions above.
3. Mount the router in `src/routers/API-controller.ts`.
4. Add `openapi/paths/<name>.yaml` (+ schemas in `components/`) and reference it from
   `openapi/openapi.yaml`.
5. Add `test/<name>.test.ts`.

## Repo etiquette

- `main` is protected — open PRs against `main`. CI (`.github/workflows/pipeline.yaml`) runs
  lint + format + type-check + test on pushes/PRs to `main`, then builds and pushes a Docker image.
- Linear history with squash merges. Commit messages and PR titles follow
  [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, …).
