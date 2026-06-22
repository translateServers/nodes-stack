import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @nebula/nestjs-server dev',
      url: 'http://localhost:3000/api/v1/ping',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../../',
      env: {
        DATABASE_PROVIDER: 'sqlite',
        DATABASE_URL: 'file:./test-e2e.db',
        REDIS_LAZY_CONNECT: 'true',
        JWT_SECRET: 'e2e-test-jwt-secret-minimum-32-chars-long',
        JWT_REFRESH_SECRET: 'e2e-test-refresh-secret-minimum-32-chars',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
        API_PREFIX: 'api/v1',
        CORS_ORIGIN: '*',
        ENABLE_SWAGGER: 'false',
        NODE_ENV: 'test',
      },
    },
    {
      command: 'pnpm --filter @nebula/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../../',
    },
  ],
});
