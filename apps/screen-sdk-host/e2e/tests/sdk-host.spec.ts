import { expect, test } from '@playwright/test';
import { getEditor, waitForEditor, waitForOperation } from '../helpers/host.helper';

test.describe('Vanilla SDK host', () => {
  test('@release auto-registers and renders all six static components without React in the host', async ({
    page,
  }) => {
    await page.goto('/?scenario=single');
    const editor = await waitForEditor(page);

    await expect(page.getByRole('status')).toHaveText('参考宿主已就绪');
    await expect(editor.getByText('华东运营看板')).toBeVisible();
    await expect(editor.getByTestId('canvas-surface').locator('[data-component-id]')).toHaveCount(
      6,
    );

    const registration = await page.evaluate(() => ({
      defined: customElements.get('nebula-screen-editor') !== undefined,
      hasShadowRoot: document.querySelector('nebula-screen-editor')?.shadowRoot !== null,
    }));
    expect(registration).toEqual({ defined: true, hasShadowRoot: true });

    const fontFamily = await editor
      .locator('[data-nebula-sdk-root]')
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(fontFamily).toContain('Geist Variable');
  });

  test('dispatches preview requests to the Vanilla host', async ({ page }) => {
    await page.goto('/?scenario=single');
    const editor = await waitForEditor(page);

    await editor.getByRole('button', { name: '预览' }).click();

    await expect(page.getByRole('status')).toHaveText('project-a 预览请求');
    await expect(page.locator('#event-log')).toContainText('nebula-preview-request');
  });

  test('disconnects and remounts the same custom element cleanly', async ({ page }) => {
    await page.goto('/?scenario=single');
    await waitForEditor(page);
    await waitForOperation(page, 'load', 'project-a');

    await page.getByRole('button', { name: '重新挂载' }).click();
    await expect(getEditor(page).getByTestId('canvas-surface')).toBeVisible();

    await expect
      .poll(async () => {
        return page.evaluate(
          () =>
            (
              window as unknown as {
                __screenSdkHost: { getOperationLog(): Array<{ operation: string }> };
              }
            ).__screenSdkHost
              .getOperationLog()
              .filter((entry) => entry.operation === 'load').length,
        );
      })
      .toBe(2);
  });
});
