import { randomUUID } from 'node:crypto';
import { test as base, type Page } from '@playwright/test';
import { register, type AuthTokens } from '../helpers/api-client';
import {
  clearWorkerAuthTokens,
  setWorkerAuthTokens,
  type E2eAuthRole,
  type WorkerAuthTokens,
} from '../helpers/auth-state';
import { UsersPage } from '../pages/users.page';
import { RolesPage } from '../pages/roles.page';

async function registerWorkerUser(role: E2eAuthRole, parallelIndex: number): Promise<AuthTokens> {
  const suffix = `${parallelIndex}-${randomUUID().slice(0, 8)}`;
  return register({
    email: `e2e-${role}-${suffix}@test.local`,
    username: `e2e_${role}_${suffix}`,
    password: 'Test@12345',
    name: `E2E ${role}`,
  });
}

async function createAuthenticatedPage(page: Page, tokens: AuthTokens): Promise<Page> {
  // 先导航到应用以建立 localStorage 的 origin 上下文
  await page.goto('/');
  // 注入 Zustand 持久化格式的认证状态到 localStorage
  await page.evaluate((authTokens) => {
    const zustandState = {
      state: {
        accessToken: authTokens.accessToken,
        refreshToken: authTokens.refreshToken,
      },
      version: 0,
    };
    localStorage.setItem('nebula-auth', JSON.stringify(zustandState));
  }, tokens);

  // 重新加载页面，使 Zustand rehydrate 并让 TanStack Router guard 识别 token
  await page.reload();
  await page.waitForLoadState('networkidle');

  return page;
}

export interface AuthFixtures {
  adminPage: Page;
  viewerPage: Page;
  usersPage: UsersPage;
  rolesPage: RolesPage;
}

interface WorkerFixtures {
  workerAuthTokens: WorkerAuthTokens;
}

export const test = base.extend<AuthFixtures, WorkerFixtures>({
  workerAuthTokens: [
    async (_fixtures, use, workerInfo) => {
      const tokens: WorkerAuthTokens = {
        admin: await registerWorkerUser('admin', workerInfo.parallelIndex),
        viewer: await registerWorkerUser('viewer', workerInfo.parallelIndex),
      };
      setWorkerAuthTokens(tokens);
      try {
        await use(tokens);
      } finally {
        clearWorkerAuthTokens();
      }
    },
    { scope: 'worker', auto: true },
  ],

  adminPage: async ({ browser, workerAuthTokens }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await createAuthenticatedPage(page, workerAuthTokens.admin);
    await use(page);
    await context.close();
  },

  viewerPage: async ({ browser, workerAuthTokens }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await createAuthenticatedPage(page, workerAuthTokens.viewer);
    await use(page);
    await context.close();
  },

  usersPage: async ({ adminPage }, use) => {
    const page = new UsersPage(adminPage);
    await page.goto();
    await use(page);
  },

  rolesPage: async ({ adminPage }, use) => {
    const page = new RolesPage(adminPage);
    await page.goto();
    await use(page);
  },
});

export { expect } from '@playwright/test';
