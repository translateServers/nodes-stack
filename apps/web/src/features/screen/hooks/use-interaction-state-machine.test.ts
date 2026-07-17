import { describe, expect, it } from 'vitest';

import { transition } from './use-interaction-state-machine';

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

  describe('非法转换（保持当前状态）', () => {
    it('idle + pointer-up → idle（idle 状态无指针释放动作）', () => {
      expect(transition('idle', 'pointer-up')).toBe('idle');
    });

    it('idle + start-drag → idle（drag 必须先经过 marquee-selecting）', () => {
      expect(transition('idle', 'start-drag')).toBe('idle');
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
});
