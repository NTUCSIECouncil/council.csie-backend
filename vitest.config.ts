import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    setupFiles: './test/setup-file.ts',
    globalSetup: './test/global-setup.ts',
    coverage: { include: ['src/**/*.{ts,tsx}'], reporter: ['text'] },
  },
});
