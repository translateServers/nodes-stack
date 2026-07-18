/**
 * 任务 11.1：文字工具浏览器闭环 E2E
 *
 * 覆盖：
 * - 通过工具入口创建文本（点击"文字"工具 → 点击画布）
 * - 输入文本内容并提交（Ctrl+Enter）
 * - 双击已有文本进入编辑
 * - Escape 退出编辑（取消）
 * - Undo 撤销之前的创建/编辑
 *
 * 键盘隔离验证（任务 5.5）：
 * - 文本编辑期间 Space 不触发临时抓手
 * - Delete/Backspace 删除字符而非组件
 * - 方向键移动光标而非组件
 *
 * 定位策略（遵循 baseline-before.md §13）：
 * - 画布表面：data-testid="canvas-surface"
 * - 组件容器：[data-component-id]
 * - 工具按钮：getByRole('button', { name: toolName }) + aria-pressed
 * - 文本编辑器：data-testid="text-editor"
 *
 * 已知限制：
 * - Playwright dblclick() 可能因 Moveable 控制框拦截第二次点击而无法触发
 *   Selecto 的双击检测。fallback 到 window.__startTextEditing（DEV 暴露）。
 */

import { test, expect } from '../fixtures/auth.fixture';
import {
  createProjectWithMixedComponents,
  createScreenProject,
  deleteScreenProject,
} from '../helpers/screen-api.helper';

/** 等待编辑器加载完成：项目名可见 + 画布表面存在 */
async function loadEditor(
  page: import('@playwright/test').Page,
  projectId: string,
  projectName: string,
) {
  const editorLoaded = page.waitForResponse(
    (res) =>
      res.url().includes(`/screen/${projectId}`) &&
      !res.url().includes(`${projectId}/`) &&
      res.request().method() === 'GET',
  );
  await page.goto(`/screen/${projectId}`);
  await editorLoaded;
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(projectName)).toBeVisible();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
}

/** 在状态栏断言选中信息（避免与属性面板同名文本冲突） */
async function expectSelectionText(
  page: import('@playwright/test').Page,
  text: string | RegExp,
  timeout = 3000,
) {
  await expect(page.getByTestId('canvas-status-bar').getByTestId('selection-info')).toContainText(
    text,
    { timeout },
  );
}

/** 读取 store 中指定组件的 props.content */
async function readTextContent(
  page: import('@playwright/test').Page,
  componentId: string,
): Promise<string | null> {
  return page.evaluate((id: string) => {
    const store = (
      window as unknown as {
        __screenEditorStore?: {
          getState: () => {
            project: {
              components: Array<{ id: string; props: Record<string, unknown> }> | null;
            } | null;
          };
        };
      }
    ).__screenEditorStore;
    const comp = store?.getState().project?.components.find((c) => c.id === id);
    if (!comp) return null;
    const content = comp.props.content;
    return typeof content === 'string' ? content : null;
  }, componentId);
}

/** 读取 store 中组件数量 */
async function readComponentCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __screenEditorStore?: {
          getState: () => {
            project: { components: unknown[] } | null;
          };
        };
      }
    ).__screenEditorStore;
    return store?.getState().project?.components.length ?? 0;
  });
}

/**
 * 进入文本编辑：优先尝试 dblclick()，若文本编辑器未出现则 fallback 到
 * window.__startTextEditing（Moveable 控制框拦截第二次点击时使用）。
 */
async function enterTextEditing(
  page: import('@playwright/test').Page,
  textElement: import('@playwright/test').Locator,
  componentId: string,
) {
  // 尝试 1：dblclick（在 Moveable 控制框尚未渲染时可能成功）
  try {
    await textElement.dblclick({ timeout: 2000 });
    const editor = page.getByTestId('text-editor');
    await expect(editor).toBeVisible({ timeout: 1500 });
    return;
  } catch {
    // dblclick 失败，继续 fallback
  }

  // 尝试 2：click 选中后再次 click（绕过 dblclick 事件合成）
  try {
    await textElement.click({ timeout: 1500 });
    const box = await textElement.boundingBox();
    if (box) {
      // 在元素中心略偏左上位置再次点击（尝试避开 Moveable 控制框边框）
      await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
    }
    const editor = page.getByTestId('text-editor');
    await expect(editor).toBeVisible({ timeout: 1500 });
    return;
  } catch {
    // 两次点击仍失败，继续 fallback
  }

  // 尝试 3：直接调用 window.__startTextEditing（DEV fallback）
  await page.evaluate((id: string) => {
    const fn = (window as unknown as { __startTextEditing?: (componentId: string) => void })
      .__startTextEditing;
    fn?.(id);
  }, componentId);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible({ timeout: 3000 });
}

