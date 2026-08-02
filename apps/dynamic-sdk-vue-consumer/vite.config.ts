import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('nebula-') || tag.startsWith('xj-'),
        },
      },
    }),
  ],
  resolve: {
    // SDK 通过 peer 依赖消费 react/react-dom：强制单一实例避免 CJS require 问题
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'chrome120',
  },
  server: {
    port: 5175,
    strictPort: true,
  },
});
