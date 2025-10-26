import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@c4c/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@c4c/workflow': resolve(__dirname, '../../packages/workflow/src/index.ts'),
    },
  },
});
