/**
 * 任务 11.4：缩放工具浏览器闭环 E2E
 *
 * 覆盖：
 * - 缩放工具点击放大（scale 增加，锚点保持）
 * - Alt+点击反向缩小（scale 减少）
 * - 上下限边界（MAX_SCALE=5, MIN_SCALE=0.1）
 * - 锚点保持：缩放后光标对应的画布坐标不变
 * - 缩放工具不选择或复制组件
 *
 * 定位策略（遵循 baseline-before.md §13）：
 * - 画布表面：data-testid="canvas-surface"
 * - 工具按钮：getByRole('button', { name: toolName }) + aria-pressed
 * - 缩放显示：状态栏缩放按钮（百分比文本）
 */

import { test, expect } from '../fixtures/auth.fixture';
import {
  createProjectWithMixedComponents,
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

/** 读取 store 中 canvasScale 和 canvasOffset */
async function readViewport(page: import('@playwright/test').Page): Promise<{
  scale: number;
  offsetX: number;
  offsetY: number;
}> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __screenEditorStore?: {
          getState: () => {
            canvasScale: number;
            canvasOffset: { x: number; y: number };
          };
        };
      }
    ).__screenEditorStore;
    const s = store?.getState();
    return {
      scale: s?.canvasScale ?? 1,
      offsetX: s?.canvasOffset.x ?? 0,
      offsetY: s?.canvasOffset.y ?? 0,
    };
  });
}

/** 读取 store 中选中组件数量 */
async function readSelectedCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __screenEditorStore?: {
          getState: () => { selectedComponentIds: unknown[] };
        };
      }
    ).__screenEditorStore;
    return store?.getState().selectedComponentIds.length ?? 0;
  });
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

/**
 * 在画布指定位置点击（用于触发缩放工具点击）。
 *
 * @param page Playwright Page
 * @param canvas 画布 locator
 * @param x 画布内 x 偏移
 * @param y 画布内 y 偏移
 * @param alt 是否按住 Alt
 */
async function clickCanvas(
  page: import('@playwright/test').Page,
  canvas: import('@playwright/test').Locator,
  x: number,
  y: number,
  alt = false,
) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const screenX = box!.x + x;
  const screenY = box!.y + y;
  if (alt) {
    await page.keyboard.down('Alt');
  }
  await page.mouse.move(screenX, screenY);
  await page.mouse.click(screenX, screenY);
  if (alt) {
    await page.keyboard.up('Alt');
  }
}

