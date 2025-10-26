import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@c4c/core': resolve(__dirname, './packages/core/dist/index.js'),
      '@c4c/workflow': resolve(__dirname, './packages/workflow/dist/index.js'),
      '@c4c/adapters': resolve(__dirname, './packages/adapters/src/index.ts'),
      '@c4c/policies': resolve(__dirname, './packages/policies/src/index.ts'),
    },
  },
});
