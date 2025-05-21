import { z } from 'zod';
import logger from '@utils/logger.ts';

const EnvSchema = z.object({
  FIREBASE_CERT_PATH: z.string(),
  MONGODB_URL: z.string(),
  MONGODB_DB_NAME: z.string(),
  PORT: z.string(),
  QUIZ_FILE_DIR: z.string(),
  ARTICLE_FILE_DIR: z.string(),
  PWD: z.string(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error('Environment variables validation failed:');
  logger.error(parsed.error);
  logger.error('Exiting...');
  process.exit(1);
}

const env = parsed.data;

export { env };
