import { expect, test } from '@playwright/test';
import { getDraft, getEditor, getOperationLog, waitForEditor } from '../helpers/host.helper';

test.describe('Instance and host isolation', () => {
  test('routes save shortcuts only to the active editor', async ({ page }) => {
    await page.setViewportSize({ width: 2300, height: 1000 });
    await page.goto('/?scenario=dual');
    const editorA = await waitForEditor(page, 0);
    const editorB = await waitForEditor(page, 1);

    await editorB.getByTestId('canvas-surface').click({ position: { x: 40, y: 40 } });
    await page.keyboard.press('Control+KeyS');

    await expect
      .poll(async () => (await getOperationLog(page)).filter((entry) => entry.operation === 'save'))
      .toEqual([expect.objectContaining({ operation: 'save', projectId: 'project-b' })]);
    expect((await getDraft(page, 0))?.name).toBe('华东运营看板');
    expect((await getDraft(page, 1))?.name).toBe('华南运营看板');

    const portalIsolation = await Promise.all(
      [editorA, editorB].map((editor) =>
        editor.evaluate((element) => ({
          portalCount: element.shadowRoot?.querySelectorAll('[data-nebula-portal-root]').length,
          rootCount: element.shadowRoot?.querySelectorAll('[data-nebula-react-root]').length,
        })),
      ),
    );
    expect(portalIsolation).toEqual([
      { portalCount: 1, rootCount: 1 },
      { portalCount: 1, rootCount: 1 },
    ]);
  });

  test('keeps editor controls isolated from hostile host CSS', async ({ page }) => {
    await page.goto('/?scenario=hostile');
    const editor = await waitForEditor(page);
    const saveButton = editor.getByRole('button', { name: '保存', exact: true });

    const style = await saveButton.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        borderTopWidth: computed.borderTopWidth,
        fontSize: computed.fontSize,
        width: computed.width,
      };
    });
    expect(style.borderTopWidth).not.toBe('8px');
    expect(style.fontSize).not.toBe('32px');
    expect(style.width).not.toBe('3px');
  });

  test('shows the minimum-size warning from ResizeObserver', async ({ page }) => {
    await page.goto('/?scenario=small');
    const editor = getEditor(page);
    await expect(editor.locator('[data-nebula-size-warning]')).toBeVisible();
    await expect(editor.locator('[data-nebula-size-warning]')).toContainText('1024 × 640');
  });
});
