import type { Page } from '@playwright/test';

/**
 * 单次 FPS 采样的统计结果。
 *
 * 与 src/features/screen/lib/fps-tracker.ts 中的 FpsStats 保持结构一致，
 * 但在 e2e 中本地声明，避免 e2e tsconfig 的 rootDir 限制（rootDir=e2e/ 不能引用 src/）。
 */
export interface FpsStats {
  totalFrames: number;
  durationMs: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  p95Fps: number;
  droppedFrames: number;
  droppedRatio: number;
  frameDeltas: number[];
}

/**
 * 将 createFpsTracker 注入到 window.__fpsTracker。
 *
 * 必须在 page.goto 之前调用（addInitScript 注入到所有导航之前），
 * 确保 page 加载完成后立即可用，避免错过首帧。
 *
 * 注意：不能直接 import 源码——Playwright 在 Node 侧执行，
 * 但 tracker 代码需要在浏览器侧运行。这里用内联实现保证类型与页面端一致。
 */
export async function injectFpsTracker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 掉帧阈值：< 30fps 视为掉帧
    const DROP_FRAME_THRESHOLD_MS = 1000 / 30;

    const state = {
      frameDeltas: [] as number[],
      lastTime: 0,
      rafId: 0,
      running: false,
    };

    function computeStats(deltas: number[]): FpsStats {
      if (deltas.length === 0) {
        return {
          totalFrames: 0,
          durationMs: 0,
          avgFps: 0,
          minFps: 0,
          maxFps: 0,
          p95Fps: 0,
          droppedFrames: 0,
          droppedRatio: 0,
          frameDeltas: [],
        };
      }
      const totalFrames = deltas.length;
      const durationMs = deltas.reduce((a, b) => a + b, 0);
      const fpsValues = deltas.map((d) => (d > 0 ? 1000 / d : 0));
      const sortedFps = [...fpsValues].sort((a, b) => a - b);
      const avgFps = durationMs > 0 ? (totalFrames * 1000) / durationMs : 0;
      const minFps = sortedFps[0] ?? 0;
      const maxFps = sortedFps[sortedFps.length - 1] ?? 0;
      const p95Idx = Math.min(sortedFps.length - 1, Math.floor(sortedFps.length * 0.95));
      const p95Fps = sortedFps[p95Idx] ?? 0;
      const droppedFrames = deltas.filter((d) => d > DROP_FRAME_THRESHOLD_MS).length;
      const droppedRatio = totalFrames > 0 ? droppedFrames / totalFrames : 0;
      return {
        totalFrames,
        durationMs,
        avgFps,
        minFps,
        maxFps,
        p95Fps,
        droppedFrames,
        droppedRatio,
        frameDeltas: deltas,
      };
    }

    function tick() {
      if (!state.running) return;
      const now = performance.now();
      const delta = now - state.lastTime;
      state.lastTime = now;
      if (delta > 0 && delta < 10_000) {
        state.frameDeltas.push(delta);
      }
      state.rafId = requestAnimationFrame(tick);
    }

    (window as unknown as { __fpsTracker: unknown }).__fpsTracker = {
      start() {
        state.frameDeltas = [];
        state.lastTime = performance.now();
        state.running = true;
        state.rafId = requestAnimationFrame(tick);
      },
      stop(): FpsStats {
        state.running = false;
        cancelAnimationFrame(state.rafId);
        return computeStats(state.frameDeltas);
      },
      isRunning() {
        return state.running;
      },
      peek(): FpsStats {
        return computeStats(state.frameDeltas);
      },
    };
  });
}

/** 启动 FPS 采样 */
export async function startFpsMeasurement(page: Page): Promise<void> {
  await page.evaluate(() => {
    const tracker = (window as unknown as { __fpsTracker: { start: () => void } }).__fpsTracker;
    tracker.start();
  });
}

/** 停止采样并返回统计结果 */
export async function stopFpsMeasurement(page: Page): Promise<FpsStats> {
  return page.evaluate(() => {
    const tracker = (window as unknown as { __fpsTracker: { stop: () => FpsStats } }).__fpsTracker;
    return tracker.stop();
  });
}

/** 不停止采样，读取当前累计的统计（用于实时观测） */
export async function peekFpsMeasurement(page: Page): Promise<FpsStats> {
  return page.evaluate(() => {
    const tracker = (window as unknown as { __fpsTracker: { peek: () => FpsStats } }).__fpsTracker;
    return tracker.peek();
  });
}

/**
 * 将 FpsStats 格式化为可读报告（用于 console / attach）。
 */
export function formatFpsReport(label: string, stats: FpsStats): string {
  const lines = [
    `=== FPS Report: ${label} ===`,
    `  Duration:        ${stats.durationMs.toFixed(0)} ms`,
    `  Total frames:    ${stats.totalFrames}`,
    `  Avg FPS:         ${stats.avgFps.toFixed(1)}`,
    `  Min FPS:         ${stats.minFps.toFixed(1)}`,
    `  Max FPS:         ${stats.maxFps.toFixed(1)}`,
    `  P95 FPS:         ${stats.p95Fps.toFixed(1)}  (95% of frames are at least this fast)`,
    `  Dropped frames:  ${stats.droppedFrames} (${(stats.droppedRatio * 100).toFixed(1)}% of total)`,
    `=== End Report ===`,
  ];
  return lines.join('\n');
}

/**
 * 模拟用户拖拽组件。
 *
 * @param page Playwright Page 实例
 * @param startX 起始 X（屏幕坐标）
 * @param startY 起始 Y
 * @param dx 总位移 X
 * @param dy 总位移 Y
 * @param durationMs 拖拽总时长
 * @param steps 拖拽步数（每步触发一次 mouse.move）
 */
export async function dragComponent(
  page: Page,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  durationMs: number,
  steps: number = 60,
): Promise<void> {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const stepIntervalMs = durationMs / steps;
  const stepDx = dx / steps;
  const stepDy = dy / steps;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + stepDx * i, startY + stepDy * i);
    await page.waitForTimeout(stepIntervalMs);
  }
  await page.mouse.up();
}

/** 模拟用户点击组件（mousedown + mouseup）。 */
export async function clickComponent(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
}

/**
 * 隐藏 React Query DevTools 浮动按钮。
 *
 * 基准测试页是根路由下渲染的页面，__root.tsx 全局挂载了 ReactQueryDevtools。
 * DevTools 默认浮动在右下角（z-index 很高、fixed 定位），
 * 会拦截画布右下角的点击（包括 fit-to-screen 后画布右下角的空白区域），
 * 导致 clickBlankCanvas 失效 + 弹出 DevTools 面板。
 *
 * 本函数通过注入 CSS 把 DevTools 的 trigger 按钮和面板都隐藏掉，
 * 保证基准测试期间画布右下角可被点击且不会误弹 DevTools。
 *
 * 必须在 page.goto 之后调用（DOM 已挂载 DevTools 容器后才能查询到）。
 */
export async function hideReactQueryDevtools(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      /* React Query DevTools 浮动 trigger 按钮 */
      button[aria-label^="Open Tanstack"],
      button[aria-label^="Close Tanstack"],
      [class*="tsqd-parentContainer"],
      [class*="tsqd-floating-button"],
      [data-tsqd-button] {
        display: none !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `,
  });
}
