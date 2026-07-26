import { defineConfig, devices } from '@playwright/test';

/**
 * 画布拖拽 FPS 基准测试专用 Playwright 配置。
 *
 * 与默认 playwright.config.ts 的区别：
 * - 只启动 web server（不启动 nestjs，benchmark 页面是静态的，无后端依赖）
 * - 测试文件目录：e2e/benchmark 下所有 .spec.ts
 * - 输出独立报告到 benchmark-report/
 *
 * 运行命令：
 *   pnpm --filter @nebula/web exec playwright test --config=e2e/playwright.benchmark.config.ts
 *   pnpm --filter @nebula/web exec playwright test --config=e2e/playwright.benchmark.config.ts --headed
 */
export default defineConfig({
  testDir: './benchmark',
  fullyParallel: false, // 串行执行避免并发拖拽干扰 FPS 测量
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // 单 worker 避免 CPU 抢占影响 FPS
  reporter: [
    ['html', { open: 'never', outputFolder: 'benchmark-report' }],
    ['list'],
    ['json', { outputFile: 'benchmark-results/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
    // 不强制 headless：本地可加 --headed 看真实拖拽
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @nebula/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../../',
    },
  ],
});
