import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import APIController from '@routers/API-controller.ts';
import { env } from './config.ts';

interface AppDependencies {
  // Authentication middleware — verifies credentials and sets `req.userId`.
  auth: RequestHandler;
  // Request logger (e.g. morgan). Omitted in tests to keep output quiet.
  requestLogger?: RequestHandler;
}

// The application as a function of its dependencies. Production and tests both
// build the app through this factory so they exercise the same middleware chain
// and order; only the injected pieces differ (real Firebase auth vs. a mock,
// and the operational-only request logger). Rate limiting's cap is env-tuned.
export const createApp = ({
  auth,
  requestLogger,
}: AppDependencies): Express => {
  const app = express();

  app.set('query parser', 'extended');
  app.set('trust proxy', env.TRUST_PROXY);

  // Log every request (including 429s), then CORS and rate limiting before
  // parsing cookies/JSON so oversized bodies aren't parsed when rate-limited.
  if (requestLogger) app.use(requestLogger);
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));

  app.use(auth);
  app.use('/api', APIController);

  return app;
};
