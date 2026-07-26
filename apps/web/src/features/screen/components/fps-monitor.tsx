import { memo, useEffect, useRef, useState } from 'react';
import { createFpsTracker, type FpsStats } from '../lib/fps-tracker';

/**
 * 实时 FPS 监视器组件（页面内可视化）。
 *
 * 设计：
 * - 持续运行 rAF 循环采样帧间隔
 * - 每 250ms 计算一次最近 1 秒滑动窗口的 FPS 统计
 * - 显示：当前 FPS（瞬时）、近 1s 平均 FPS、近 1s 掉帧率
 * - 拖拽过程中 FPS 下降时数字变红
 *
 * 不参与画布渲染链路，挂载在画布外层 DOM 上，不影响被测对象。
 */
export const FpsMonitor = memo(function FpsMonitor() {
  const [stats, setStats] = useState<FpsStats | null>(null);
  const [currentFps, setCurrentFps] = useState<number>(0);
  const trackerRef = useRef(createFpsTracker());

  useEffect(() => {
    const tracker = trackerRef.current;
    tracker.start();

    // 瞬时 FPS：每 rAF 都更新一次（但状态更新节流到 ~100ms）
    let lastUpdateTime = 0;
    let lastDelta = 0;
    const rafLoop = () => {
      const now = performance.now();
      // peek 一次最新 delta（不停止采样）
      const peek = tracker.peek();
      const lastFrameDelta = peek.frameDeltas[peek.frameDeltas.length - 1];
      if (lastFrameDelta !== undefined && lastFrameDelta !== lastDelta) {
        lastDelta = lastFrameDelta;
        const fps = lastFrameDelta > 0 ? 1000 / lastFrameDelta : 0;
        if (now - lastUpdateTime > 100) {
          setCurrentFps(fps);
          lastUpdateTime = now;
        }
      }
      requestAnimationFrame(rafLoop);
    };
    const rafId = requestAnimationFrame(rafLoop);

    // 滑动窗口统计：每 250ms 计算最近 1 秒内的 FPS
    const windowSize = 1000;
    const statsTimer = setInterval(() => {
      const peek = tracker.peek();
      // 取最近 1 秒的帧间隔
      const recentDeltas: number[] = [];
      let acc = 0;
      for (let i = peek.frameDeltas.length - 1; i >= 0; i--) {
        const d = peek.frameDeltas[i];
        if (acc + d > windowSize) break;
        recentDeltas.unshift(d);
        acc += d;
      }
      // 重算统计（简化：复用 peek 但只看近 1 秒）
      if (recentDeltas.length > 0) {
        const total = recentDeltas.length;
        const dur = recentDeltas.reduce((a, b) => a + b, 0);
        const fpsValues = recentDeltas.map((d) => (d > 0 ? 1000 / d : 0));
        const sorted = [...fpsValues].sort((a, b) => a - b);
        const dropped = recentDeltas.filter((d) => d > 1000 / 30).length;
        setStats({
          totalFrames: total,
          durationMs: dur,
          avgFps: dur > 0 ? (total * 1000) / dur : 0,
          minFps: sorted[0] ?? 0,
          maxFps: sorted[sorted.length - 1] ?? 0,
          p95Fps: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
          droppedFrames: dropped,
          droppedRatio: total > 0 ? dropped / total : 0,
          frameDeltas: recentDeltas,
        });
      }
    }, 250);

    return () => {
      clearInterval(statsTimer);
      cancelAnimationFrame(rafId);
      tracker.stop();
    };
  }, []);

  const isLowFps = stats !== null && stats.avgFps < 50;
  const isVeryLowFps = stats !== null && stats.avgFps < 30;
  const colorClass = isVeryLowFps
    ? 'text-red-500'
    : isLowFps
      ? 'text-amber-500'
      : 'text-emerald-500';

  return (
    <div className="flex items-center gap-4 font-mono text-xs">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">当前:</span>
        <span className={`font-bold ${colorClass}`}>{currentFps.toFixed(0)}</span>
        <span className="text-muted-foreground">fps</span>
      </div>
      {stats && (
        <>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">近1s:</span>
            <span className={`font-bold ${colorClass}`}>{stats.avgFps.toFixed(0)}</span>
            <span className="text-muted-foreground">fps</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">掉帧:</span>
            <span
              className={`font-bold ${stats.droppedRatio > 0.1 ? 'text-red-500' : 'text-emerald-500'}`}
            >
              {stats.droppedFrames}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{stats.totalFrames}</span>
            <span className="text-muted-foreground">
              ({(stats.droppedRatio * 100).toFixed(0)}%)
            </span>
          </div>
        </>
      )}
    </div>
  );
});
