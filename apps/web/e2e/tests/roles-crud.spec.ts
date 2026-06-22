import { test, expect } from '../fixtures/auth.fixture';

test.describe.configure({ mode: 'serial' });

const ts = Date.now();
const testRoleName = `e2e_role_${ts}`;

test.describe('角色管理 CRUD', () => {
  test('创建角色', async ({ rolesPage }) => {
    await rolesPage.waitForTableLoaded();

    await rolesPage.openCreateDialog();
    await rolesPage.fillCreateForm({
      name: testRoleName,
      description: 'E2E 测试角色',
    });
    await rolesPage.submitForm();

    await rolesPage.assertRoleExists(testRoleName);
  });

  test('编辑角色', async ({ rolesPage }) => {
    await rolesPage.waitForTableLoaded();

    await rolesPage.editRole(testRoleName, {
      description: '已更新的描述',
    });
    await rolesPage.assertRoleExists(testRoleName);
  });

  test('搜索角色', async ({ rolesPage }) => {
    await rolesPage.waitForTableLoaded();

    await rolesPage.searchFor(testRoleName);
    const rowCount = await rolesPage.getRowCount();
    expect(rowCount).toBe(1);

    await rolesPage.clearSearch();
  });

  test('删除角色', async ({ rolesPage }) => {
    await rolesPage.waitForTableLoaded();

    await rolesPage.clickDelete(testRoleName);
    await rolesPage.confirmDelete();

    await rolesPage.assertRoleNotExists(testRoleName);
  });
});
