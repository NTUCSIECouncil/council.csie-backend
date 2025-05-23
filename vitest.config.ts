import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { loadEnv } from 'vite';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ['./test/setup-file.ts'],
  },
});
