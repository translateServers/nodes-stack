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

    it('text-editing + escape → idle', () => {
      expect(transition('text-editing', 'escape')).toBe('idle');
    });

    it('text-editing + commit → idle', () => {
      expect(transition('text-editing', 'commit')).toBe('idle');
    });

    it('idle + open-context-menu → context-menu-open', () => {
      expect(transition('idle', 'open-context-menu')).toBe('context-menu-open');
    });

    it('context-menu-open + close-context-menu → idle', () => {
      expect(transition('context-menu-open', 'close-context-menu')).toBe('idle');
    });

    it('context-menu-open + escape → idle', () => {
      expect(transition('context-menu-open', 'escape')).toBe('idle');
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

  describe('任务 3.1：cancel 事件（任意瞬时状态恢复）', () => {
    const nonIdleStates: InteractionState[] = [
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

    for (const state of nonIdleStates) {
      it(`${state} + cancel → idle`, () => {
        expect(transition(state, 'cancel')).toBe('idle');
      });
    }

    it('idle + cancel → idle（idle 状态保持不变）', () => {
      expect(transition('idle', 'cancel')).toBe('idle');
    });

    it('cancel 在 dragging 状态下优先于 pointer-up（中断拖拽）', () => {
      expect(transition('dragging', 'cancel')).toBe('idle');
    });

    it('cancel 在 creating 状态下中断创建（不提交）', () => {
      expect(transition('creating', 'cancel')).toBe('idle');
    });

    it('cancel 在 text-editing 状态下退出文本编辑（文本编辑优先退出）', () => {
      expect(transition('text-editing', 'cancel')).toBe('idle');
    });
  });

  describe('任务 3.1：window-blur 事件（任意瞬时状态恢复）', () => {
    const nonIdleStates: InteractionState[] = [
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

    for (const state of nonIdleStates) {
      it(`${state} + window-blur → idle`, () => {
        expect(transition(state, 'window-blur')).toBe('idle');
      });
    }

    it('idle + window-blur → idle（idle 状态保持不变）', () => {
      expect(transition('idle', 'window-blur')).toBe('idle');
    });

    it('window-blur 在 text-editing 状态下退出文本编辑', () => {
      expect(transition('text-editing', 'window-blur')).toBe('idle');
    });
  });

  describe('任务 3.1：pointer-cancel 事件（pointer 捕获态恢复）', () => {
    const pointerCaptureStates: InteractionState[] = [
      'marquee-selecting',
      'dragging',
      'resizing',
      'rotating',
      'panning',
      'creating',
    ];

    for (const state of pointerCaptureStates) {
      it(`${state} + pointer-cancel → idle`, () => {
        expect(transition(state, 'pointer-cancel')).toBe('idle');
      });
    }

    it('idle + pointer-cancel → idle（idle 状态保持不变）', () => {
      expect(transition('idle', 'pointer-cancel')).toBe('idle');
    });

    it('hovering + pointer-cancel → hovering（非 pointer 捕获态不响应）', () => {
      expect(transition('hovering', 'pointer-cancel')).toBe('hovering');
    });

    it('text-editing + pointer-cancel → text-editing（文本编辑不响应 pointer-cancel）', () => {
      expect(transition('text-editing', 'pointer-cancel')).toBe('text-editing');
    });

    it('context-menu-open + pointer-cancel → context-menu-open（菜单不响应 pointer-cancel）', () => {
      expect(transition('context-menu-open', 'pointer-cancel')).toBe('context-menu-open');
    });

    it('zooming + pointer-cancel → zooming（缩放不响应 pointer-cancel）', () => {
      expect(transition('zooming', 'pointer-cancel')).toBe('zooming');
    });
  });

  describe('任务 3.1：lost-pointer-capture 事件（pointer 捕获态恢复）', () => {
    const pointerCaptureStates: InteractionState[] = [
      'marquee-selecting',
      'dragging',
      'resizing',
      'rotating',
      'panning',
      'creating',
    ];

    for (const state of pointerCaptureStates) {
      it(`${state} + lost-pointer-capture → idle`, () => {
        expect(transition(state, 'lost-pointer-capture')).toBe('idle');
      });
    }

    it('idle + lost-pointer-capture → idle', () => {
      expect(transition('idle', 'lost-pointer-capture')).toBe('idle');
    });

    it('text-editing + lost-pointer-capture → text-editing（文本编辑不响应）', () => {
      expect(transition('text-editing', 'lost-pointer-capture')).toBe('text-editing');
    });

    it('context-menu-open + lost-pointer-capture → context-menu-open（菜单不响应）', () => {
      expect(transition('context-menu-open', 'lost-pointer-capture')).toBe('context-menu-open');
    });
  });

  describe('任务 3.1：文本编辑优先退出语义', () => {
    /**
     * 验证任务 3.1 的核心目标：
     * "文本编辑优先退出" - text-editing 状态对全局恢复事件响应（escape/commit/cancel/window-blur），
     * 对其他事件保持 text-editing 状态，避免画布交互打断文本输入。
     */
    it('text-editing + escape → idle（escape 退出）', () => {
      expect(transition('text-editing', 'escape')).toBe('idle');
    });

    it('text-editing + commit → idle（commit 提交退出）', () => {
      expect(transition('text-editing', 'commit')).toBe('idle');
    });

    it('text-editing + cancel → idle（cancel 强制退出）', () => {
      expect(transition('text-editing', 'cancel')).toBe('idle');
    });

    it('text-editing + window-blur → idle（窗口失焦退出）', () => {
      expect(transition('text-editing', 'window-blur')).toBe('idle');
    });

    it('text-editing + pointer-down → text-editing（不响应画布指针）', () => {
      expect(transition('text-editing', 'pointer-down')).toBe('text-editing');
    });

    it('text-editing + pointer-up → text-editing（不响应画布指针）', () => {
      expect(transition('text-editing', 'pointer-up')).toBe('text-editing');
    });

    it('text-editing + start-drag → text-editing（不响应拖拽开始）', () => {
      expect(transition('text-editing', 'start-drag')).toBe('text-editing');
    });

    it('text-editing + start-create → text-editing（不响应创建开始）', () => {
      expect(transition('text-editing', 'start-create')).toBe('text-editing');
    });

    it('text-editing + start-pan → text-editing（不响应平移开始）', () => {
      expect(transition('text-editing', 'start-pan')).toBe('text-editing');
    });

    it('text-editing + double-click → text-editing（已在编辑时不重入）', () => {
      expect(transition('text-editing', 'double-click')).toBe('text-editing');
    });

    it('text-editing + pointer-cancel → text-editing（不响应 pointer 取消）', () => {
      expect(transition('text-editing', 'pointer-cancel')).toBe('text-editing');
    });

    it('text-editing + lost-pointer-capture → text-editing（不响应 pointer 丢失）', () => {
      expect(transition('text-editing', 'lost-pointer-capture')).toBe('text-editing');
    });

    it('text-editing + open-context-menu → text-editing（不响应右键菜单）', () => {
      expect(transition('text-editing', 'open-context-menu')).toBe('text-editing');
    });
  });

  describe('任务 3.1：任意瞬时状态恢复矩阵', () => {
    /**
     * 验证全局恢复事件矩阵：
     * - escape / cancel / window-blur 对所有非 idle 状态都恢复到 idle
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

    // 全局恢复事件：所有非 idle 状态都恢复到 idle
    for (const event of globalRecoveryEvents) {
      for (const state of allStates) {
        const expected: InteractionState = state === 'idle' ? 'idle' : 'idle';
        it(`${state} + ${event} → ${expected}`, () => {
          expect(transition(state, event)).toBe(expected);
        });
      }
    }

    // pointer 恢复事件：仅 pointer 捕获态恢复到 idle
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

  describe('非法转换（保持当前状态）', () => {
    it('idle + pointer-up → idle（idle 状态无指针释放动作）', () => {
      expect(transition('idle', 'pointer-up')).toBe('idle');
    });

    it('dragging + double-click → dragging（拖拽中不能直接进入文本编辑）', () => {
      expect(transition('dragging', 'double-click')).toBe('dragging');
    });

    it('text-editing + pointer-down → text-editing（文本编辑态不响应画布指针）', () => {
      expect(transition('text-editing', 'pointer-down')).toBe('text-editing');
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