test.describe('任务 11.4：缩放工具浏览器闭环', () => {
  test('缩放工具点击放大 → scale 增加 → Alt+点击反向缩小 → scale 恢复', async ({ adminPage }) => {
    const { project } = await createProjectWithMixedComponents('e2e-zoom-in-out');

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 切换到缩放工具
      const zoomToolButton = adminPage.getByRole('button', { name: '缩放' }).first();
      await zoomToolButton.click();
      // 注意：状态栏也有一个"缩放"按钮（显示百分比），需要选择工具栏中的那个
      // 工具栏按钮在 group "工具选择" 中
      const toolbarZoomButton = adminPage
        .getByRole('group', { name: '工具选择' })
        .getByRole('button', { name: '缩放' });
      await expect(toolbarZoomButton).toHaveAttribute('aria-pressed', 'true');

      // 2. 记录初始 viewport
      const initial = await readViewport(adminPage);
      expect(initial.scale).toBeGreaterThan(0);

      // 3. 点击画布放大
      const canvas = adminPage.getByTestId('canvas-surface');
      await clickCanvas(adminPage, canvas, 200, 150, false);

      // 4. 验证 scale 增加（factor=1.5）
      await adminPage.waitForTimeout(300);
      const afterZoomIn = await readViewport(adminPage);
      expect(afterZoomIn.scale).toBeGreaterThan(initial.scale);
      // 因子 1.5 容差
      expect(afterZoomIn.scale).toBeCloseTo(initial.scale * 1.5, 0);

      // 5. Alt+点击反向缩小
      await clickCanvas(adminPage, canvas, 200, 150, true);

      // 6. 验证 scale 恢复（factor=1/1.5）
      await adminPage.waitForTimeout(300);
      const afterZoomOut = await readViewport(adminPage);
      expect(afterZoomOut.scale).toBeLessThan(afterZoomIn.scale);
      // 反向缩小应回到接近初始 scale
      expect(afterZoomOut.scale).toBeCloseTo(initial.scale, 0);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });

  test('缩放工具上限：达到 MAX_SCALE=5 后继续点击无变化', async ({ adminPage }) => {
    const { project } = await createProjectWithMixedComponents('e2e-zoom-max');

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 切换到缩放工具
      const toolbarZoomButton = adminPage
        .getByRole('group', { name: '工具选择' })
        .getByRole('button', { name: '缩放' });
      await toolbarZoomButton.click();

      // 2. 反复点击放大直到达到上限
      const canvas = adminPage.getByTestId('canvas-surface');
      let currentScale = (await readViewport(adminPage)).scale;
      for (let i = 0; i < 15; i++) {
        await clickCanvas(adminPage, canvas, 200, 150, false);
        await adminPage.waitForTimeout(100);
        const newScale = (await readViewport(adminPage)).scale;
        if (Math.abs(newScale - currentScale) < 0.001) {
          // 已达到上限，无变化
          break;
        }
        currentScale = newScale;
      }

      // 3. 验证已达到上限 5
      expect(currentScale).toBeCloseTo(5, 0);

      // 4. 再次点击，验证无变化
      await clickCanvas(adminPage, canvas, 200, 150, false);
      await adminPage.waitForTimeout(200);
      const afterExtraClick = await readViewport(adminPage);
      expect(afterExtraClick.scale).toBeCloseTo(5, 0);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });

  test('缩放工具下限：达到 MIN_SCALE=0.1 后继续 Alt+点击无变化', async ({ adminPage }) => {
    const { project } = await createProjectWithMixedComponents('e2e-zoom-min');

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 切换到缩放工具
      const toolbarZoomButton = adminPage
        .getByRole('group', { name: '工具选择' })
        .getByRole('button', { name: '缩放' });
      await toolbarZoomButton.click();

      // 2. 反复 Alt+点击缩小直到达到下限
      const canvas = adminPage.getByTestId('canvas-surface');
      let currentScale = (await readViewport(adminPage)).scale;
      for (let i = 0; i < 30; i++) {
        await clickCanvas(adminPage, canvas, 200, 150, true);
        await adminPage.waitForTimeout(100);
        const newScale = (await readViewport(adminPage)).scale;
        if (Math.abs(newScale - currentScale) < 0.001) {
          // 已达到下限，无变化
          break;
        }
        currentScale = newScale;
      }

      // 3. 验证已达到下限 0.1
      expect(currentScale).toBeCloseTo(0.1, 1);

      // 4. 再次 Alt+点击，验证无变化
      await clickCanvas(adminPage, canvas, 200, 150, true);
      await adminPage.waitForTimeout(200);
      const afterExtraClick = await readViewport(adminPage);
      expect(afterExtraClick.scale).toBeCloseTo(0.1, 1);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });

  test('缩放工具不选择或复制组件', async ({ adminPage }) => {
    const { project, components } = await createProjectWithMixedComponents('e2e-zoom-noselect');

    try {
      await loadEditor(adminPage, project.id, project.name);
      const initialComponentCount = components.length;

      // 1. 切换到缩放工具
      const toolbarZoomButton = adminPage
        .getByRole('group', { name: '工具选择' })
        .getByRole('button', { name: '缩放' });
      await toolbarZoomButton.click();

      // 2. 在组件位置点击放大
      const canvas = adminPage.getByTestId('canvas-surface');
      // 在第一个组件附近点击
      await clickCanvas(adminPage, canvas, 100, 100, false);
      await adminPage.waitForTimeout(200);

      // 3. 验证未选中任何组件
      const selectedAfterZoom = await readSelectedCount(adminPage);
      expect(selectedAfterZoom).toBe(0);

      // 4. Alt+点击组件位置
      await clickCanvas(adminPage, canvas, 100, 100, true);
      await adminPage.waitForTimeout(200);

      // 5. 验证仍未选中任何组件
      const selectedAfterAltZoom = await readSelectedCount(adminPage);
      expect(selectedAfterAltZoom).toBe(0);

      // 6. 验证组件数量未增加（未触发 Alt+拖拽复制）
      const finalCount = await readComponentCount(adminPage);
      expect(finalCount).toBe(initialComponentCount);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });

  test('缩放工具锚点保持：光标对应的画布坐标在缩放前后不变', async ({ adminPage }) => {
    const { project } = await createProjectWithMixedComponents('e2e-zoom-anchor');

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 切换到缩放工具
      const toolbarZoomButton = adminPage
        .getByRole('group', { name: '工具选择' })
        .getByRole('button', { name: '缩放' });
      await toolbarZoomButton.click();

      // 2. 记录初始 viewport
      const initial = await readViewport(adminPage);

      // 3. 在画布上 (300, 200) 位置点击放大
      //    锚点保持：缩放前后，屏幕坐标 (300, 200) 对应的画布坐标应不变
      //    canvasX = (screenX - offsetX) / scale
      const canvas = adminPage.getByTestId('canvas-surface');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const anchorScreenX = box!.x + 300;
      const anchorScreenY = box!.y + 200;
      const canvasXBefore = (anchorScreenX - box!.x - initial.offsetX) / initial.scale;
      const canvasYBefore = (anchorScreenY - box!.y - initial.offsetY) / initial.scale;

      await clickCanvas(adminPage, canvas, 300, 200, false);
      await adminPage.waitForTimeout(300);

      // 4. 验证锚点保持
      const after = await readViewport(adminPage);
      const canvasXAfter = (anchorScreenX - box!.x - after.offsetX) / after.scale;
      const canvasYAfter = (anchorScreenY - box!.y - after.offsetY) / after.scale;

      // 容差 1px
      expect(Math.abs(canvasXAfter - canvasXBefore)).toBeLessThan(1);
      expect(Math.abs(canvasYAfter - canvasYBefore)).toBeLessThan(1);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });
});
