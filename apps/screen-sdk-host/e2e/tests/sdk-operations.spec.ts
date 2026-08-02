import { expect, test } from '@playwright/test';
import {
  createTransfer,
  forceConflict,
  getDraft,
  getOperationLog,
  waitForEditor,
  waitForOperation,
} from '../helpers/host.helper';

test.describe('Full in-memory adapter workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?scenario=single');
    await waitForEditor(page);
  });

  test('saves, publishes, and preserves conflict UI semantics', async ({ page }) => {
    const editor = await waitForEditor(page);
    const hostCommands = page.getByLabel('宿主命令');

    await hostCommands.getByRole('button', { name: '保存', exact: true }).click();
    await waitForOperation(page, 'save', 'project-a');
    await expect(page.getByRole('status')).toContainText('保存成功');

    await hostCommands.getByRole('button', { name: '发布', exact: true }).click();
    await waitForOperation(page, 'publish', 'project-a');
    await expect(page.getByRole('status')).toContainText('发布成功');

    await forceConflict(page, 'save');
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await expect(editor.getByRole('alertdialog')).toContainText('保存冲突');
    await editor.getByRole('button', { name: '继续编辑' }).click();

    const saveEntries = (await getOperationLog(page)).filter((entry) => entry.operation === 'save');
    expect(saveEntries).toHaveLength(2);
  });

  test('imports a transfer and exports the canonical JSON file', async ({ page }) => {
    const editor = await waitForEditor(page);
    const transfer = await createTransfer(page);
    transfer.name = '导入后的运营看板';

    await editor.getByRole('button', { name: '文件' }).click();
    await editor.getByText('导入 JSON...').click();
    await editor.locator('input[type="file"]').setInputFiles({
      name: 'screen-transfer.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(transfer)),
    });
    await expect(editor.getByText('导入后的运营看板')).toBeVisible();
    await editor.getByRole('button', { name: '确认导入' }).click();
    await waitForOperation(page, 'import', 'project-a');
    await expect.poll(async () => (await getDraft(page))?.name).toBe('导入后的运营看板');

    await editor.getByRole('button', { name: '文件' }).click();
    const downloadPromise = page.waitForEvent('download');
    await editor.getByText('导出 JSON').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('导入后的运营看板.json');
    await waitForOperation(page, 'export', 'project-a');
  });

  test('creates, restores, removes, and clears snapshots', async ({ page }) => {
    const editor = await waitForEditor(page);

    await editor.getByRole('button', { name: '文件' }).click();
    await editor.getByText('快照管理...').click();
    await waitForOperation(page, 'snapshot-list', 'project-a');
    await editor.getByRole('button', { name: '创建快照' }).click();
    await waitForOperation(page, 'snapshot-create', 'project-a');
    await expect(editor.getByText(/6 个组件/)).toBeVisible();

    await editor.getByRole('button', { name: '恢复快照' }).click();
    await editor.getByRole('button', { name: '确认恢复' }).click();
    await waitForOperation(page, 'snapshot-restore', 'project-a');
    await editor
      .getByRole('dialog', { name: '快照管理' })
      .getByRole('button', { name: 'Close' })
      .click();

    await editor.getByRole('button', { name: '文件' }).click();
    await editor.getByText('快照管理...').click();
    await editor.getByRole('button', { name: '删除快照' }).click();
    await waitForOperation(page, 'snapshot-remove', 'project-a');
    await expect(editor.getByText('暂无快照')).toBeVisible();

    await editor.getByRole('button', { name: '创建快照' }).click();
    await expect(editor.getByText(/6 个组件/)).toBeVisible();
    await editor.getByRole('button', { name: '清空全部' }).click();
    await editor.getByRole('button', { name: '确认清空' }).click();
    await waitForOperation(page, 'snapshot-clear', 'project-a');
    await expect(editor.getByText('暂无快照')).toBeVisible();
  });
});
