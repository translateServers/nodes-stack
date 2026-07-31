import { defineConfig } from 'vitest/config';
import { screenEditorRuntimePlugin } from './runtime-plugin';

export default defineConfig({
  plugins: [screenEditorRuntimePlugin('test')],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
});
