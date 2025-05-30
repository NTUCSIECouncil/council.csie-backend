import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ['./test/setup-file.ts'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text']
    }
  },
});
