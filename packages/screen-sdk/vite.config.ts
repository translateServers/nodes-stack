import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';

function fromHere(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function isReactRuntimeExternal(id: string): boolean {
  return (
    id === 'react' || id.startsWith('react/') || id === 'react-dom' || id.startsWith('react-dom/')
  );
}

const DEFAULT_ENTRIES: Record<string, string> = {
  index: fromHere('./src/index.ts'),
  'auto-register': fromHere('./src/auto-register.ts'),
  'components/index': fromHere('./src/components/index.ts'),
  'contracts/index': fromHere('./src/contracts/index.ts'),
};
const REACT_ENTRY: Record<string, string> = { react: fromHere('./src/react.ts') };

export default defineConfig(({ mode }) => {
  const isReactRuntimeBuild = mode === 'react-runtime';

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isReactRuntimeBuild
        ? []
        : [
            dts({
              entryRoot: 'src',
              tsconfigPath: './tsconfig.json',
              exclude: ['src/**/*.test.*', 'test/**'],
              bundleTypes: {
                bundledPackages: [
                  '@nebula/screen-component-sdk',
                  '@nebula/screen-editor-core',
                  '@nebula/shared',
                ],
              },
            }),
          ]),
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
      emptyOutDir: !isReactRuntimeBuild,
      lib: {
        entry: isReactRuntimeBuild ? REACT_ENTRY : DEFAULT_ENTRIES,
        formats: ['es'],
        fileName: (_format, entryName) => `${entryName}.js`,
      },
      rollupOptions: {
        // The default entry is self-contained. The React entry is opt-in and
        // resolves React and ReactDOM from the host application's peer dependencies.
        external: isReactRuntimeBuild ? isReactRuntimeExternal : [],
        output: {
          chunkFileNames: isReactRuntimeBuild
            ? 'react/chunks/[name]-[hash].js'
            : 'chunks/[name]-[hash].js',
          assetFileNames: isReactRuntimeBuild
            ? 'react/assets/[name]-[hash][extname]'
            : 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
