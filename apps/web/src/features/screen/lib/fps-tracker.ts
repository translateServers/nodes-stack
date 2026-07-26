/**
 * FPS 测量工具：浏览器内帧率采样器。
 *
 * 设计原则：
 * - 基于 requestAnimationFrame 测量真实渲染帧间隔（受浏览器 throttling 影响，
 *   反映用户实际感知）
 * - 提供 start/stop API 与统计计算（avg/min/max/p95/droppedFrames）
 * - 同一份代码同时用于：
 *   1) 页面内 FpsMonitor 组件实时显示当前 FPS（手动测试时观察）
 *   2) Playwright 测试注入到 window.__fpsTracker 后由测试代码控制采样窗口
 *
 * 掉帧定义：帧间隔 > 1000/30 ≈ 33.33ms 视为掉帧（< 30fps）
 */

/** 单次 FPS 采样的统计结果 */
export interface FpsStats {
  /** 采样窗口内总帧数 */
  totalFrames: number;
  /** 采样窗口持续时间（ms） */
  durationMs: number;
  /** 平均 FPS = totalFrames * 1000 / durationMs */
  avgFps: number;
  /** 单帧最高间隔对应的最低 FPS */
  minFps: number;
  /** 单帧最低间隔对应的最高 FPS */
  maxFps: number;
  /** 95% 分位 FPS（剔除最差 5% 后的最低值，反映"绝大多数帧"的体验） */
  p95Fps: number;
  /** 掉帧数（帧间隔 > 33.33ms） */
  droppedFrames: number;
  /** 掉帧比例 = droppedFrames / totalFrames */
  droppedRatio: number;
  /** 每帧间隔数组（ms），用于绘制帧时间分布 */
  frameDeltas: number[];
}

/** 掉帧阈值：帧间隔 > 33.33ms 视为掉帧（< 30fps） */
const DROP_FRAME_THRESHOLD_MS = 1000 / 30;

/**
 * 帧率采样器实例。
 *
 * 使用方法：
 *   const tracker = createFpsTracker();
 *   tracker.start();
 *   // ... 执行交互 ...
 *   const stats = tracker.stop();
 */
export interface FpsTracker {
  /** 开始采样。重复调用会重置采样窗口。 */
  start: () => void;
  /** 停止采样并返回统计结果。未启动时返回空统计。 */
  stop: () => FpsStats;
  /** 当前是否正在采样 */
  isRunning: () => boolean;
  /** 不停止采样，直接读取当前累计的统计（用于实时显示） */
  peek: () => FpsStats;
}

interface FpsTrackerState {
  frameDeltas: number[];
  lastTime: number;
  rafId: number;
  running: boolean;
}

export function createFpsTracker(): FpsTracker {
  const state: FpsTrackerState = {
    frameDeltas: [],
    lastTime: 0,
    rafId: 0,
    running: false,
  };

  const computeStats = (deltas: number[]): FpsStats => {
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
    // p95：取 95% 分位（即去掉最差 5% 后的最低值）
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
  };

  const tick = () => {
    if (!state.running) return;
    const now = performance.now();
    const delta = now - state.lastTime;
    state.lastTime = now;
    // 跳过首次启动的初始间隔（lastTime 未初始化时）
    if (delta > 0 && delta < 10_000) {
      state.frameDeltas.push(delta);
    }
    state.rafId = requestAnimationFrame(tick);
  };

  return {
    start() {
      state.frameDeltas = [];
      state.lastTime = performance.now();
      state.running = true;
      state.rafId = requestAnimationFrame(tick);
    },
    stop() {
      state.running = false;
      cancelAnimationFrame(state.rafId);
      return computeStats(state.frameDeltas);
    },
    isRunning() {
      return state.running;
    },
    peek() {
      return computeStats(state.frameDeltas);
    },
  };
}

/**
 * 将 FpsStats 格式化为控制台友好的报告字符串。
 *
 * 用于 Playwright 测试输出（test.info.attach + console.log）。
 */
export function formatFpsReport(label: string, stats: FpsStats): string {
  const lines = [
    `=== FPS Report: ${label} ===`,
    `  Duration:      ${stats.durationMs.toFixed(0)} ms`,
    `  Total frames:  ${stats.totalFrames}`,
    `  Avg FPS:       ${stats.avgFps.toFixed(1)}`,
    `  Min FPS:       ${stats.minFps.toFixed(1)}`,
    `  Max FPS:       ${stats.maxFps.toFixed(1)}`,
    `  P95 FPS:       ${stats.p95Fps.toFixed(1)}  (95% of frames are at least this fast)`,
    `  Dropped frames: ${stats.droppedFrames} (${(stats.droppedRatio * 100).toFixed(1)}% of total)`,
    `=== End Report ===`,
  ];
  return lines.join('\n');
}
