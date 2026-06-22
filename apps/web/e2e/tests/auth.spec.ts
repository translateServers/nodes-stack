import { test, expect } from '../fixtures/auth.fixture';

test.describe('认证流程', () => {
  test('未认证用户访问受保护页面应重定向到登录页', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login/);
  });

  test('已认证用户可以访问仪表盘', async ({ adminPage }) => {
    await adminPage.goto('/');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('h1')).toBeVisible();
    await expect(adminPage).not.toHaveURL(/\/login/);
  });

  test('已认证用户可以访问用户管理页', async ({ adminPage }) => {
    await adminPage.goto('/users');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('h1')).toHaveText('用户管理');
  });

  test('已认证用户可以访问角色管理页', async ({ adminPage }) => {
    await adminPage.goto('/roles');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('h1')).toHaveText('角色管理');
  });
});
