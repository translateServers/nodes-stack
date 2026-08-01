import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';

function fromHere(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.json',
      exclude: ['src/**/*.test.*', 'test/**'],
      bundleTypes: {
        bundledPackages: ['@nebula/screen-editor-core', '@nebula/shared'],
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: '@nebula/screen-sdk/contracts',
        replacement: resolve(import.meta.dirname, './src/contracts/index.ts'),
      },
      {
        find: '@nebula/screen-sdk',
        replacement: resolve(import.meta.dirname, './src/index.ts'),
      },
    ],
  },
  build: {
    target: 'chrome120',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: {
        index: fromHere('./src/index.ts'),
        'auto-register': fromHere('./src/auto-register.ts'),
        'contracts/index': fromHere('./src/contracts/index.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      // spec 13: React、ReactDOM、Zustand、Radix、Moveable、Selecto 等实现依赖
      // 打入 SDK，避免宿主 React 版本冲突。@nebula/shared 类型由 dts bundle,
      // 运行时由 Vite 内联；consumer 仅为公开 Zod schema 的声明类型安装 zod。
      external: [],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
