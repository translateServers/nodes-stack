import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'auto-register': resolve(__dirname, 'src/auto-register.ts'),
        'contracts/index': resolve(__dirname, 'src/contracts/index.ts'),
        'testing/index': resolve(__dirname, 'src/testing/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@nebula/screen-component-sdk',
        '@nebula/screen-component-sdk/dynamic',
        '@nebula/screen-editor-core',
        '@nebula/screen-editor-core/dynamic',
        '@nebula/screen-editor-core/experimental',
        '@nebula/shared',
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    sourcemap: true,
  },
});
