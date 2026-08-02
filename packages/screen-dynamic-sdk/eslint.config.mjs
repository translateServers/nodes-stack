// @ts-check
import browserConfig from '@nebula/eslint-config/react';

export default [
  ...browserConfig,
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**/*',
      'scripts/**/*.mjs',
      'test-results/**/*',
      'playwright-report/**/*',
    ],
  },
];
