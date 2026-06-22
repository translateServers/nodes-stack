import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, type Page } from '@playwright/test';
import { type AuthTokens, refreshToken, isTokenExpiringSoon } from '../helpers/api-client';
import { UsersPage } from '../pages/users.page';
import { RolesPage } from '../pages/roles.page';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

function loadTokens(role: 'admin' | 'viewer'): AuthTokens {
  const filePath = path.join(TEST_DATA_DIR, `${role}-auth.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as AuthTokens;
}

function saveTokens(role: 'admin' | 'viewer', tokens: AuthTokens): void {
  const filePath = path.join(TEST_DATA_DIR, `${role}-auth.json`);
  fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf-8');
}

async function ensureValidTokens(role: 'admin' | 'viewer'): Promise<AuthTokens> {
  const tokens = loadTokens(role);
  if (isTokenExpiringSoon(tokens.accessToken, 60)) {
    const refreshed = await refreshToken(tokens.refreshToken);
    saveTokens(role, refreshed);
    return refreshed;
  }
  return tokens;
}

async function createAuthenticatedPage(page: Page, role: 'admin' | 'viewer'): Promise<Page> {
  const tokens = await ensureValidTokens(role);

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

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await createAuthenticatedPage(page, 'admin');
    await use(page);
    await context.close();
  },

  viewerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await createAuthenticatedPage(page, 'viewer');
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
