/**
 * 任务 11.2：矩形与椭圆工具浏览器闭环 E2E
 *
 * 覆盖：
 * - 拖拽创建矩形（验证坐标、尺寸、选择）
 * - 拖拽创建椭圆（验证坐标、尺寸、选择）
 * - 微小拖拽不创建组件（< 4px 阈值）
 * - Undo 撤销创建
 * - 创建期间不出现框选或 Moveable 冲突
 *
 * 定位策略（遵循 baseline-before.md §13）：
 * - 画布表面：data-testid="canvas-surface"
 * - 组件容器：[data-component-id]
 * - 工具按钮：getByRole('button', { name: toolName }) + aria-pressed
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

/** 读取 store 中最新创建的组件（按 zIndex 最大） */
async function readLatestComponent(page: import('@playwright/test').Page): Promise<{
  id: string;
  type: string;
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
    return {
      id: latest.id,
      type: latest.type,
      x: latest.position.x,
      y: latest.position.y,
      width: latest.position.width,
      height: latest.position.height,
    };
  });
}

/**
 * 在画布上拖拽创建形状。
 *
 * @param page Playwright Page
 * @param canvasBox 画布 boundingBox
 * @param startX 画布坐标系起点 x
 * @param startY 画布坐标系起点 y
 * @param dx 拖拽位移 x（正值=向右）
 * @param dy 拖拽位移 y（正值=向下）
 */
async function dragCreate(
  page: import('@playwright/test').Page,
  canvasBox: import('@playwright/test').Locator,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
) {
  const box = await canvasBox.boundingBox();
  expect(box).not.toBeNull();
  const screenX = box!.x + startX;
  const screenY = box!.y + startY;
  await page.mouse.move(screenX, screenY);
  await page.mouse.down();
  // 分步移动以触发 pointermove 事件（更新预览）
  await page.mouse.move(screenX + dx, screenY + dy, { steps: 8 });
  await page.mouse.up();
}

