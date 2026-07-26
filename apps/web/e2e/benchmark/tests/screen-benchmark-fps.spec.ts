/**
 * 画布拖拽 FPS 基准测试。
 *
 * 目标：量化 Moveable 控制框显示/隐藏 + 组件拖拽过程中的渲染性能，
 * 作为对比 light-chaser 项目的客观基准。
 *
 * 测试矩阵：
 * 1. 静态画布 baseline：无交互时浏览器自然 FPS（参考线）
 * 2. 点击选中组件：测量 mousedown→Moveable 控制框出现过程的 FPS
 * 3. 拖拽组件：测量拖拽中持续 pointermove 触发 onDrag 的 FPS
 * 4. 取消选中：点击空白 → 控制框消失的 FPS
 * 5. 反复选中/取消循环：检测性能退化（内存泄漏或重渲染累积）
 *
 * 测试输出：每个测试都打印完整 FPS 报告到 console + attach 到 test report。
 *
 * 软断言策略（避免 CI 环境抖动导致误报）：
 * - 不强制 FPS 具体值，只检查 droppedRatio 不超过 50%
 * - 拖拽中 FPS 不应低于静态 baseline 的 50%
 *
 * 运行命令：
 *   pnpm --filter @nebula/web exec playwright test --config=e2e/playwright.benchmark.config.ts
 *   pnpm --filter @nebula/web exec playwright test --config=e2e/playwright.benchmark.config.ts --headed
 */

import { test, expect, type Page } from '@playwright/test';
import {
  injectFpsTracker,
  startFpsMeasurement,
  stopFpsMeasurement,
  formatFpsReport,
  dragComponent,
  clickComponent,
  hideReactQueryDevtools,
  type FpsStats,
} from '../helpers/fps-tracker.helper';

const ROUTE = '/screen-benchmark';

/** 等待画布与首个组件就位 */
async function waitForCanvasReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="canvas-surface"]', { timeout: 10_000 });
  await page.waitForSelector('[data-component-id="c-rect-1"]', { timeout: 10_000 });
  // fit-to-screen useEffect 完成需要等一帧 + 一个 macrotask
  await page.waitForTimeout(500);
}

/** 获取组件中心点屏幕坐标 */
async function getComponentCenter(
  page: Page,
  componentId: string,
): Promise<{ x: number; y: number }> {
  const locator = page.locator(`[data-component-id="${componentId}"]`);
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`组件 ${componentId} 未找到，无法获取 boundingBox`);
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * 在画布空白处点击（取消选中）。
 *
 * 点击 canvas-surface 的左上角相对坐标 (10, 10)：
 * - 避开 React Query DevTools 浮动按钮（默认右下角，__root.tsx 全局挂载）
 * - 避开所有组件（基准页最左侧组件 c-rect-1 起始于 x=80，左上角 10x10 在画布外灰色背景区）
 * - canvas-surface 的 pointerdown 处理器覆盖整个容器（含画布外背景），
 *   点击此处仍会触发取消选中逻辑
 */
async function clickBlankCanvas(page: Page): Promise<void> {
  const surface = page.locator('[data-testid="canvas-surface"]');
  await surface.click({ position: { x: 10, y: 10 } });
}

/** attach FPS 报告到 test，并打印到控制台 */
function attachReport(
  testInfo: import('@playwright/test').TestInfo,
  label: string,
  stats: FpsStats,
): void {
  const report = formatFpsReport(label, stats);
  console.log(`\n${report}\n`);
  void testInfo.attach(`fps-report-${label}.txt`, {
    body: report,
    contentType: 'text/plain',
  });
}

