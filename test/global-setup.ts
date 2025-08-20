import fs from 'fs/promises';
import path from 'path';

import dotenv from 'dotenv';

export async function setup() {
  dotenv.config({ path: ['test/.test.env', '.default.env', '.env'] });
  await fs.rm(path.join(import.meta.dirname, 'uploads'), { recursive: true, force: true });
  await fs.mkdir(path.join(import.meta.dirname, 'uploads'), { recursive: true });
}

export async function teardown() {
  await fs.rm(path.join(import.meta.dirname, 'uploads'), { recursive: true, force: true });
}
