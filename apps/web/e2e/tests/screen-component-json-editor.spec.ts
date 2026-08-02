import { expect, test } from '../fixtures/auth.fixture';
import {
  createScreenProject,
  createTextComponent,
  deleteScreenProject,
  updateScreenProject,
} from '../helpers/screen-api.helper';

declare global {
  interface Window {
    __screenEditorStore?: {
      getState: () => {
        project: {
          components: Array<{ id: string; name: string; props: Record<string, unknown> }>;
        } | null;
      };
    };
  }
}

async function loadEditor(
  page: import('@playwright/test').Page,
  projectId: string,
  projectName: string,
): Promise<void> {
  const editorLoaded = page.waitForResponse(
    (response) =>
      response.url().includes(`/screen/${projectId}`) &&
      !response.url().includes(`${projectId}/`) &&
      response.request().method() === 'GET',
  );
  await page.goto(`/screen/${projectId}`);
  await editorLoaded;
  await expect(page.getByText(projectName)).toBeVisible();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
}

async function readComponent(
  page: import('@playwright/test').Page,
  componentId: string,
): Promise<{ name: string; content: string | null } | null> {
  return page.evaluate((id: string) => {
    const store = window.__screenEditorStore;
    const component = store
      ?.getState()
      .project?.components.find((candidate) => candidate.id === id);
    if (component === undefined) return null;
    const content = component.props['content'];
    return {
      content: typeof content === 'string' ? content : null,
      name: component.name,
    };
  }, componentId);
}

test.describe('组件 JSON 编辑器', () => {
  test('单选组件后通过 Monaco 编辑并应用完整配置', async ({ adminPage }) => {
    const pageErrors: string[] = [];
    const monacoAssetRequests: string[] = [];
    adminPage.on('pageerror', (error) => pageErrors.push(error.message));
    adminPage.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });
    adminPage.on('request', (request) => {
      if (
        /(?:component-json-monaco-editor\.tsx|suggestController|jsonMode|(?:editor|json)\.worker)/u.test(
          request.url(),
        )
      ) {
        monacoAssetRequests.push(request.url());
      }
    });
    const project = await createScreenProject({ name: `e2e-component-json-${Date.now()}` });
    const component = createTextComponent({
      name: '原始标题',
      position: { height: 80, rotation: 0, width: 360, x: 100, y: 100 },
      props: { content: '原始内容' },
      style: { color: '#ffffff', fontSize: 24 },
    });
    const updatedProject = await updateScreenProject(project.id, {
      components: [component],
      expectedUpdatedAt: project.updatedAt,
    });

    try {
      await loadEditor(adminPage, updatedProject.id, updatedProject.name);
      expect(monacoAssetRequests).toEqual([]);
      await adminPage.locator(`[data-component-id="${component.id}"]`).click();
      await adminPage.getByRole('button', { name: '工具' }).click();
      await adminPage.getByRole('menuitem', { name: '组件 JSON...' }).click();

      const dialog = adminPage.getByTestId('component-json-editor-dialog');
      await expect(dialog).toBeVisible();
      await expect
        .poll(() =>
          dialog.evaluate((element) => {
            const computedStyle = window.getComputedStyle(element);
            return {
              animationDuration: computedStyle.animationDuration,
              animationName: computedStyle.animationName,
              transitionDuration: computedStyle.transitionDuration,
            };
          }),
        )
        .toEqual({ animationDuration: '0s', animationName: 'none', transitionDuration: '0s' });
      const dialogBox = await dialog.boundingBox();
      const viewport = adminPage.viewportSize();
      expect(dialogBox).not.toBeNull();
      expect(viewport).not.toBeNull();
      if (dialogBox === null || viewport === null)
        throw new Error('Expected dialog and viewport bounds');
      expect(dialogBox.x + dialogBox.width).toBeGreaterThan(viewport.width - 40);
      expect(dialogBox.y).toBeLessThan(100);
      await expect(adminPage.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
      const dragHandle = dialog.getByTestId('component-json-editor-dialog-drag-handle');
      const dragHandleBox = await dragHandle.boundingBox();
      expect(dragHandleBox).not.toBeNull();
      if (dragHandleBox === null) throw new Error('Expected drag handle bounds');
      await adminPage.mouse.move(dragHandleBox.x + 120, dragHandleBox.y + 16);
      await adminPage.mouse.down();
      await adminPage.mouse.move(dragHandleBox.x, dragHandleBox.y + 56, { steps: 6 });
      await adminPage.mouse.up();
      const movedDialogBox = await dialog.boundingBox();
      expect(movedDialogBox).not.toBeNull();
      if (movedDialogBox === null) throw new Error('Expected moved dialog bounds');
      expect(Math.abs(movedDialogBox.x - dialogBox.x)).toBeGreaterThan(16);
      expect(Math.abs(movedDialogBox.y - dialogBox.y)).toBeGreaterThan(16);
      const monacoEditor = dialog.locator('.monaco-editor');
      await expect(monacoEditor).toBeVisible({ timeout: 15_000 });
      expect(
        monacoAssetRequests.some((url) => url.includes('component-json-monaco-editor.tsx')),
      ).toBe(true);
      expect(
        monacoAssetRequests.every((url) => new URL(url).origin === new URL(adminPage.url()).origin),
      ).toBe(true);
      const input = monacoEditor.getByRole('textbox', { name: '组件 JSON：text' });
      await expect(input).toBeVisible();
      await input.focus();
      await input.press('Control+Home');
      await input.press('ArrowRight');
      await input.press('Enter');
      await input.pressSequentially('"');
      expect(pageErrors).toEqual([]);
      await input.press('Control+Space');
      await expect(adminPage.locator('.suggest-widget')).toBeVisible({ timeout: 10_000 });

      await dialog.getByRole('button', { name: '取消' }).click();
      const discardDialog = adminPage.getByRole('alertdialog', { name: '放弃 JSON 修改？' });
      await expect(discardDialog).toBeVisible();
      await discardDialog.getByRole('button', { name: '放弃修改' }).click();
      await expect(dialog).not.toBeVisible();

      await adminPage.getByRole('button', { name: '工具' }).click();
      await adminPage.getByRole('menuitem', { name: '组件 JSON...' }).click();
      await expect(dialog).toBeVisible();
      const cleanEditor = dialog.locator('.monaco-editor');
      await expect(cleanEditor).toBeVisible({ timeout: 15_000 });
      const cleanInput = cleanEditor.getByRole('textbox', { name: '组件 JSON：text' });
      await expect(cleanInput).toBeVisible();

      const nextConfig = JSON.stringify(
        {
          name: 'JSON 更新标题',
          position: component.position,
          props: { content: 'JSON 更新内容' },
          status: component.status,
          style: component.style,
          zIndex: component.zIndex,
        },
        null,
        2,
      );
      await adminPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await adminPage.evaluate((value: string) => navigator.clipboard.writeText(value), nextConfig);
      await cleanInput.focus();
      await cleanInput.press('Control+A');
      await cleanInput.press('Control+V');

      expect(await readComponent(adminPage, component.id)).toEqual({
        content: '原始内容',
        name: '原始标题',
      });

      await dialog.getByRole('button', { name: '应用' }).click();
      await expect(dialog).not.toBeVisible();
      await expect
        .poll(() => readComponent(adminPage, component.id))
        .toEqual({ content: 'JSON 更新内容', name: 'JSON 更新标题' });
    } finally {
      await deleteScreenProject(project.id).catch(() => undefined);
    }
  });
});
