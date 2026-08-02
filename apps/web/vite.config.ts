import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve SDK from source in dev environment to avoid duplicate React
      // instances (SDK dist bundles React for external consumers).
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
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
