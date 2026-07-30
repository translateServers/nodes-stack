// @ts-check
import reactConfig from '@nebula/eslint-config/react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...reactConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    ignores: ['eslint.config.mjs', 'dist/**/*', 'coverage/**/*'],
  },
];
