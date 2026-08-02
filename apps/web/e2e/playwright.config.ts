import { defineConfig, devices } from '@playwright/test';

const E2E_API_ORIGIN = 'http://localhost:3001';
const E2E_API_BASE_URL = `${E2E_API_ORIGIN}/api/v1`;
const E2E_WEB_ORIGIN = 'http://localhost:5174';

// Helpers run in Playwright worker processes, so publish the dedicated API origin before workers spawn.
process.env.API_BASE_URL = E2E_API_BASE_URL;

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
    baseURL: E2E_WEB_ORIGIN,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'pnpm --filter @nebula/nestjs-server exec prisma db push --force-reset && pnpm --filter @nebula/nestjs-server dev',
      url: `${E2E_API_BASE_URL}/ping`,
      reuseExistingServer: false,
      timeout: 120_000,
      cwd: '../../',
      env: {
        DATABASE_PROVIDER: 'sqlite',
        DATABASE_URL: 'file:./test-e2e.db',
        PORT: '3001',
        REDIS_LAZY_CONNECT: 'true',
        JWT_SECRET: 'e2e-test-jwt-secret-minimum-32-chars-long',
        JWT_REFRESH_SECRET: 'e2e-test-refresh-secret-minimum-32-chars',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
        API_PREFIX: 'api/v1',
        CORS_ORIGIN: '*',
        ENABLE_SWAGGER: 'false',
        NODE_ENV: 'test',
        E2E_TEST_MODE: 'true',
      },
    },
    {
      command: 'pnpm --filter @nebula/web exec vite --port 5174',
      url: E2E_WEB_ORIGIN,
      reuseExistingServer: false,
      timeout: 120_000,
      cwd: '../../',
      env: {
        VITE_API_PROXY_TARGET: E2E_API_ORIGIN,
      },
    },
  ],
});
