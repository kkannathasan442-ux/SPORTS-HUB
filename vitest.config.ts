import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/security/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'packages/**/*.{test,spec}.{ts,tsx}',
    ],
  },
  resolve: {
    alias: {
      '@sportshub/types': path.resolve(__dirname, 'packages/types/src'),
      '@sportshub/config': path.resolve(__dirname, 'packages/config/src'),
      '@sportshub/validation': path.resolve(__dirname, 'packages/validation/src'),
      '@sportshub/api': path.resolve(__dirname, 'packages/api/src'),
      '@sportshub/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@': path.resolve(__dirname, 'apps/web/src'),
    },
  },
});
