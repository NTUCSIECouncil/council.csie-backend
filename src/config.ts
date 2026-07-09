import path from 'path';

import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'production')
  dotenv.config({ path: ['.env', '.env.default'], quiet: true });

const EnvSchema = z.object({
  GOOGLE_APPLICATION_CREDENTIALS: z.string(),
  MONGODB_URI: z.string(),
  MONGODB_DB_NAME: z.string(),
  PORT: z.string(),
  UPLOADS_DIR: z.string(),
  LOGS_DIR: z.string(),
  FRONTEND_URL: z.url(),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    `Environment variables validation failed:\n${z.prettifyError(parsed.error)}`,
  );
  console.error('Exiting...');
  process.exit(1);
}

parsed.data.UPLOADS_DIR = path.resolve(parsed.data.UPLOADS_DIR);

const env = parsed.data;

export { env };
