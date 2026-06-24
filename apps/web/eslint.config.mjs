// @ts-check
import reactConfig from '@nebula/eslint-config/react';

export default [
  ...reactConfig,
  {
    ignores: [
      'eslint.config.mjs',
      'src/routeTree.gen.ts',
      'e2e/playwright-report/**/*',
      'e2e/test-results/**/*',
      'playwright-report/**/*',
      'test-results/**/*',
    ],
  },
];
