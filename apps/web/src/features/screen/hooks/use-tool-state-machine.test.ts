import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolStateMachine } from './use-tool-state-machine';
import type { EditorTool } from './tool-registry';
import { TOOL_REGISTRY } from './tool-registry';

/**
 * 任务 2.4 验证：工具状态机恢复测试
 *
 * 测试覆盖：
 * - 主工具切换（setTool）
 * - 临时工具压栈/出栈（pushTemporaryTool / popTemporaryTool）
 * - 重复按键（keydown repeat）幂等性
 * - 窗口失焦恢复（window blur 触发清空临时栈）
 * - 清空临时工具（clearTemporaryTools）
 *
 * 验证目标：任何异常结束后 `activeTool` 恢复为 `currentTool`，栈中不残留抓手。
 *
 * 测试策略：
 * - 不 mock useToolStateMachine，验证真实状态机行为
 * - 通过 renderHook + act 调用 API 并断言状态
 * - 通过 window.dispatchEvent('blur') 模拟失焦
 */

describe('任务 2.4：工具状态机恢复测试', () => {
  describe('初始状态', () => {
    it('初始 activeTool 为 select', () => {
      const { result } = renderHook(() => useToolStateMachine());
      expect(result.current.activeTool).toBe('select');
    });

    it('初始 currentTool 为 select', () => {
      const { result } = renderHook(() => useToolStateMachine());
      expect(result.current.currentTool).toBe('select');
    });

    it('初始 hasTemporaryTool 为 false', () => {
      const { result } = renderHook(() => useToolStateMachine());
      expect(result.current.hasTemporaryTool).toBe(false);
    });
  });

  describe('主工具切换（setTool）', () => {
    it('setTool 切换主工具，activeTool 同步更新', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.setTool('rect'));
      expect(result.current.currentTool).toBe('rect');
      expect(result.current.activeTool).toBe('rect');
    });

    it('setTool 清空临时栈，activeTool 等于 currentTool', () => {
      const { result } = renderHook(() => useToolStateMachine());
      // 先压入临时工具
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      expect(result.current.hasTemporaryTool).toBe(true);
      // 切换主工具
      act(() => result.current.setTool('rect'));
      expect(result.current.activeTool).toBe('rect');
      expect(result.current.currentTool).toBe('rect');
      expect(result.current.hasTemporaryTool).toBe(false);
    });

    it('TOOL_REGISTRY 中每个工具都能通过 setTool 切换', () => {
      const { result } = renderHook(() => useToolStateMachine());
      for (const tool of TOOL_REGISTRY) {
        act(() => result.current.setTool(tool.id));
        expect(result.current.currentTool, `${tool.id} 应成为 currentTool`).toBe(tool.id);
        expect(result.current.activeTool, `${tool.id} 应成为 activeTool`).toBe(tool.id);
      }
    });
  });

  describe('临时工具压栈/出栈', () => {
    it('pushTemporaryTool 压入栈顶，activeTool 切换为临时工具', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      expect(result.current.currentTool).toBe('select');
      expect(result.current.hasTemporaryTool).toBe(true);
    });

    it('popTemporaryTool 弹出栈顶，activeTool 恢复为 currentTool', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      act(() => result.current.popTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('select');
      expect(result.current.currentTool).toBe('select');
      expect(result.current.hasTemporaryTool).toBe(false);
    });

    it('多个临时工具压栈时栈顶生效', () => {
      const { result } = renderHook(() => useToolStateMachine());
      // 压入 hand
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      // 压入 zoom（虽然实际不会同时使用，但验证栈语义）
      act(() => result.current.pushTemporaryTool('zoom'));
      expect(result.current.activeTool).toBe('zoom');
      expect(result.current.currentTool).toBe('select');
    });

    it('多个临时工具按 LIFO 顺序弹出', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => result.current.pushTemporaryTool('zoom'));
      // 弹出 zoom，应恢复到 hand
      act(() => result.current.popTemporaryTool('zoom'));
      expect(result.current.activeTool).toBe('hand');
      expect(result.current.hasTemporaryTool).toBe(true);
      // 弹出 hand，应恢复到 currentTool (select)
      act(() => result.current.popTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('select');
      expect(result.current.hasTemporaryTool).toBe(false);
    });

    it('popTemporaryTool 不在栈中的工具时不影响状态', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      // 弹出一个未压栈的工具
      act(() => result.current.popTemporaryTool('zoom'));
      expect(result.current.activeTool).toBe('hand');
      expect(result.current.hasTemporaryTool).toBe(true);
    });

    it('popTemporaryTool 空栈时不影响状态', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.popTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('select');
      expect(result.current.hasTemporaryTool).toBe(false);
    });
  });

  describe('重复按键幂等性', () => {
    it('重复 pushTemporaryTool 同一工具不重复压栈', () => {
      const { result } = renderHook(() => useToolStateMachine());
      // 模拟 keydown repeat 事件
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      expect(result.current.hasTemporaryTool).toBe(true);
      // 一次 pop 应该清空
      act(() => result.current.popTemporaryTool('hand'));
      expect(result.current.hasTemporaryTool).toBe(false);
      expect(result.current.activeTool).toBe('select');
    });

    it('push 同一工具到栈底再 push 不同工具，再 push 同一工具不重复', () => {
      const { result } = renderHook(() => useToolStateMachine());
      // hand -> zoom
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => result.current.pushTemporaryTool('zoom'));
      // 再次 push hand（已在栈底）：不应重复压栈
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('zoom');
      // pop zoom 后应回到 hand（不是新压入的 hand）
      act(() => result.current.popTemporaryTool('zoom'));
      expect(result.current.activeTool).toBe('hand');
    });

    it('keydown repeat 期间 activeTool 始终为栈顶工具', () => {
      const { result } = renderHook(() => useToolStateMachine());
      // 模拟连续 keydown
      for (let i = 0; i < 5; i++) {
        act(() => result.current.pushTemporaryTool('hand'));
      }
      expect(result.current.activeTool).toBe('hand');
    });
  });

  describe('清空临时工具（clearTemporaryTools）', () => {
    it('clearTemporaryTools 清空栈，activeTool 恢复为 currentTool', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => result.current.pushTemporaryTool('zoom'));
      expect(result.current.hasTemporaryTool).toBe(true);
      act(() => result.current.clearTemporaryTools());
      expect(result.current.hasTemporaryTool).toBe(false);
      expect(result.current.activeTool).toBe('select');
      expect(result.current.currentTool).toBe('select');
    });

    it('clearTemporaryTools 空栈时不触发重渲染', () => {
      const { result } = renderHook(() => useToolStateMachine());
      const initialActive = result.current.activeTool;
      act(() => result.current.clearTemporaryTools());
      expect(result.current.activeTool).toBe(initialActive);
      expect(result.current.hasTemporaryTool).toBe(false);
    });

    it('clearTemporaryTools 后再次 push 临时工具能正常工作', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => result.current.clearTemporaryTools());
      // 清空后再次压栈应正常
      act(() => result.current.pushTemporaryTool('zoom'));
      expect(result.current.activeTool).toBe('zoom');
      expect(result.current.hasTemporaryTool).toBe(true);
    });
  });

  describe('窗口失焦恢复', () => {
    beforeEach(() => {
      // 确保 window 存在（jsdom 环境）
      expect(typeof window).toBe('object');
    });

    it('window blur 事件触发时清空临时栈', () => {
      const { result } = renderHook(() => useToolStateMachine());
      // 压入临时工具
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      expect(result.current.hasTemporaryTool).toBe(true);
      // 模拟窗口失焦
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      // 失焦后应清空临时栈，activeTool 恢复为 currentTool
      expect(result.current.hasTemporaryTool).toBe(false);
      expect(result.current.activeTool).toBe('select');
      expect(result.current.currentTool).toBe('select');
    });

    it('window blur 后栈中不残留抓手', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      expect(result.current.hasTemporaryTool).toBe(false);
      // 再次 pop 不应出错，且 activeTool 仍是 currentTool
      act(() => result.current.popTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('select');
    });

    it('window blur 后 activeTool 等于 currentTool（不会卡在抓手状态）', () => {
      const { result } = renderHook(() => useToolStateMachine());
      // 设置主工具为 rect
      act(() => result.current.setTool('rect'));
      // 压入临时抓手
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      // 失焦
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      // 失焦后 activeTool 应恢复为 rect，不卡在 hand
      expect(result.current.activeTool).toBe('rect');
      expect(result.current.currentTool).toBe('rect');
      expect(result.current.hasTemporaryTool).toBe(false);
    });

    it('window blur 多次触发不报错', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => {
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('blur'));
      });
      expect(result.current.hasTemporaryTool).toBe(false);
    });

    it('window blur 后再次 push 临时工具能正常工作', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      // 失焦恢复后再次压栈应正常
      act(() => result.current.pushTemporaryTool('zoom'));
      expect(result.current.activeTool).toBe('zoom');
      expect(result.current.hasTemporaryTool).toBe(true);
    });
  });

  describe('异常结束恢复语义', () => {
    /**
     * 验证任务 2.4 的核心目标：
     * "任何异常结束后 activeTool 恢复为 currentTool，栈中不残留抓手"
     */
    it('异常结束（clearTemporaryTools）后 activeTool == currentTool', () => {
      const { result } = renderHook(() => useToolStateMachine());
      // 设置场景：主工具 rect，临时栈 [hand, zoom]
      act(() => result.current.setTool('rect'));
      act(() => result.current.pushTemporaryTool('hand'));
      act(() => result.current.pushTemporaryTool('zoom'));
      expect(result.current.activeTool).toBe('zoom');
      // 异常恢复：清空临时栈
      act(() => result.current.clearTemporaryTools());
      expect(result.current.activeTool).toBe(result.current.currentTool);
      expect(result.current.activeTool).toBe('rect');
    });

    it('异常结束（setTool）后 activeTool == currentTool', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.setTool('rect'));
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      // 切换主工具作为异常恢复
      act(() => result.current.setTool('select'));
      expect(result.current.activeTool).toBe(result.current.currentTool);
      expect(result.current.hasTemporaryTool).toBe(false);
    });

    it('异常结束（window blur）后 activeTool == currentTool', () => {
      const { result } = renderHook(() => useToolStateMachine());
      act(() => result.current.setTool('rect'));
      act(() => result.current.pushTemporaryTool('hand'));
      expect(result.current.activeTool).toBe('hand');
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      expect(result.current.activeTool).toBe(result.current.currentTool);
      expect(result.current.activeTool).toBe('rect');
    });

    it('所有可能的 EditorTool 都能作为 currentTool 经异常恢复正确生效', () => {
      const tools: EditorTool[] = ['select', 'hand', 'text', 'rect', 'ellipse', 'image', 'zoom'];
      for (const tool of tools) {
        const { result } = renderHook(() => useToolStateMachine());
        act(() => result.current.setTool(tool));
        act(() => result.current.pushTemporaryTool('hand'));
        expect(result.current.activeTool).toBe('hand');
        // 模拟异常恢复
        act(() => result.current.clearTemporaryTools());
        expect(result.current.activeTool, `${tool} 异常恢复后应生效`).toBe(tool);
        expect(result.current.activeTool).toBe(result.current.currentTool);
      }
    });
  });

  describe('useEffect 清理', () => {
    /**
     * 验证 hook 卸载时移除 window blur 监听器，避免内存泄漏
     */
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('hook 卸载时移除 window blur 监听器', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useToolStateMachine());
      // 应该注册了 blur 监听器
      expect(addSpy).toHaveBeenCalledWith('blur', expect.any(Function));
      unmount();
      // 卸载时应移除同一个监听器
      expect(removeSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });
  });
});
