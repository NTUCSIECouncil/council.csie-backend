import path from 'path';

import dotenv from 'dotenv';
import { z } from 'zod';

import logger from '@utils/logger.ts';

dotenv.config({ path: ['.env', '.env.default'], quiet: true });

const EnvSchema = z.object({
  GOOGLE_APPLICATION_CREDENTIALS: z.string(),
  MONGODB_URI: z.string(),
  MONGODB_DB_NAME: z.string(),
  PORT: z.string(),
  UPLOADS_DIR: z.string(),
  SAMPLES_DIR: z.string(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error(
    `Environment variables validation failed:\n${z.prettifyError(parsed.error)}`,
  );
  logger.error('Exiting...');
  process.exit(1);
}

parsed.data.UPLOADS_DIR = path.resolve(parsed.data.UPLOADS_DIR);

const env = parsed.data;

export { env };
