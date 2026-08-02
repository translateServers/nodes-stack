import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * 全打包变体（供 XJ 等无法访问私有 registry 的宿主）。
 *
 * 仅外部化 react / react-dom / react/jsx-runtime（宿主必须提供）；
 * @nebula/* 全部打进单文件，宿主零内部依赖即可使用。
 * 产出：dist-bundle/nebula-screen.mjs
 */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/bundle-entry.ts'),
      formats: ['es'],
      fileName: () => 'nebula-screen.mjs',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
    },
    sourcemap: true,
    outDir: 'dist-bundle',
  },
});
