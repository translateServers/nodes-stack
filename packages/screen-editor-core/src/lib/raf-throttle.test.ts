import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createRafThrottler } from './raf-throttle';

/**
 * 手动 rAF 模拟：不依赖真实定时器，测试可显式驱动帧推进。
 */
function mockRaf(): { runFrame: () => void; rafSpy: ReturnType<typeof vi.fn> } {
  let callback: FrameRequestCallback | null = null;
  let nextId = 1;
  const rafSpy = vi.fn((cb: FrameRequestCallback): number => {
    callback = cb;
    return nextId++;
  });
  vi.stubGlobal('requestAnimationFrame', rafSpy);
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn(() => {
      callback = null;
    }),
  );
  return {
    rafSpy,
    runFrame: () => {
      const cb = callback;
      callback = null;
      cb?.(performance.now());
    },
  };
}

describe('createRafThrottler', () => {
  let runFrame: () => void;

  beforeEach(() => {
    ({ runFrame } = mockRaf());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedule 的任务在下一帧执行', () => {
    const throttler = createRafThrottler();
    const task = vi.fn();
    throttler.schedule(task);
    expect(task).not.toHaveBeenCalled();
    runFrame();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('同帧内多次 schedule 仅执行最后一次任务', () => {
    const throttler = createRafThrottler();
    const calls: number[] = [];
    throttler.schedule(() => calls.push(1));
    throttler.schedule(() => calls.push(2));
    throttler.schedule(() => calls.push(3));
    runFrame();
    expect(calls).toEqual([3]);
  });

  it('每帧最多执行一次（连续两帧各自执行一次）', () => {
    const throttler = createRafThrottler();
    const task = vi.fn();
    throttler.schedule(task);
    runFrame();
    throttler.schedule(task);
    runFrame();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('cancel 丢弃挂起任务，帧推进时不执行', () => {
    const throttler = createRafThrottler();
    const task = vi.fn();
    throttler.schedule(task);
    expect(throttler.pending()).toBe(true);
    throttler.cancel();
    expect(throttler.pending()).toBe(false);
    runFrame();
    expect(task).not.toHaveBeenCalled();
  });

  it('flush 立即同步执行挂起任务并取消 rAF', () => {
    const throttler = createRafThrottler();
    const task = vi.fn();
    throttler.schedule(task);
    throttler.flush();
    expect(task).toHaveBeenCalledTimes(1);
    expect(throttler.pending()).toBe(false);
    // 帧推进时不重复执行
    runFrame();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('flush 无挂起任务时为空操作', () => {
    const throttler = createRafThrottler();
    expect(() => throttler.flush()).not.toThrow();
    expect(throttler.pending()).toBe(false);
  });

  it('cancel 无挂起任务时为空操作', () => {
    const throttler = createRafThrottler();
    expect(() => throttler.cancel()).not.toThrow();
    expect(throttler.pending()).toBe(false);
  });

  it('任务闭包捕获最新事件值（模拟拖拽过程中的坐标合并）', () => {
    const throttler = createRafThrottler();
    const applied: Array<{ x: number; y: number }> = [];
    const scheduleAt = (x: number, y: number): void => {
      throttler.schedule(() => applied.push({ x, y }));
    };
    // 模拟一帧内连续 mousemove：仅最后坐标被应用
    scheduleAt(10, 10);
    scheduleAt(20, 20);
    scheduleAt(30, 30);
    runFrame();
    expect(applied).toEqual([{ x: 30, y: 30 }]);
  });
});
