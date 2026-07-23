/**
 * useCanvasFlash Hook 测试（任务 9.1）
 *
 * 验证点（对应 tasks.md 9.1 验证要求）：
 * - 高亮触发：flashComponent(id) 设置 flashingComponentId
 * - 自动消失：FLASH_MS 后自动清除
 * - 手动清除：clearFlash() 立即清除
 * - 重复触发：清除上次定时器并重置计时
 * - 卸载清理：卸载后无浮动回调
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCanvasFlash } from './use-canvas-flash';

afterEach(() => {
  vi.useRealTimers();
});

describe('useCanvasFlash（任务 9.1）', () => {
  it('初始状态：flashingComponentId 为 null', () => {
    const { result } = renderHook(() => useCanvasFlash(1000));

    expect(result.current.flashingComponentId).toBeNull();
  });

  it('flashComponent(id)：设置 flashingComponentId', () => {
    const { result } = renderHook(() => useCanvasFlash(1000));

    act(() => {
      result.current.flashComponent('comp-1');
    });

    expect(result.current.flashingComponentId).toBe('comp-1');
  });

  it('FLASH_MS 后自动清除 flashingComponentId', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCanvasFlash(1500));

    act(() => {
      result.current.flashComponent('comp-1');
    });

    expect(result.current.flashingComponentId).toBe('comp-1');

    // 推进 1500ms：触发自动清除
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.flashingComponentId).toBeNull();
  });

  it('FLASH_MS 之前未清除', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCanvasFlash(1500));

    act(() => {
      result.current.flashComponent('comp-1');
    });

    // 推进 1400ms：尚未到 1500ms
    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(result.current.flashingComponentId).toBe('comp-1');
  });

  it('clearFlash()：立即清除 flashingComponentId', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCanvasFlash(1500));

    act(() => {
      result.current.flashComponent('comp-1');
    });

    expect(result.current.flashingComponentId).toBe('comp-1');

    act(() => {
      result.current.clearFlash();
    });

    expect(result.current.flashingComponentId).toBeNull();
  });

  it('clearFlash() 后定时器不再触发自动清除（无副作用）', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCanvasFlash(1500));

    act(() => {
      result.current.flashComponent('comp-1');
    });

    act(() => {
      result.current.clearFlash();
    });

    // 即使推进 5000ms，也不会有错误（定时器已被清理）
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();

    expect(result.current.flashingComponentId).toBeNull();
  });

  it('重复触发：清除上次定时器并重置计时', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCanvasFlash(1500));

    // 第一次触发 comp-1
    act(() => {
      result.current.flashComponent('comp-1');
    });

    // 推进 1000ms（距 1500ms 还剩 500ms）
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.flashingComponentId).toBe('comp-1');

    // 第二次触发 comp-2（应清除上一次定时器，重置 1500ms 计时）
    act(() => {
      result.current.flashComponent('comp-2');
    });

    expect(result.current.flashingComponentId).toBe('comp-2');

    // 推进 1000ms（如果未清除上次定时器，500ms 前会触发 null）
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.flashingComponentId).toBe('comp-2');

    // 再推进 500ms（共 1500ms）触发清除
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.flashingComponentId).toBeNull();
  });

  it('卸载后清理定时器（无浮动回调）', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useCanvasFlash(1500));

    act(() => {
      result.current.flashComponent('comp-1');
    });

    // 卸载：应清理定时器
    unmount();

    // 推进定时器：不应有 setState 调用（已卸载）
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });

  it('flashComponent 引用稳定（useCallback）', () => {
    const { result, rerender } = renderHook(() => useCanvasFlash(1000));

    const firstFlash = result.current.flashComponent;
    const firstClear = result.current.clearFlash;

    rerender();

    expect(result.current.flashComponent).toBe(firstFlash);
    expect(result.current.clearFlash).toBe(firstClear);
  });
});
