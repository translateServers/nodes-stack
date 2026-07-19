import { describe, expect, it, vi, beforeEach } from 'vitest';

import { transition, resetIllegalTransitionWarnCache } from './use-interaction-state-machine';
import type { InteractionState, InteractionEvent } from './use-interaction-state-machine';

describe('transition（交互状态机纯函数）', () => {
  describe('合法转换', () => {
    it('idle + pointer-enter → hovering', () => {
      expect(transition('idle', 'pointer-enter')).toBe('hovering');
    });

    it('hovering + pointer-leave → idle', () => {
      expect(transition('hovering', 'pointer-leave')).toBe('idle');
    });

    it('idle + pointer-down → marquee-selecting（无 payload）', () => {
      expect(transition('idle', 'pointer-down')).toBe('marquee-selecting');
    });

    it('idle + pointer-down（isPanGesture=true）→ panning', () => {
      expect(transition('idle', 'pointer-down', { isPanGesture: true })).toBe('panning');
    });

    it('hovering + pointer-down → marquee-selecting', () => {
      expect(transition('hovering', 'pointer-down')).toBe('marquee-selecting');
    });

    it('hovering + pointer-down（isPanGesture=true）→ panning', () => {
      expect(transition('hovering', 'pointer-down', { isPanGesture: true })).toBe('panning');
    });

    it('marquee-selecting + start-drag → dragging', () => {
      expect(transition('marquee-selecting', 'start-drag')).toBe('dragging');
    });

    it('idle + start-drag → dragging（任务 12.1：Moveable 可从 idle 直接开始拖拽）', () => {
      expect(transition('idle', 'start-drag')).toBe('dragging');
    });

    it('hovering + start-drag → dragging（任务 12.1：hovering 也可直接开始拖拽）', () => {
      expect(transition('hovering', 'start-drag')).toBe('dragging');
    });

    it('marquee-selecting + double-click → text-editing（任务 12.3：Selecto onSelectEnd 双击文本）', () => {
      expect(transition('marquee-selecting', 'double-click')).toBe('text-editing');
    });

    it('marquee-selecting + pointer-up → idle', () => {
      expect(transition('marquee-selecting', 'pointer-up')).toBe('idle');
    });

    it('dragging + pointer-up → idle', () => {
      expect(transition('dragging', 'pointer-up')).toBe('idle');
    });

    it('idle + start-resize → resizing', () => {
      expect(transition('idle', 'start-resize')).toBe('resizing');
    });

    it('resizing + pointer-up → idle', () => {
      expect(transition('resizing', 'pointer-up')).toBe('idle');
    });

    it('idle + start-rotate → rotating', () => {
      expect(transition('idle', 'start-rotate')).toBe('rotating');
    });

    it('rotating + pointer-up → idle', () => {
      expect(transition('rotating', 'pointer-up')).toBe('idle');
    });

    it('idle + start-pan → panning', () => {
      expect(transition('idle', 'start-pan')).toBe('panning');
    });

    it('panning + pointer-up → idle', () => {
      expect(transition('panning', 'pointer-up')).toBe('idle');
    });

    it('idle + start-zoom → zooming', () => {
      expect(transition('idle', 'start-zoom')).toBe('zooming');
    });

    it('zooming + end-zoom → idle', () => {
      expect(transition('zooming', 'end-zoom')).toBe('idle');
    });

    it('idle + double-click → text-editing', () => {
      expect(transition('idle', 'double-click')).toBe('text-editing');
    });

    it('hovering + double-click → text-editing', () => {
      expect(transition('hovering', 'double-click')).toBe('text-editing');
    });

    // text-editing + escape / context-menu-open + escape 由恢复矩阵覆盖，此处不重复

    it('text-editing + commit → idle', () => {
      expect(transition('text-editing', 'commit')).toBe('idle');
    });

    it('idle + open-context-menu → context-menu-open', () => {
      expect(transition('idle', 'open-context-menu')).toBe('context-menu-open');
    });

    it('context-menu-open + close-context-menu → idle', () => {
      expect(transition('context-menu-open', 'close-context-menu')).toBe('idle');
    });

    it('marquee-selecting + open-context-menu → context-menu-open', () => {
      expect(transition('marquee-selecting', 'open-context-menu')).toBe('context-menu-open');
    });

    it('完整流程：idle → hovering → marquee-selecting → dragging → idle', () => {
      let state = transition('idle', 'pointer-enter');
      expect(state).toBe('hovering');
      state = transition(state, 'pointer-down');
      expect(state).toBe('marquee-selecting');
      state = transition(state, 'start-drag');
      expect(state).toBe('dragging');
      state = transition(state, 'pointer-up');
      expect(state).toBe('idle');
    });

    it('完整流程：idle → text-editing → idle（escape 退出）', () => {
      let state = transition('idle', 'double-click');
      expect(state).toBe('text-editing');
      state = transition(state, 'escape');
      expect(state).toBe('idle');
    });
  });

  describe('任务 3.1：创建态（creating）转换', () => {
    it('idle + start-create → creating', () => {
      expect(transition('idle', 'start-create')).toBe('creating');
    });

    it('hovering + start-create → creating', () => {
      expect(transition('hovering', 'start-create')).toBe('creating');
    });

    it('creating + commit-create → idle', () => {
      expect(transition('creating', 'commit-create')).toBe('idle');
    });

    it('creating + pointer-up → idle（拖拽创建释放即提交）', () => {
      expect(transition('creating', 'pointer-up')).toBe('idle');
    });

    it('完整流程：idle → creating → idle（commit-create 提交）', () => {
      let state = transition('idle', 'start-create');
      expect(state).toBe('creating');
      state = transition(state, 'commit-create');
      expect(state).toBe('idle');
    });

    it('完整流程：idle → creating → idle（pointer-up 提交）', () => {
      let state = transition('idle', 'start-create');
      expect(state).toBe('creating');
      state = transition(state, 'pointer-up');
      expect(state).toBe('idle');
    });
  });

  describe('任务 3.1：任意瞬时状态恢复矩阵', () => {
    /**
     * 验证全局恢复事件矩阵（同时覆盖 cancel / window-blur / pointer-cancel /
     * lost-pointer-capture 的逐项恢复语义，替代按事件分区的重复用例）：
     * - escape / cancel / window-blur 对所有状态都恢复到 idle
     * - pointer-cancel / lost-pointer-capture 仅对 pointer 捕获态恢复
     *
     * 任务 13.2：escape 加入全局恢复事件矩阵，修复 Escape 无法退出
     * dragging/resizing/rotating/panning/creating 的 bug。
     */
    const allStates: InteractionState[] = [
      'idle',
      'hovering',
      'marquee-selecting',
      'dragging',
      'resizing',
      'rotating',
      'panning',
      'zooming',
      'text-editing',
      'context-menu-open',
      'creating',
    ];

    const globalRecoveryEvents: InteractionEvent[] = ['escape', 'cancel', 'window-blur'];
    const pointerRecoveryEvents: InteractionEvent[] = ['pointer-cancel', 'lost-pointer-capture'];

    // 全局恢复事件：所有状态（含 idle）都恢复/保持到 idle
    for (const event of globalRecoveryEvents) {
      for (const state of allStates) {
        it(`${state} + ${event} → idle`, () => {
          expect(transition(state, event)).toBe('idle');
        });
      }
    }

    // pointer 恢复事件：仅 pointer 捕获态恢复到 idle，其余状态不响应
    const pointerCaptureStates = new Set<InteractionState>([
      'marquee-selecting',
      'dragging',
      'resizing',
      'rotating',
      'panning',
      'creating',
    ]);
    for (const event of pointerRecoveryEvents) {
      for (const state of allStates) {
        const expected: InteractionState = pointerCaptureStates.has(state) ? 'idle' : state;
        it(`${state} + ${event} → ${expected}`, () => {
          expect(transition(state, event)).toBe(expected);
        });
      }
    }
  });

  describe('任务 3.1：文本编辑优先退出语义', () => {
    /**
     * text-editing 对全局恢复事件的退出（escape/commit/cancel/window-blur）
     * 已由合法转换与恢复矩阵覆盖；此处仅验证画布交互事件不打断文本输入。
     */
    const ignoredEvents: InteractionEvent[] = [
      'pointer-down',
      'pointer-up',
      'start-drag',
      'start-create',
      'start-pan',
      'double-click',
      'open-context-menu',
    ];

    for (const event of ignoredEvents) {
      it(`text-editing + ${event} → text-editing（不响应）`, () => {
        expect(transition('text-editing', event)).toBe('text-editing');
      });
    }
  });

  describe('非法转换（保持当前状态）', () => {
    it('idle + pointer-up → idle（idle 状态无指针释放动作）', () => {
      expect(transition('idle', 'pointer-up')).toBe('idle');
    });

    it('dragging + double-click → dragging（拖拽中不能直接进入文本编辑）', () => {
      expect(transition('dragging', 'double-click')).toBe('dragging');
    });

    it('zooming + start-drag → zooming（缩放进行中不响应拖拽）', () => {
      expect(transition('zooming', 'start-drag')).toBe('zooming');
    });

    it('resizing + end-zoom → resizing（resize 状态不响应 zoom 结束事件）', () => {
      expect(transition('resizing', 'end-zoom')).toBe('resizing');
    });

    it('panning + start-rotate → panning（平移中不响应旋转开始）', () => {
      expect(transition('panning', 'start-rotate')).toBe('panning');
    });

    it('context-menu-open + start-drag → context-menu-open（菜单打开时不开始拖拽）', () => {
      expect(transition('context-menu-open', 'start-drag')).toBe('context-menu-open');
    });

    it('creating + start-drag → creating（创建中不响应拖拽开始）', () => {
      expect(transition('creating', 'start-drag')).toBe('creating');
    });

    it('creating + double-click → text-editing（文字工具单击创建后双击进入编辑）', () => {
      // 文字工具单击创建：handleCreateText 先派发 start-create（idle → creating），
      // 再派发 double-click 进入文本编辑态。缺少此规则时状态卡在 creating，
      // 导致文字工具完全不可用。
      expect(transition('creating', 'double-click')).toBe('text-editing');
    });

    it('dragging + start-create → dragging（拖拽中不响应创建开始）', () => {
      expect(transition('dragging', 'start-create')).toBe('dragging');
    });
  });

  describe('payload 处理', () => {
    it('pointer-down 在 idle 状态下传入 hitComponent=true 仍走 marquee-selecting', () => {
      expect(transition('idle', 'pointer-down', { hitComponent: true })).toBe('marquee-selecting');
    });

    it('pointer-down 在 idle 状态下传入 isPanGesture=false 走 marquee-selecting', () => {
      expect(transition('idle', 'pointer-down', { isPanGesture: false })).toBe('marquee-selecting');
    });

    it('pointer-down 在 marquee-selecting 状态下忽略 payload（不走特殊分支）', () => {
      expect(transition('marquee-selecting', 'pointer-down', { isPanGesture: true })).toBe(
        'marquee-selecting',
      );
    });

    it('pointer-down 在 dragging 状态下保持原状态（不响应）', () => {
      expect(transition('dragging', 'pointer-down', { isPanGesture: true })).toBe('dragging');
    });
  });

  describe('非法转换诊断去重（L3）', () => {
    beforeEach(() => {
      resetIllegalTransitionWarnCache();
      vi.restoreAllMocks();
    });

    it('相同 (state, event) 组合在时间窗口内仅警告一次', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // 'idle + pointer-up' 为非法转换（保持 idle）
      transition('idle', 'pointer-up');
      transition('idle', 'pointer-up');
      transition('idle', 'pointer-up');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('不同 (state, event) 组合各自独立警告', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      transition('idle', 'pointer-up');
      transition('dragging', 'double-click');
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });

    it('超出时间窗口后相同组合再次警告', () => {
      vi.useFakeTimers();
      try {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        transition('idle', 'pointer-up');
        expect(warnSpy).toHaveBeenCalledTimes(1);
        // 窗口内：不重复警告
        vi.setSystemTime(Date.now() + 500);
        transition('idle', 'pointer-up');
        expect(warnSpy).toHaveBeenCalledTimes(1);
        // 超出窗口（1000ms）：再次警告
        vi.setSystemTime(Date.now() + 600);
        transition('idle', 'pointer-up');
        expect(warnSpy).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
