import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { screenEditorRuntimePlugin } from '../../packages/screen-sdk/runtime-plugin';

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    screenEditorRuntimePlugin('build'),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve SDK from source in dev environment to avoid duplicate React
      // instances (SDK dist bundles React for external consumers).
      '@nebula/screen-sdk/contracts': path.resolve(
        __dirname,
        '../../packages/screen-sdk/src/contracts/index.ts',
      ),
      '@nebula/screen-sdk': path.resolve(__dirname, '../../packages/screen-sdk/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
