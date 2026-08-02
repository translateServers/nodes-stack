/**
 * rAF 节流器：将高频回调合并到下一动画帧执行。
 *
 * 用于拖拽/缩放/旋转过程中的高频 React store 更新
 * （Smart Guides 对齐线浮层、尺寸提示）：
 * - 同一帧内的多次调用仅保留最后一次任务（闭包捕获最新事件值）
 * - 每帧最多执行一次，避免高频 store 更新造成重复渲染与主线程压力
 *
 * 注意（拖拽抖动教训）：DOM style 写入（left/top/width/height/transform）
 * 不要放进调度任务。react-moveable 在 onDrag/onResize/onRotate 返回后
 * 同步 flushSync 执行 updateRect() 读取目标 DOM 位置，style 延迟写入
 * 会导致控制框按旧位置渲染、组件下一帧才移动，两者错开一帧造成视觉抖动。
 *
 * 使用契约（重要）：
 * - 手势结束（onDragEnd / onResizeEnd / onRotateEnd）时调用 cancel() 丢弃
 *   挂起任务：End 处理器会同步写入最终状态（如隐藏尺寸提示），
 *   挂起任务若在结束后执行会覆盖最终状态
 * - cancel()：丢弃挂起任务 —— 手势结束与组件卸载时清理
 * - flush()：立即同步执行挂起任务 —— 预留给需要落地挂起 store 更新的场景
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
