// @ts-check
import nestjsConfig from '@nebula/eslint-config/nestjs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...nestjsConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    ignores: ['eslint.config.mjs', 'jest.config.js', 'dist/**/*', 'coverage/**/*'],
  },
];
