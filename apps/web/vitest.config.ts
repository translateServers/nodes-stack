import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve SDK from source in test environment to avoid duplicate React
      // instances (SDK dist bundles React for external consumers).
      '@nebula/screen-sdk/contracts': path.resolve(
        __dirname,
        '../../packages/screen-sdk/src/contracts/index.ts',
      ),
      '@nebula/screen-sdk': path.resolve(__dirname, '../../packages/screen-sdk/src/index.ts'),
    },
  },
});
