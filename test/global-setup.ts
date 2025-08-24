import fs from 'fs/promises';
import path from 'path';

import dotenv from 'dotenv';

let originalUploadsDir: string | undefined;

export async function setup() {
  dotenv.config({
    path: ['test/.env', 'test/.env.default', '.env', '.env.default'],
    quiet: true,
  });

  if (!process.env.UPLOADS_DIR) {
    throw new Error('Missing environment variable: UPLOADS_DIR');
  }
  originalUploadsDir = path.resolve(process.env.UPLOADS_DIR);

  const uploadsDir = path.resolve(process.env.UPLOADS_DIR);
  await fs.rm(uploadsDir, { recursive: true, force: true });
  await fs.mkdir(uploadsDir, { recursive: true });
}

export async function teardown() {
  if (!originalUploadsDir) {
    throw new Error('Missing environment variable: ORIGINAL_UPLOADS_DIR');
  }
  await fs.rm(originalUploadsDir, { recursive: true, force: true });
}