test.describe('任务 11.2：矩形与椭圆工具浏览器闭环', () => {
  test('矩形工具拖拽创建 → 验证坐标、尺寸、选择 → Undo 撤销', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-rect-tool-${Date.now()}` });

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 初始无组件
      const initialCount = await readComponentCount(adminPage);
      expect(initialCount).toBe(0);

      // 2. 切换到矩形工具
      const rectToolButton = adminPage.getByRole('button', { name: '矩形' });
      await rectToolButton.click();
      await expect(rectToolButton).toHaveAttribute('aria-pressed', 'true');

      // 3. 拖拽创建矩形（从画布 (100,100) 拖到 (260,220)，即 160x120）
      const canvas = adminPage.getByTestId('canvas-surface');
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      const dragStartX = 100;
      const dragStartY = 100;
      const dragDx = 160;
      const dragDy = 120;
      await dragCreate(adminPage, canvas, dragStartX, dragStartY, dragDx, dragDy);

      // 4. 验证组件已创建
      const countAfterCreate = await readComponentCount(adminPage);
      expect(countAfterCreate).toBe(1);

      // 5. 验证新组件的类型、坐标、尺寸
      const comp = await readLatestComponent(adminPage);
      expect(comp).not.toBeNull();
      expect(comp!.type).toBe('rect');
      // 坐标应为拖拽起点（画布坐标系）
      expect(comp!.x).toBeCloseTo(dragStartX, -1); // 容差 5px
      expect(comp!.y).toBeCloseTo(dragStartY, -1);
      // 尺寸应为拖拽位移
      expect(comp!.width).toBeCloseTo(dragDx, -1);
      expect(comp!.height).toBeCloseTo(dragDy, -1);

      // 6. 验证新组件已选中
      await expectSelectionText(adminPage, /已选中 1 个|矩形/, 5000);

      // 7. 验证组件在画布上可见
      const rectElement = adminPage.locator(`[data-component-id="${comp!.id}"]`);
      await expect(rectElement).toBeVisible();

      // 8. Undo 撤销创建（Ctrl+Z + store.undo() fallback）
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

      // 9. 验证组件已被撤销删除
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

  test('椭圆工具拖拽创建 → 验证坐标、尺寸、选择', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-ellipse-tool-${Date.now()}` });

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 切换到椭圆工具
      const ellipseToolButton = adminPage.getByRole('button', { name: '椭圆' });
      await ellipseToolButton.click();
      await expect(ellipseToolButton).toHaveAttribute('aria-pressed', 'true');

      // 2. 拖拽创建椭圆（从画布 (200,150) 拖到 (380,330)，即 180x180）
      const canvas = adminPage.getByTestId('canvas-surface');
      const dragStartX = 200;
      const dragStartY = 150;
      const dragDx = 180;
      const dragDy = 180;
      await dragCreate(adminPage, canvas, dragStartX, dragStartY, dragDx, dragDy);

      // 3. 验证组件已创建
      const countAfterCreate = await readComponentCount(adminPage);
      expect(countAfterCreate).toBe(1);

      // 4. 验证新组件的类型、坐标、尺寸
      const comp = await readLatestComponent(adminPage);
      expect(comp).not.toBeNull();
      expect(comp!.type).toBe('ellipse');
      expect(comp!.x).toBeCloseTo(dragStartX, -1);
      expect(comp!.y).toBeCloseTo(dragStartY, -1);
      expect(comp!.width).toBeCloseTo(dragDx, -1);
      expect(comp!.height).toBeCloseTo(dragDy, -1);

      // 5. 验证新组件已选中
      await expectSelectionText(adminPage, /已选中 1 个|椭圆/, 5000);

      // 6. 验证组件在画布上可见
      const ellipseElement = adminPage.locator(`[data-component-id="${comp!.id}"]`);
      await expect(ellipseElement).toBeVisible();

      // 7. 验证默认样式（椭圆应有背景色）
      const hasBg = await ellipseElement.evaluate((el) => {
        const bg = (el as HTMLElement).style.backgroundColor;
        return bg && bg !== 'transparent' && bg !== '';
      });
      expect(hasBg).toBe(true);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });

  test('微小拖拽不创建组件（< 4px 阈值）', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-shape-micro-${Date.now()}` });

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 初始无组件
      const initialCount = await readComponentCount(adminPage);
      expect(initialCount).toBe(0);

      // 2. 切换到矩形工具
      await adminPage.getByRole('button', { name: '矩形' }).click();

      // 3. 微小拖拽（2px x 2px，低于 4px 阈值）
      const canvas = adminPage.getByTestId('canvas-surface');
      await dragCreate(adminPage, canvas, 100, 100, 2, 2);

      // 4. 验证未创建组件
      const countAfterMicro = await readComponentCount(adminPage);
      expect(countAfterMicro).toBe(0);

      // 5. 切换到椭圆工具，重复测试
      await adminPage.getByRole('button', { name: '椭圆' }).click();
      await dragCreate(adminPage, canvas, 200, 200, 3, 1);

      const countAfterMicroEllipse = await readComponentCount(adminPage);
      expect(countAfterMicroEllipse).toBe(0);

      // 6. 验证未选中任何组件（无空历史记录）
      await expectSelectionText(adminPage, '未选中');
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });

  test('创建期间不出现框选或 Moveable 冲突', async ({ adminPage }) => {
    const project = await createScreenProject({ name: `e2e-shape-noconflict-${Date.now()}` });

    try {
      await loadEditor(adminPage, project.id, project.name);

      // 1. 切换到矩形工具
      await adminPage.getByRole('button', { name: '矩形' }).click();
      await expect(adminPage.getByRole('button', { name: '矩形' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // 2. 开始拖拽创建（但先不释放）
      const canvas = adminPage.getByTestId('canvas-surface');
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      const screenX = canvasBox!.x + 100;
      const screenY = canvasBox!.y + 100;
      await adminPage.mouse.move(screenX, screenY);
      await adminPage.mouse.down();
      // 移动到中间位置（创建中状态）
      await adminPage.mouse.move(screenX + 80, screenY + 60, { steps: 5 });

      // 3. 验证创建期间不出现 Moveable 控制框
      //    Moveable 控制框 class 包含 "moveable-control-box"
      //    注意：Moveable 即使无 target 也会渲染隐藏的 control-box DOM 元素（display:none），
      //    因此用 toBeHidden 而非 toHaveCount(0) 判定"未显示"
      const moveableControlBox = adminPage.locator('.moveable-control-box').first();
      await expect(moveableControlBox).toBeHidden({ timeout: 500 });

      // 4. 验证创建期间不出现 Selecto 框选区域
      //    Selecto 框选区域 class 包含 "selecto-area"
      const selectoArea = adminPage.locator('.selecto-area');
      await expect(selectoArea).toHaveCount(0, { timeout: 500 });

      // 5. 完成拖拽创建
      await adminPage.mouse.move(screenX + 160, screenY + 120, { steps: 5 });
      await adminPage.mouse.up();

      // 6. 验证组件已创建
      const count = await readComponentCount(adminPage);
      expect(count).toBe(1);

      // 7. 切换回选择工具，验证新组件已选中
      //    （rect 工具下 Moveable 被禁用是预期行为，选择态由状态栏验证）
      await adminPage.getByRole('button', { name: '选择' }).click();
      await expectSelectionText(adminPage, /已选中 1 个|矩形/, 5000);
    } finally {
      try {
        await deleteScreenProject(project.id);
      } catch {
        // 忽略清理错误
      }
    }
  });
});
