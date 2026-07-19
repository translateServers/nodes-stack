/**
 * rAF 节流器：将高频回调合并到下一动画帧执行。
 *
 * 用于拖拽/缩放/旋转过程中的高频副作用（Smart Guides 对齐线计算、
 * 尺寸提示 store 更新、DOM style 写入）：
 * - 同一帧内的多次调用仅保留最后一次任务（闭包捕获最新事件值）
 * - 每帧最多执行一次，避免高频 store 更新造成重复渲染与主线程压力
 *
 * 使用契约（重要）：
 * - 手势结束（onDragEnd / onResizeEnd 等）时必须先调用 flush() 或 cancel()，
 *   防止挂起任务在手势结束后才执行，覆盖最终状态
 *   （如尺寸提示已隐藏又被重新显示、End 处理器读到过期的 DOM style）
 * - flush()：立即同步执行挂起任务 —— 适用于 End 处理器需要从 DOM 读取
 *   最终 style 的场景（onResizeEnd / onRotateEnd）
 * - cancel()：丢弃挂起任务 —— 适用于 End 处理器从事件对象（lastEvent）
 *   获取最终值的场景（onDragEnd），或组件卸载时清理
 */
export interface RafThrottler {
  /** 调度任务到下一帧执行；同帧内重复调用仅保留最新任务 */
  schedule: (task: () => void) => void;
  /** 立即同步执行挂起任务（若有），并取消待执行的 rAF */
  flush: () => void;
  /** 丢弃挂起任务（若有），并取消待执行的 rAF */
  cancel: () => void;
  /** 当前是否有挂起任务 */
  pending: () => boolean;
}

export function createRafThrottler(): RafThrottler {
  let rafId: number | null = null;
  let pendingTask: (() => void) | null = null;

  const runPending = (): void => {
    const task = pendingTask;
    pendingTask = null;
    task?.();
  };

  return {
    schedule(task) {
      // 同帧内多次调用：仅保留最新任务（其闭包捕获最新事件值）
      pendingTask = task;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        runPending();
      });
    },
    flush() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      runPending();
    },
    cancel() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingTask = null;
    },
    pending() {
      return rafId !== null;
    },
  };
}