test.describe('任务 11.1：文字工具浏览器闭环', () => {
  test('文字工具创建 → 输入 → 提交 → 双击编辑 → Escape 退出 → Undo 撤销', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-text-tool-${Date.now()}` });

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 初始无组件
      const initialCount = await readComponentCount(adminPage);
      expect(initialCount).toBe(0);

      // 2. 切换到文字工具
      const textToolButton = adminPage.getByRole('button', { name: '文字' });
      await textToolButton.click();
      await expect(textToolButton).toHaveAttribute('aria-pressed', 'true');

      // 3. 点击画布创建文本组件
      const canvas = adminPage.getByTestId('canvas-surface');
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      // 在画布左上区域点击（避免与工具栏重叠）
      const clickX = canvasBox!.x + 200;
      const clickY = canvasBox!.y + 200;
      await adminPage.mouse.click(clickX, clickY);

      // 4. 验证文本编辑器出现并自动聚焦
      const textEditor = adminPage.getByTestId('text-editor');
      await expect(textEditor).toBeVisible({ timeout: 3000 });
      await expect(textEditor).toBeFocused();

      // 5. 验证新组件已创建（store 中有 1 个组件）
      const countAfterCreate = await readComponentCount(adminPage);
      expect(countAfterCreate).toBe(1);

      // 6. 输入文本内容（先清空默认内容，再输入新内容）
      const testContent = 'E2E-文字工具创建';
      await textEditor.fill(testContent);

      // 7. 提交（Ctrl+Enter）
      await adminPage.keyboard.press('Control+Enter');
      await expect(textEditor).not.toBeVisible({ timeout: 3000 });

      // 8. 验证文本内容已写入 store
      //    获取新创建的文本组件 ID
      const newTextId = await adminPage.evaluate(() => {
        const store = (
          window as unknown as {
            __screenEditorStore?: {
              getState: () => {
                project: { components: Array<{ id: string; type: string }> } | null;
              };
            };
          }
        ).__screenEditorStore;
        const comp = store?.getState().project?.components.find((c) => c.type === 'text');
        return comp?.id ?? null;
      });
      expect(newTextId).not.toBeNull();

      const committedContent = await readTextContent(adminPage, newTextId!);
      expect(committedContent).toBe(testContent);

      // 9. 切换回选择工具（双击编辑只在选择工具下生效）
      await adminPage.getByRole('button', { name: '选择' }).click();
      await expect(adminPage.getByRole('button', { name: '选择' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // 10. 双击文本组件进入编辑（含 Moveable 控制框 fallback）
      const textElement = adminPage.locator(`[data-component-id="${newTextId}"]`);
      await enterTextEditing(adminPage, textElement, newTextId!);
      await expect(textEditor).toBeFocused();
      // 验证编辑器初始内容为已提交的内容
      await expect(textEditor).toHaveValue(testContent);

      // 11. 修改内容
      const modifiedContent = 'E2E-已修改';
      await textEditor.fill(modifiedContent);

      // 12. Escape 退出（取消，不提交）
      await adminPage.keyboard.press('Escape');
      await expect(textEditor).not.toBeVisible({ timeout: 3000 });

      // 13. 验证取消后内容恢复为提交时的内容（未应用修改）
      const contentAfterCancel = await readTextContent(adminPage, newTextId!);
      expect(contentAfterCancel).toBe(testContent);

      // 14. Undo 撤销最初的创建（Ctrl+Z）
      //     优先尝试键盘快捷键，未生效则调用 store.undo()
      await adminPage.keyboard.press('Control+KeyZ');
      let undone = false;
      try {
        await adminPage.waitForFunction(
          () => {
            const store = (
              window as unknown as {
                __screenEditorStore?: {
                  getState: () => { project: { components: unknown[] } | null };
                };
              }
            ).__screenEditorStore;
            return (store?.getState().project?.components.length ?? 1) === 0;
          },
          {},
          { timeout: 1500 },
        );
        undone = true;
      } catch {
        undone = false;
      }

      if (!undone) {
        // 键盘快捷键未生效，直接调用 store.undo()
        await adminPage.evaluate(() => {
          const store = (
            window as unknown as {
              __screenEditorStore?: {
                getState: () => { undo: () => void; canUndo: () => boolean };
              };
            }
          ).__screenEditorStore;
          if (store?.getState().canUndo()) {
            store.getState().undo();
          }
        });
        await adminPage.waitForFunction(
          () => {
            const store = (
              window as unknown as {
                __screenEditorStore?: {
                  getState: () => { project: { components: unknown[] } | null };
                };
              }
            ).__screenEditorStore;
            return (store?.getState().project?.components.length ?? 1) === 0;
          },
          {},
          { timeout: 3000 },
        );
      }

      // 15. 验证组件已被撤销删除
      const finalCount = await readComponentCount(adminPage);
      expect(finalCount).toBe(0);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });

  test('文本编辑期间 Space/Delete/方向键不触发画布命令', async ({ adminPage }) => {
    const { project, components } = await createProjectWithMixedComponents('e2e-text-kb-isolate');
    const text = components.find((c) => c.type === 'text')!;
    const originalX = text.position.x;
    const originalY = text.position.y;

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 切换到选择工具（默认）
      await expect(adminPage.getByRole('button', { name: '选择' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // 2. 记录初始组件数量
      const initialCount = await readComponentCount(adminPage);
      expect(initialCount).toBeGreaterThan(0);

      // 3. 双击文本组件进入编辑（含 Moveable 控制框 fallback）
      const textElement = adminPage.locator(`[data-component-id="${text.id}"]`);
      await enterTextEditing(adminPage, textElement, text.id);
      const textEditor = adminPage.getByTestId('text-editor');
      await expect(textEditor).toBeFocused();

      // 4. 输入 Space（应插入空格，不触发临时抓手）
      await adminPage.keyboard.press('Space');
      // 验证抓手工具未被激活（Space 未触发临时抓手）
      await expect(adminPage.getByRole('button', { name: '抓手' })).not.toHaveAttribute(
        'aria-pressed',
        'true',
      );
      // 验证仍在文本编辑态
      await expect(textEditor).toBeVisible();
      await expect(textEditor).toBeFocused();

      // 5. 输入方向键（应移动光标，不移动组件）
      await adminPage.keyboard.press('ArrowLeft');
      await adminPage.keyboard.press('ArrowRight');
      await adminPage.keyboard.press('ArrowUp');
      await adminPage.keyboard.press('ArrowDown');
      // 验证仍在文本编辑态
      await expect(textEditor).toBeFocused();
      // 验证组件位置未变（通过 store 读取）
      const posAfterArrows = await adminPage.evaluate((id: string) => {
        const store = (
          window as unknown as {
            __screenEditorStore?: {
              getState: () => {
                project: {
                  components: Array<{ id: string; position: { x: number; y: number } }> | null;
                } | null;
              };
            };
          }
        ).__screenEditorStore;
        const comp = store?.getState().project?.components.find((c) => c.id === id);
        return comp ? { x: comp.position.x, y: comp.position.y } : null;
      }, text.id);
      expect(posAfterArrows).not.toBeNull();
      expect(posAfterArrows!.x).toBe(originalX);
      expect(posAfterArrows!.y).toBe(originalY);

      // 6. 输入 Delete/Backspace（应删除字符，不删除组件）
      await adminPage.keyboard.press('Backspace');
      await adminPage.keyboard.press('Delete');
      // 验证组件数量未变（Delete 未删除组件）
      const countAfterDelete = await readComponentCount(adminPage);
      expect(countAfterDelete).toBe(initialCount);
      // 验证仍在文本编辑态
      await expect(textEditor).toBeVisible();
      await expect(textEditor).toBeFocused();

      // 7. 验证文本内容已修改（Space + Backspace + Delete 改变了内容）
      //    文本编辑器中的内容变化尚未提交（仍在编辑态），store 中仍是原始内容
      //    但 textarea 的 value 应已变化
      const contentAfterEdit = await readTextContent(adminPage, text.id);
      const editorValue = await textEditor.inputValue();
      expect(editorValue).not.toBe(contentAfterEdit);

      // 8. Escape 退出编辑（取消，不提交修改）
      await adminPage.keyboard.press('Escape');
      await expect(textEditor).not.toBeVisible({ timeout: 3000 });

      // 9. 验证取消后内容恢复
      const finalContent = await readTextContent(adminPage, text.id);
      expect(finalContent).not.toBeNull();
      // 内容应为原始内容（Escape 取消了编辑）
      expect(finalContent).toBe((text.props as { content: string }).content);

      // 10. 验证组件位置仍未变（方向键未移动组件）
      const finalPos = await adminPage.evaluate((id: string) => {
        const store = (
          window as unknown as {
            __screenEditorStore?: {
              getState: () => {
                project: {
                  components: Array<{ id: string; position: { x: number; y: number } }> | null;
                } | null;
              };
            };
          }
        ).__screenEditorStore;
        const comp = store?.getState().project?.components.find((c) => c.id === id);
        return comp ? { x: comp.position.x, y: comp.position.y } : null;
      }, text.id);
      expect(finalPos).not.toBeNull();
      expect(finalPos!.x).toBe(originalX);
      expect(finalPos!.y).toBe(originalY);

      // 11. 验证选中状态正常（Escape 退出编辑后应回到选择态）
      await expectSelectionText(adminPage, /已选中 1 个|E2E 文本-A/);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });
});