test.describe('画布拖拽 FPS 基准测试', () => {
  test.beforeEach(async ({ page }) => {
    await injectFpsTracker(page);
    await page.goto(ROUTE);
    await waitForCanvasReady(page);
    // 隐藏 React Query DevTools 浮动按钮，避免误弹 DevTools 面板
    // 双保险：clickBlankCanvas 已避开右下角，但 box-selection 拖拽可能扫过右下角
    await hideReactQueryDevtools(page);
  });

  test('1. 静态画布 baseline FPS（无交互参考线）', async ({ page }, testInfo) => {
    // 等 1 秒让初始 fit-to-screen 渲染稳定
    await page.waitForTimeout(1000);

    // 采样 2 秒静态画布的 FPS
    await startFpsMeasurement(page);
    await page.waitForTimeout(2000);
    const stats = await stopFpsMeasurement(page);

    attachReport(testInfo, 'static-baseline', stats);

    // 软断言：静态画布应保持高 FPS，掉帧率 < 10%
    expect(stats.avgFps, '静态画布平均 FPS 应 > 50').toBeGreaterThan(50);
    expect(stats.droppedRatio, '静态画布掉帧率应 < 10%').toBeLessThan(0.1);
  });

  test('2. 点击选中组件时 FPS（Moveable 控制框出现）', async ({ page }, testInfo) => {
    const target = await getComponentCenter(page, 'c-rect-1');

    // 先取消选中（确保从无控制框状态开始）
    await clickBlankCanvas(page);
    await page.waitForTimeout(300);

    // 开始采样 + 触发点击
    await startFpsMeasurement(page);
    await clickComponent(page, target.x, target.y);
    // 等 Moveable 控制框完全渲染 + 稳定
    await page.waitForTimeout(1000);
    const stats = await stopFpsMeasurement(page);

    attachReport(testInfo, 'click-select', stats);

    // 选中过程不应有大量掉帧（控制框渲染开销应在 1-2 帧内完成）
    expect(stats.droppedRatio, '选中过程掉帧率应 < 30%').toBeLessThan(0.3);
  });

  test('3. 拖拽组件过程中 FPS（持续 onDrag）', async ({ page }, testInfo) => {
    const start = await getComponentCenter(page, 'c-rect-2');

    // 先选中组件（拖拽前需选中以激活 Moveable dragStart 路径）
    await clickComponent(page, start.x, start.y);
    await page.waitForTimeout(500);

    // 启动采样 + 拖拽 2 秒
    await startFpsMeasurement(page);
    await dragComponent(page, start.x, start.y, 200, 100, 2000, 60);
    // 拖拽结束后多采 200ms 看是否有 fps 回弹延迟
    await page.waitForTimeout(200);
    const stats = await stopFpsMeasurement(page);

    attachReport(testInfo, 'drag-component', stats);

    // 拖拽过程中 FPS 应保持在 30 以上（light-chaser 在 60 左右）
    expect(stats.avgFps, '拖拽中平均 FPS 应 > 30').toBeGreaterThan(30);
    expect(stats.p95Fps, '拖拽中 P95 FPS 应 > 25').toBeGreaterThan(25);
  });

  test('4. 拖拽未选中组件（直接 mousedown 启动）FPS', async ({ page }, testInfo) => {
    // 这是用户原始反馈的场景：未选中状态下直接 mousedown 拖拽
    const start = await getComponentCenter(page, 'c-rect-3');

    // 确保无组件选中
    await clickBlankCanvas(page);
    await page.waitForTimeout(300);

    await startFpsMeasurement(page);
    // 直接 mouseDown 组件（不预先 click），触发 onSelectEnd → dragStart 同步路径
    await dragComponent(page, start.x, start.y, 150, 80, 2000, 60);
    await page.waitForTimeout(200);
    const stats = await stopFpsMeasurement(page);

    attachReport(testInfo, 'drag-unselected', stats);

    expect(stats.avgFps, '拖拽未选中组件平均 FPS 应 > 30').toBeGreaterThan(30);
  });

  test('5. 点击空白取消选中时 FPS（控制框隐藏）', async ({ page }, testInfo) => {
    const target = await getComponentCenter(page, 'c-rect-1');

    // 先选中组件（控制框出现）
    await clickComponent(page, target.x, target.y);
    await page.waitForTimeout(500);

    // 采样 + 点击空白（控制框应立即消失）
    await startFpsMeasurement(page);
    await clickBlankCanvas(page);
    await page.waitForTimeout(800);
    const stats = await stopFpsMeasurement(page);

    attachReport(testInfo, 'click-blank-deselect', stats);

    expect(stats.droppedRatio, '取消选中过程掉帧率应 < 20%').toBeLessThan(0.2);
  });

  test('6. 反复选中/取消循环（检测性能退化）', async ({ page }, testInfo) => {
    const target = await getComponentCenter(page, 'c-rect-1');

    // 预热：先做 3 次选中/取消，让 React 编译/JIT 稳定
    for (let i = 0; i < 3; i++) {
      await clickComponent(page, target.x, target.y);
      await page.waitForTimeout(100);
      await clickBlankCanvas(page);
      await page.waitForTimeout(100);
    }

    // 正式采样：连续 10 次循环
    const cycles = 10;
    await startFpsMeasurement(page);
    for (let i = 0; i < cycles; i++) {
      await clickComponent(page, target.x, target.y);
      await page.waitForTimeout(100);
      await clickBlankCanvas(page);
      await page.waitForTimeout(100);
    }
    const stats = await stopFpsMeasurement(page);

    attachReport(testInfo, 'repeated-select-deselect', stats);

    // 反复操作不应导致 FPS 严重下降（检测内存泄漏 / 累积重渲染）
    // 平均 FPS 应保持在 30 以上
    expect(stats.avgFps, '反复选中/取消平均 FPS 应 > 30').toBeGreaterThan(30);
  });

  test('7. 持续拖拽长距离（压力测试）FPS', async ({ page }, testInfo) => {
    const start = await getComponentCenter(page, 'c-rect-4');

    await clickComponent(page, start.x, start.y);
    await page.waitForTimeout(500);

    // 5 秒持续拖拽，100 步，覆盖大范围位移
    await startFpsMeasurement(page);
    await dragComponent(page, start.x, start.y, 500, 300, 5000, 100);
    await page.waitForTimeout(300);
    const stats = await stopFpsMeasurement(page);

    attachReport(testInfo, 'long-drag-stress', stats);

    expect(stats.avgFps, '长距离拖拽平均 FPS 应 > 25').toBeGreaterThan(25);
    expect(stats.droppedRatio, '长距离拖拽掉帧率应 < 50%').toBeLessThan(0.5);
  });

  test('8. 多组件框选 + 组拖拽 FPS', async ({ page }, testInfo) => {
    const rect2 = await getComponentCenter(page, 'c-rect-2');
    const rect3 = await getComponentCenter(page, 'c-rect-3');
    const minX = Math.min(rect2.x, rect3.x) - 30;
    const minY = Math.min(rect2.y, rect3.y) - 30;
    const maxX = Math.max(rect2.x, rect3.x) + 30;
    const maxY = Math.max(rect2.y, rect3.y) + 30;

    // 框选两个组件
    await page.mouse.move(minX, minY);
    await page.mouse.down();
    await page.mouse.move(maxX, maxY, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // 框选后启动采样，拖拽组
    const groupCenterX = (minX + maxX) / 2;
    const groupCenterY = (minY + maxY) / 2;

    await startFpsMeasurement(page);
    await dragComponent(page, groupCenterX, groupCenterY, 100, 50, 2000, 60);
    await page.waitForTimeout(200);
    const stats = await stopFpsMeasurement(page);

    attachReport(testInfo, 'group-drag', stats);

    expect(stats.avgFps, '组拖拽平均 FPS 应 > 25').toBeGreaterThan(25);
  });
});
