/**
 * 任务 11.3：图片工具浏览器闭环 E2E
 *
 * 覆盖：
 * - 图片工具点击 → 选择文件 → 创建图片组件 → 验证资源可持久化（data URL）
 * - 用户取消文件选择 → 不创建组件
 * - 创建后保存 → 重新加载 → 资源仍可用
 * - 项目数据不含本地绝对路径（file://）或临时 blob: URL
 *
 * 定位策略（遵循 baseline-before.md §13）：
 * - 画布表面：data-testid="canvas-surface"
 * - 组件容器：[data-component-id]
 * - 工具按钮：getByRole('button', { name: toolName }) + aria-pressed
 * - 文件选择器：page.waitForEvent('filechooser') + fileChooser.setInputFiles()
 */

import { test, expect } from '../fixtures/auth.fixture';
import { createScreenProject, deleteScreenProject } from '../helpers/screen-api.helper';

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

/** 在状态栏断言选中信息 */
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

/** 读取 store 中组件数量 */
async function readComponentCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __screenEditorStore?: {
          getState: () => { project: { components: unknown[] } | null };
        };
      }
    ).__screenEditorStore;
    return store?.getState().project?.components.length ?? 0;
  });
}

/** 读取 store 中最新创建的图片组件 */
async function readImageComponent(page: import('@playwright/test').Page): Promise<{
  id: string;
  type: string;
  src: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  height: number;
} | null> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __screenEditorStore?: {
          getState: () => {
            project: {
              components: Array<{
                id: string;
                type: string;
                props: Record<string, unknown>;
                position: { x: number; y: number; width: number; height: number };
                zIndex: number;
              }> | null;
            } | null;
          };
        };
      }
    ).__screenEditorStore;
    const comps = store?.getState().project?.components ?? [];
    if (comps.length === 0) return null;
    const latest = comps.reduce((a, b) => (a.zIndex > b.zIndex ? a : b));
    const props = latest.props as { src?: unknown; alt?: unknown };
    return {
      id: latest.id,
      type: latest.type,
      src: typeof props.src === 'string' ? props.src : '',
      alt: typeof props.alt === 'string' ? props.alt : '',
      x: latest.position.x,
      y: latest.position.y,
      width: latest.position.width,
      height: latest.position.height,
    };
  });
}

/**
 * 生成一个 2x2 红色 PNG 文件的 Buffer。
 *
 * 使用最小有效 PNG，避免依赖外部测试资源文件。
 * base64 解码后为完整 PNG 二进制（含 IHDR + IDAT + IEND）。
 */
