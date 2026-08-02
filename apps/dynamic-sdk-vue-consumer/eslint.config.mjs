// @ts-check
import browserConfig from '@nebula/eslint-config/react';

export default [
  ...browserConfig,
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**/*',
      'e2e/playwright-report/**/*',
      'e2e/test-results/**/*',
      'playwright-report/**/*',
      'test-results/**/*',
    ],
  },
];
