import path from 'path';

import { z } from 'zod';

import logger from '@utils/logger.ts';

const EnvSchema = z.object({
  FIREBASE_CERT_PATH: z.string(),
  MONGODB_URI: z.string(),
  MONGODB_DB_NAME: z.string(),
  PORT: z.string(),
  UPLOADS_DIR: z.string(),
  SAMPLES_DIR: z.string(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error(
    'Environment variables validation failed:',
    z.prettifyError(parsed.error),
  );
  logger.error('Exiting...');
  process.exit(1);
}

parsed.data.UPLOADS_DIR = path.resolve(parsed.data.UPLOADS_DIR);

const env = parsed.data;

export { env };
