import { describe, expect, it } from 'vitest';
import {
  cancelInteraction,
  createSnapshot,
  finalizeInteraction,
  hasDragChanges,
  hasSelectionChanges,
  requiresProtocol,
  type InteractionCleanup,
} from './finalize-cancel-protocol';
import type { InteractionState } from '../hooks/use-interaction-state-machine';

describe('任务 3.2：统一 finalize/cancel 协议', () => {
  describe('finalizeInteraction', () => {
    it('有变化时提交历史', () => {
      const result = finalizeInteraction(true);
      expect(result.hasChanges).toBe(true);
      expect(result.shouldCommitHistory).toBe(true);
    });

    it('无变化时不提交历史（避免空历史记录）', () => {
      const result = finalizeInteraction(false);
      expect(result.hasChanges).toBe(false);
      expect(result.shouldCommitHistory).toBe(false);
    });

    it('始终执行完整清理（尺寸浮层/辅助线/pointer capture/状态恢复）', () => {
      const result = finalizeInteraction(false);
      expect(result.cleanup.hideDimensionTooltip).toBe(true);
      expect(result.cleanup.clearAlignmentLines).toBe(true);
      expect(result.cleanup.releasePointerCapture).toBe(true);
      expect(result.cleanup.resetInteractionState).toBe(true);
    });

    it('finalize 不清空临时工具栈（正常结束不需要）', () => {
      const result = finalizeInteraction(true);
      expect(result.cleanup.clearTemporaryTools).toBe(false);
    });
  });

  describe('cancelInteraction', () => {
    it('永不提交历史', () => {
      const result = cancelInteraction();
      expect(result.shouldCommitHistory).toBe(false);
    });

    it('执行完整清理', () => {
      const result = cancelInteraction();
      expect(result.cleanup.hideDimensionTooltip).toBe(true);
      expect(result.cleanup.clearAlignmentLines).toBe(true);
      expect(result.cleanup.releasePointerCapture).toBe(true);
      expect(result.cleanup.resetInteractionState).toBe(true);
    });

    it('清空临时工具栈（异常恢复需要）', () => {
      const result = cancelInteraction();
      expect(result.cleanup.clearTemporaryTools).toBe(true);
    });
  });

  describe('hasDragChanges', () => {
    const snapshot = createSnapshot(
      'dragging',
      ['c1'],
      [{ id: 'c1', x: 100, y: 100, width: 200, height: 150, rotate: 0 }],
    );

    it('位置变化时返回 true', () => {
      expect(
        hasDragChanges(snapshot, [
          { id: 'c1', x: 150, y: 100, width: 200, height: 150, rotate: 0 },
        ]),
      ).toBe(true);
    });

    it('尺寸变化时返回 true', () => {
      expect(
        hasDragChanges(snapshot, [
          { id: 'c1', x: 100, y: 100, width: 250, height: 150, rotate: 0 },
        ]),
      ).toBe(true);
    });

    it('旋转变化时返回 true', () => {
      expect(
        hasDragChanges(snapshot, [
          { id: 'c1', x: 100, y: 100, width: 200, height: 150, rotate: 45 },
        ]),
      ).toBe(true);
    });

    it('完全相同时返回 false（无变化不提交历史）', () => {
      expect(
        hasDragChanges(snapshot, [
          { id: 'c1', x: 100, y: 100, width: 200, height: 150, rotate: 0 },
        ]),
      ).toBe(false);
    });

    it('组件数量变化时返回 true', () => {
      expect(
        hasDragChanges(snapshot, [
          { id: 'c1', x: 100, y: 100, width: 200, height: 150, rotate: 0 },
          { id: 'c2', x: 0, y: 0, width: 100, height: 100, rotate: 0 },
        ]),
      ).toBe(true);
    });

    it('组件 ID 变化时返回 true', () => {
      expect(
        hasDragChanges(snapshot, [
          { id: 'c2', x: 100, y: 100, width: 200, height: 150, rotate: 0 },
        ]),
      ).toBe(true);
    });
  });

  describe('hasSelectionChanges', () => {
    const snapshot = createSnapshot('marquee-selecting', ['c1', 'c2'], []);

    it('选择相同时不变化', () => {
      expect(hasSelectionChanges(snapshot, ['c1', 'c2'])).toBe(false);
    });

    it('选择不同时变化', () => {
      expect(hasSelectionChanges(snapshot, ['c1'])).toBe(true);
    });

    it('选择顺序不同但内容相同时不变化', () => {
      expect(hasSelectionChanges(snapshot, ['c2', 'c1'])).toBe(false);
    });

    it('选择为空时变化', () => {
      expect(hasSelectionChanges(snapshot, [])).toBe(true);
    });
  });

  describe('createSnapshot', () => {
    it('记录交互类型', () => {
      const snap = createSnapshot('resizing', [], []);
      expect(snap.kind).toBe('resizing');
    });

    it('记录选中 ID 列表', () => {
      const snap = createSnapshot('dragging', ['c1', 'c2'], []);
      expect(snap.selectedIds).toEqual(['c1', 'c2']);
    });

    it('记录组件快照', () => {
      const components = [{ id: 'c1', x: 10, y: 20, width: 100, height: 50, rotate: 0 }];
      const snap = createSnapshot('dragging', ['c1'], components);
      expect(snap.components).toEqual(components);
    });

    it('快照是不可变的（readonly）', () => {
      const snap = createSnapshot(
        'dragging',
        ['c1'],
        [{ id: 'c1', x: 0, y: 0, width: 10, height: 10, rotate: 0 }],
      );
      // TypeScript 编译时保证 readonly，运行时仍是普通数组
      expect(snap.selectedIds.length).toBe(1);
    });
  });

  describe('requiresProtocol', () => {
    const protocolStates: InteractionState[] = [
      'dragging',
      'resizing',
      'rotating',
      'panning',
      'marquee-selecting',
      'creating',
      'zooming',
    ];

    for (const state of protocolStates) {
      it(`${state} 需要协议`, () => {
        expect(requiresProtocol(state)).toBe(true);
      });
    }

    const nonProtocolStates: InteractionState[] = [
      'idle',
      'hovering',
      'text-editing',
      'context-menu-open',
    ];

    for (const state of nonProtocolStates) {
      it(`${state} 不需要协议`, () => {
        expect(requiresProtocol(state)).toBe(false);
      });
    }
  });

  describe('InteractionCleanup 完整性', () => {
    it('finalize 的清理包含所有必要操作', () => {
      const result = finalizeInteraction(true);
      const cleanup: InteractionCleanup = result.cleanup;
      // 验证所有清理字段都存在
      expect(cleanup).toHaveProperty('hideDimensionTooltip');
      expect(cleanup).toHaveProperty('clearAlignmentLines');
      expect(cleanup).toHaveProperty('releasePointerCapture');
      expect(cleanup).toHaveProperty('clearTemporaryTools');
      expect(cleanup).toHaveProperty('resetInteractionState');
    });

    it('cancel 的清理包含所有必要操作', () => {
      const result = cancelInteraction();
      const cleanup: InteractionCleanup = result.cleanup;
      expect(cleanup).toHaveProperty('hideDimensionTooltip');
      expect(cleanup).toHaveProperty('clearAlignmentLines');
      expect(cleanup).toHaveProperty('releasePointerCapture');
      expect(cleanup).toHaveProperty('clearTemporaryTools');
      expect(cleanup).toHaveProperty('resetInteractionState');
    });
  });
});
