import fs from 'fs/promises';
import path from 'path';

import dotenv from 'dotenv';

export async function setup() {
  dotenv.config({
    path: ['.env.default', '.env', 'test/.env.default'],
    override: true,
  });

  if (!process.env.UPLOADS_DIR) {
    throw new Error('Missing environment variable: UPLOADS_DIR');
  }
  process.env.ORIGINAL_UPLOADS_DIR = process.env.UPLOADS_DIR;

  const uploadsDir = path.resolve(process.env.UPLOADS_DIR);
  await fs.rm(uploadsDir, { recursive: true, force: true });
  await fs.mkdir(uploadsDir, { recursive: true });
}

export async function teardown() {
  if (!process.env.ORIGINAL_UPLOADS_DIR) {
    throw new Error('Missing environment variable: ORIGINAL_UPLOADS_DIR');
  }
  const originalUploadsDir = path.resolve(process.env.ORIGINAL_UPLOADS_DIR);
  await fs.rm(originalUploadsDir, { recursive: true, force: true });
}
