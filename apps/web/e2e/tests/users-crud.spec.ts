import { test, expect } from '../fixtures/auth.fixture';

test.describe.configure({ mode: 'serial' });

const ts = Date.now();
const testUsername = `e2euser${ts}`;
const testEmail = `e2euser${ts}@test.local`;

test.describe('用户管理 CRUD', () => {
  test('创建用户', async ({ usersPage }) => {
    await usersPage.waitForTableLoaded();

    await usersPage.openCreateDialog();
    await usersPage.fillCreateForm({
      username: testUsername,
      email: testEmail,
      password: 'Test@12345',
      name: 'E2E 测试用户',
    });
    await usersPage.submitForm();

    // 表格有分页，使用搜索功能定位新创建的用户
    await usersPage.searchFor(testUsername);
    await usersPage.assertUserExists(testUsername);
  });

  test('搜索用户', async ({ usersPage }) => {
    await usersPage.waitForTableLoaded();

    await usersPage.searchFor(testUsername);
    const rowCount = await usersPage.getRowCount();
    expect(rowCount).toBe(1);
    await usersPage.assertUserExists(testUsername);

    await usersPage.clearSearch();
  });

  test('编辑用户', async ({ usersPage }) => {
    await usersPage.waitForTableLoaded();

    // 先搜索定位用户（分页场景）
    await usersPage.searchFor(testUsername);
    await usersPage.editUser(testUsername, { name: '已更新的名称' });
    await usersPage.assertUserExists(testUsername);
    await usersPage.clearSearch();
  });

  test('取消删除用户', async ({ usersPage }) => {
    await usersPage.waitForTableLoaded();

    await usersPage.searchFor(testUsername);
    await usersPage.clickDelete(testUsername);
    await usersPage.cancelDelete();

    await usersPage.assertUserExists(testUsername);
    await usersPage.clearSearch();
  });

  test('删除用户', async ({ usersPage }) => {
    await usersPage.waitForTableLoaded();

    await usersPage.searchFor(testUsername);
    await usersPage.clickDelete(testUsername);
    await usersPage.confirmDelete();

    await usersPage.assertUserNotExists(testUsername);
  });
});
