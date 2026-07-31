import { fileURLToPath } from 'node:url';
import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';

function fromHere(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.json',
      exclude: ['src/**/*.test.*', 'test/**'],
      bundleTypes: {
        bundledPackages: ['@nebula/shared'],
      },
    }),
  ],
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
      external: [
        'class-variance-authority',
        'clsx',
        'lucide-react',
        'radix-ui',
        'react',
        'react/jsx-runtime',
        'tailwind-merge',
      ],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
