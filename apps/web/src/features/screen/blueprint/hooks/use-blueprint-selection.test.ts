import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SELECTION_CONFIG, useBlueprintSelection } from './use-blueprint-selection';

// 在 vitest 中模拟键盘事件需要在 document 上 dispatchEvent
// useKeyPress 内部使用 ResizeObserver / navigator 等，我们直接调用 Hook 验证 config 与回调触发

describe('use-blueprint-selection', () => {
  describe('DEFAULT_SELECTION_CONFIG', () => {
    it('包含默认的多选快捷键 Shift', () => {
      expect(DEFAULT_SELECTION_CONFIG.multiSelectionKeyCode).toBe('Shift');
    });

    it('包含默认的框选快捷键 Meta', () => {
      expect(DEFAULT_SELECTION_CONFIG.selectionKeyCode).toBe('Meta');
    });

    it('默认启用框选', () => {
      expect(DEFAULT_SELECTION_CONFIG.selectionOnDrag).toBe(true);
    });

    it('默认框选模式为 partial', () => {
      expect(DEFAULT_SELECTION_CONFIG.selectionMode).toBe('partial');
    });

    it('默认节点可选', () => {
      expect(DEFAULT_SELECTION_CONFIG.nodesSelectable).toBe(true);
    });

    it('默认边可选', () => {
      expect(DEFAULT_SELECTION_CONFIG.edgesSelectable).toBe(true);
    });

    it('默认 selectNodesOnDrag 启用', () => {
      expect(DEFAULT_SELECTION_CONFIG.selectNodesOnDrag).toBe(true);
    });
  });

  describe('useBlueprintSelection', () => {
    it('返回默认 config', () => {
      const { result } = renderHook(() => useBlueprintSelection());
      expect(result.current.config).toEqual(DEFAULT_SELECTION_CONFIG);
    });

    it('支持通过 configOverrides 覆盖配置', () => {
      const { result } = renderHook(() =>
        useBlueprintSelection({
          configOverrides: {
            selectionOnDrag: false,
            selectionMode: 'full',
            multiSelectionKeyCode: 'Control',
          },
        }),
      );
      expect(result.current.config.selectionOnDrag).toBe(false);
      expect(result.current.config.selectionMode).toBe('full');
      expect(result.current.config.multiSelectionKeyCode).toBe('Control');
    });

    it('configOverrides 仅覆盖指定字段，保留其他默认值', () => {
      const { result } = renderHook(() =>
        useBlueprintSelection({
          configOverrides: { selectionOnDrag: false },
        }),
      );
      expect(result.current.config.selectionOnDrag).toBe(false);
      // 其他字段保留默认
      expect(result.current.config.selectionMode).toBe('partial');
      expect(result.current.config.multiSelectionKeyCode).toBe('Shift');
      expect(result.current.config.selectionKeyCode).toBe('Meta');
      expect(result.current.config.nodesSelectable).toBe(true);
      expect(result.current.config.edgesSelectable).toBe(true);
      expect(result.current.config.selectNodesOnDrag).toBe(true);
    });

    it('未按下按键时不触发 onSelectAll 回调', () => {
      const onSelectAll = vi.fn();
      renderHook(() => useBlueprintSelection({ onSelectAll }));
      expect(onSelectAll).not.toHaveBeenCalled();
    });

    it('未按下按键时不触发 onDelete 回调', () => {
      const onDelete = vi.fn();
      renderHook(() => useBlueprintSelection({ onDelete }));
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('按下 Control+a 时触发 onSelectAll 回调', () => {
      const onSelectAll = vi.fn();
      renderHook(() => useBlueprintSelection({ onSelectAll }));

      act(() => {
        // useKeyPress 需要分别按下 Control 和 a 两个键才能匹配组合键
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Control',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      });

      expect(onSelectAll).toHaveBeenCalled();
    });

    it('按下 Meta+a 时触发 onSelectAll 回调', () => {
      const onSelectAll = vi.fn();
      renderHook(() => useBlueprintSelection({ onSelectAll }));

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Meta',
            metaKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a',
            metaKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      });

      expect(onSelectAll).toHaveBeenCalled();
    });

    it('按下 Delete 时触发 onDelete 回调', () => {
      const onDelete = vi.fn();
      renderHook(() => useBlueprintSelection({ onDelete }));

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(event);
      });

      expect(onDelete).toHaveBeenCalled();
    });

    it('按下 Backspace 时触发 onDelete 回调', () => {
      const onDelete = vi.fn();
      renderHook(() => useBlueprintSelection({ onDelete }));

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Backspace',
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(event);
      });

      expect(onDelete).toHaveBeenCalled();
    });

    it('未提供 onSelectAll 时不抛错', () => {
      expect(() => {
        renderHook(() => useBlueprintSelection());
        act(() => {
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Control',
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
            }),
          );
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'a',
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
            }),
          );
        });
      }).not.toThrow();
    });

    it('未提供 onDelete 时不抛错', () => {
      expect(() => {
        renderHook(() => useBlueprintSelection());
        act(() => {
          const event = new KeyboardEvent('keydown', {
            key: 'Delete',
            bubbles: true,
            cancelable: true,
          });
          document.dispatchEvent(event);
        });
      }).not.toThrow();
    });

    it('未注册快捷键时不触发回调', () => {
      const onSelectAll = vi.fn();
      const onDelete = vi.fn();
      renderHook(() => useBlueprintSelection({ onSelectAll, onDelete }));

      // 按下未注册的键
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'b',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(event);
      });

      expect(onSelectAll).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('回调 ref 变化时使用最新引用', () => {
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      const { rerender } = renderHook(({ onSelectAll }) => useBlueprintSelection({ onSelectAll }), {
        initialProps: { onSelectAll: firstCallback },
      });

      rerender({ onSelectAll: secondCallback });

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Control',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      });

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalled();
    });
  });

  describe('键盘事件清理', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      // 确保 keyup 事件清理按键状态
      document.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'a', ctrlKey: true, bubbles: true }),
      );
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', bubbles: true }));
    });

    it('组件卸载后不再响应按键', () => {
      const onSelectAll = vi.fn();
      const { unmount } = renderHook(() => useBlueprintSelection({ onSelectAll }));

      unmount();

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'a',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(event);
      });

      expect(onSelectAll).not.toHaveBeenCalled();
    });
  });
});
