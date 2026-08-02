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
      // 注：更具体的子路径别名必须排在裸 '@nebula/screen-sdk' 之前，
      // 否则 Vite resolve 会先匹配到主入口（Spec §14.1 / Task 6.4）。
      '@nebula/screen-sdk/components': path.resolve(
        __dirname,
        '../../packages/screen-sdk/src/components/index.ts',
      ),
      '@nebula/screen-sdk/contracts': path.resolve(
        __dirname,
        '../../packages/screen-sdk/src/contracts/index.ts',
      ),
      '@nebula/screen-sdk': path.resolve(__dirname, '../../packages/screen-sdk/src/index.ts'),
    },
  },
});