function createTestPngBuffer(): Buffer {
  // 2x2 红色不透明 PNG
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8DwHwAFBQIA' +
    'X8jx0gAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}

test.describe('任务 11.3：图片工具浏览器闭环', () => {
  test('图片工具点击 → 选择文件 → 创建组件 → 保存 → 重新加载 → 资源可用', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-image-tool-${Date.now()}` });

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 初始无组件
      const initialCount = await readComponentCount(adminPage);
      expect(initialCount).toBe(0);

      // 2. 切换到图片工具
      const imageToolButton = adminPage.getByRole('button', { name: '图片' });
      await imageToolButton.click();
      await expect(imageToolButton).toHaveAttribute('aria-pressed', 'true');

      // 3. 在画布上点击触发文件选择器
      //    同时监听 filechooser 事件以提供测试文件
      const canvas = adminPage.getByTestId('canvas-surface');
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      const clickX = canvasBox!.x + 100;
      const clickY = canvasBox!.y + 100;

      // 同时执行点击和文件选择器处理
      const fileChooserPromise = adminPage.waitForEvent('filechooser', { timeout: 5000 });
      await adminPage.mouse.move(clickX, clickY);
      await adminPage.mouse.click(clickX, clickY);
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles({
        name: 'test-red.png',
        mimeType: 'image/png',
        buffer: createTestPngBuffer(),
      });

      // 4. 验证组件已创建
      await adminPage.waitForFunction(
        () => {
          const store = (
            window as unknown as {
              __screenEditorStore?: {
                getState: () => { project: { components: unknown[] } | null };
              };
            }
          ).__screenEditorStore;
          return (store?.getState().project?.components.length ?? 0) === 1;
        },
        {},
        { timeout: 5000 },
      );

      // 5. 验证新组件的类型、资源字段
      const comp = await readImageComponent(adminPage);
      expect(comp).not.toBeNull();
      expect(comp!.type).toBe('image');
      // src 应为 data URL（可持久化），不得为 file:// 或 blob:
      expect(comp!.src).toMatch(/^data:image\/png;base64,/);
      expect(comp!.src).not.toMatch(/^file:\/\//);
      expect(comp!.src).not.toMatch(/^blob:/);
      // alt 应为文件名
      expect(comp!.alt).toBe('test-red.png');
      // 坐标应为点击位置（画布坐标系，容差 5px）
      expect(comp!.x).toBeCloseTo(100, -1);
      expect(comp!.y).toBeCloseTo(100, -1);

      // 6. 验证新组件已选中
      await expectSelectionText(adminPage, /已选中 1 个|图片/, 5000);

      // 7. 验证组件在画布上可见
      const imageElement = adminPage.locator(`[data-component-id="${comp!.id}"]`);
      await expect(imageElement).toBeVisible();

      // 8. 保存项目（捕获 PATCH 请求）
      const saveResponse = adminPage.waitForResponse(
        (res) => res.url().includes(`/screen/${project.id}`) && res.request().method() === 'PATCH',
        { timeout: 10000 },
      );
      await adminPage.getByRole('button', { name: '保存' }).click();
      await saveResponse;
      await adminPage.waitForLoadState('networkidle');

      // 9. 重新加载页面，验证资源仍可用
      await adminPage.reload();
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(project.name)).toBeVisible();
      await expect(adminPage.getByTestId('canvas-surface')).toBeVisible();

      // 10. 验证重新加载后组件仍存在且 src 为 data URL
      const reloadedComp = await readImageComponent(adminPage);
      expect(reloadedComp).not.toBeNull();
      expect(reloadedComp!.type).toBe('image');
      expect(reloadedComp!.src).toMatch(/^data:image\/png;base64,/);
      expect(reloadedComp!.src).not.toMatch(/^file:\/\//);
      expect(reloadedComp!.src).not.toMatch(/^blob:/);
      expect(reloadedComp!.alt).toBe('test-red.png');

      // 11. 验证组件在画布上可见
      const reloadedElement = adminPage.locator(`[data-component-id="${reloadedComp!.id}"]`);
      await expect(reloadedElement).toBeVisible();
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });

  test('取消文件选择不创建组件', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-image-cancel-${Date.now()}` });

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 初始无组件
      const initialCount = await readComponentCount(adminPage);
      expect(initialCount).toBe(0);

      // 2. 切换到图片工具
      await adminPage.getByRole('button', { name: '图片' }).click();

      // 3. 点击画布触发文件选择器，但不提供文件（模拟取消）
      const canvas = adminPage.getByTestId('canvas-surface');
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      const clickX = canvasBox!.x + 100;
      const clickY = canvasBox!.y + 100;

      const fileChooserPromise = adminPage.waitForEvent('filechooser', { timeout: 5000 });
      await adminPage.mouse.move(clickX, clickY);
      await adminPage.mouse.click(clickX, clickY);
      const fileChooser = await fileChooserPromise;
      // 不调用 setFiles，模拟用户取消（关闭文件选择器）
      // FileChooser 无 cancel() 方法，未设置文件即视为取消
      void fileChooser;

      // 4. 等待一段时间，确保异步流程完成（focus 事件 + 300ms 延迟检测）
      await adminPage.waitForTimeout(800);

      // 5. 验证未创建组件
      const countAfterCancel = await readComponentCount(adminPage);
      expect(countAfterCancel).toBe(0);

      // 6. 验证未选中任何组件
      await expectSelectionText(adminPage, '未选中');

      // 7. 验证交互状态已恢复（可再次点击画布切换工具）
      await adminPage.getByRole('button', { name: '选择' }).click();
      await expect(adminPage.getByRole('button', { name: '选择' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });
});
