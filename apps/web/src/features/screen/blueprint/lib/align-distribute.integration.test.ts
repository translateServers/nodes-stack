/**
 * 对齐分布与历史栈集成测试（任务 9.4）
 *
 * 验证 spec 要求：
 * - 对齐/分布产生的节点位置变化作为一条本地编辑历史入栈
 * - 无变化（已对齐/已分布）不入栈，避免空历史
 *
 * 集成路径（模拟 Sheet 中的 handleAlign/handleDistribute）：
 *   alignNodes(selectedAlignNodes, mode) → applyAlignResultToNodes(rfNodes, items)
 *   → 调用方 Sheet 调用 useScreenEditorStore.getState().updateBlueprint(nextBlueprint)
 *   → updateBlueprint 内部 pushHistory 推入 1 条历史快照（修改前状态）
 *
 * 本测试通过真实 editor-store + 纯函数验证，不依赖 ReactFlow mock。
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { CanvasConfig, EventBlueprint, ScreenProject } from '@nebula/shared';

import { useScreenEditorStore } from '../../stores/editor-store';
import {
  alignNodes,
  applyAlignResultToNodes,
  distributeNodes,
  type AlignNode,
} from '../lib/align-distribute';

function makeMockCanvas(overrides: Partial<CanvasConfig> = {}): CanvasConfig {
  return {
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    scaleMode: 'fit',
    ...overrides,
  };
}

function makeProject(blueprint: EventBlueprint): ScreenProject {
  return {
    id: 'proj-1',
    name: 'project-proj-1',
    description: null,
    canvas: makeMockCanvas(),
    components: [],
    blueprint,
    status: 'draft',
    thumbnail: null,
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
  } as unknown as ScreenProject;
}

/** 创建 3 个不对齐且不等距分布的节点 blueprint */
function makeUnalignedBlueprint(): EventBlueprint {
  return {
    version: 1,
    nodes: [
      {
        id: 'trigger-1',
        kind: 'trigger',
        position: { x: 0, y: 0 },
        config: { type: 'pageLoad' },
      },
      {
        id: 'action-1',
        kind: 'action',
        position: { x: 100, y: 50 },
        config: { type: 'setVisibility', targetComponentId: '', visible: 'show' },
      },
      // action-2 的中心 X 为 300（与 trigger-1 中心 50、action-1 中心 150 形成不等距分布）
      // 中心 Y 为 150（与 trigger-1 中心 40、action-1 中心 90 形成不等距分布）
      {
        id: 'action-2',
        kind: 'action',
        position: { x: 250, y: 110 },
        config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
      },
    ],
    edges: [],
  };
}

/** 将 blueprint.nodes 转换为 AlignNode 输入（全部选中） */
function toAlignNodes(blueprint: EventBlueprint, width = 100, height = 80): AlignNode[] {
  return blueprint.nodes.map((n) => ({
    id: n.id,
    position: { x: n.position.x, y: n.position.y },
    width,
    height,
  }));
}

describe('对齐分布与历史栈集成（任务 9.4）', () => {
  beforeEach(() => {
    useScreenEditorStore.setState({
      project: null,
      selectedComponentIds: [],
      history: { past: [], future: [] },
      isDirty: false,
      blueprintGesture: { active: false, baseline: undefined },
    });
  });

  describe('对齐 → updateBlueprint → 一条历史', () => {
    it('左对齐：3 个不对齐节点对齐后产生 1 条历史，快照为对齐前状态', () => {
      const blueprint = makeUnalignedBlueprint();
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);

      // 模拟 handleAlign: 全部节点视为选中
      const alignNodesInput = toAlignNodes(blueprint);
      const result = alignNodes(alignNodesInput, 'left');
      expect(result.hasChange).toBe(true);

      // 将结果应用到 blueprint nodes（保留 config / kind）
      const nextNodes = applyResultToBlueprintNodes(blueprint.nodes, result.items);

      const nextBlueprint: EventBlueprint = {
        ...blueprint,
        nodes: nextNodes,
      };
      useScreenEditorStore.getState().updateBlueprint(nextBlueprint);

      // 验证历史栈 +1
      const state = useScreenEditorStore.getState();
      expect(state.history.past).toHaveLength(1);
      // 快照为对齐前状态
      expect(state.history.past[0]?.blueprint).toEqual(blueprint);
      // 当前 blueprint 为对齐后状态
      expect(state.project?.blueprint).toEqual(nextBlueprint);
    });

    it('水平居中对齐：产生 1 条历史', () => {
      const blueprint = makeUnalignedBlueprint();
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      const alignNodesInput = toAlignNodes(blueprint);
      const result = alignNodes(alignNodesInput, 'center-h');
      expect(result.hasChange).toBe(true);

      const nextBlueprint: EventBlueprint = {
        ...blueprint,
        nodes: applyResultToBlueprintNodes(blueprint.nodes, result.items),
      };
      useScreenEditorStore.getState().updateBlueprint(nextBlueprint);

      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);
    });

    it('右对齐：所有节点 x = maxX - width', () => {
      const blueprint = makeUnalignedBlueprint();
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      const alignNodesInput = toAlignNodes(blueprint);
      const result = alignNodes(alignNodesInput, 'right');
      expect(result.hasChange).toBe(true);

      const nextBlueprint: EventBlueprint = {
        ...blueprint,
        nodes: applyResultToBlueprintNodes(blueprint.nodes, result.items),
      };
      useScreenEditorStore.getState().updateBlueprint(nextBlueprint);

      const current = useScreenEditorStore.getState().project?.blueprint;
      // 所有节点 x = 350 - 100 = 250（maxX = 250 + 100 = 350）
      expect(current?.nodes.every((n) => n.position.x === 250)).toBe(true);
    });

    it('顶对齐：所有节点 y = 0', () => {
      const blueprint = makeUnalignedBlueprint();
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      const alignNodesInput = toAlignNodes(blueprint);
      const result = alignNodes(alignNodesInput, 'top');
      expect(result.hasChange).toBe(true);

      const nextBlueprint: EventBlueprint = {
        ...blueprint,
        nodes: applyResultToBlueprintNodes(blueprint.nodes, result.items),
      };
      useScreenEditorStore.getState().updateBlueprint(nextBlueprint);

      const current = useScreenEditorStore.getState().project?.blueprint;
      expect(current?.nodes.every((n) => n.position.y === 0)).toBe(true);
    });
  });

  describe('对齐 → undo 恢复', () => {
    it('undo 后回到对齐前状态，无残留', () => {
      const blueprint = makeUnalignedBlueprint();
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      const alignNodesInput = toAlignNodes(blueprint);
      const result = alignNodes(alignNodesInput, 'left');
      const nextBlueprint: EventBlueprint = {
        ...blueprint,
        nodes: applyResultToBlueprintNodes(blueprint.nodes, result.items),
      };
      useScreenEditorStore.getState().updateBlueprint(nextBlueprint);

      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(nextBlueprint);

      // undo
      useScreenEditorStore.getState().undo();

      // 回到对齐前
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(blueprint);
      // future 栈 +1
      expect(useScreenEditorStore.getState().history.future).toHaveLength(1);
    });
  });

  describe('对齐无变化 → 不入栈', () => {
    it('所有节点已左对齐时：alignNodes(left) hasChange=false，不调用 updateBlueprint', () => {
      // 所有节点 x=0（已对齐）
      const blueprint: EventBlueprint = {
        version: 1,
        nodes: [
          {
            id: 'a',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'pageLoad' },
          },
          {
            id: 'b',
            kind: 'action',
            position: { x: 0, y: 100 },
            config: { type: 'setVisibility', targetComponentId: '', visible: 'show' },
          },
        ],
        edges: [],
      };
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      const alignNodesInput = toAlignNodes(blueprint);
      const result = alignNodes(alignNodesInput, 'left');
      expect(result.hasChange).toBe(false);

      // 模拟 handleAlign 守卫：hasChange=false 时不调用 updateBlueprint
      if (result.hasChange) {
        const nextBlueprint: EventBlueprint = {
          ...blueprint,
          nodes: applyResultToBlueprintNodes(blueprint.nodes, result.items),
        };
        useScreenEditorStore.getState().updateBlueprint(nextBlueprint);
      }

      // 历史栈仍为 0
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
    });
  });

  describe('分布 → updateBlueprint → 一条历史', () => {
    it('水平分布：3 个节点等距分布产生 1 条历史', () => {
      const blueprint = makeUnalignedBlueprint();
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      const alignNodesInput = toAlignNodes(blueprint);
      const result = distributeNodes(alignNodesInput, 'horizontal');
      expect(result.hasChange).toBe(true);

      const nextBlueprint: EventBlueprint = {
        ...blueprint,
        nodes: applyResultToBlueprintNodes(blueprint.nodes, result.items),
      };
      useScreenEditorStore.getState().updateBlueprint(nextBlueprint);

      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);
      // 快照为分布前状态
      expect(useScreenEditorStore.getState().history.past[0]?.blueprint).toEqual(blueprint);
    });

    it('垂直分布：3 个节点等距分布产生 1 条历史', () => {
      const blueprint = makeUnalignedBlueprint();
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      const alignNodesInput = toAlignNodes(blueprint);
      const result = distributeNodes(alignNodesInput, 'vertical');
      expect(result.hasChange).toBe(true);

      const nextBlueprint: EventBlueprint = {
        ...blueprint,
        nodes: applyResultToBlueprintNodes(blueprint.nodes, result.items),
      };
      useScreenEditorStore.getState().updateBlueprint(nextBlueprint);

      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);
    });
  });

  describe('分布无变化 → 不入栈', () => {
    it('节点数 < 3：分布 hasChange=false，不调用 updateBlueprint', () => {
      const blueprint: EventBlueprint = {
        version: 1,
        nodes: [
          {
            id: 'a',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'pageLoad' },
          },
          {
            id: 'b',
            kind: 'action',
            position: { x: 100, y: 0 },
            config: { type: 'setVisibility', targetComponentId: '', visible: 'show' },
          },
        ],
        edges: [],
      };
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      const alignNodesInput = toAlignNodes(blueprint);
      const result = distributeNodes(alignNodesInput, 'horizontal');
      expect(result.hasChange).toBe(false);

      if (result.hasChange) {
        const nextBlueprint: EventBlueprint = {
          ...blueprint,
          nodes: applyResultToBlueprintNodes(blueprint.nodes, result.items),
        };
        useScreenEditorStore.getState().updateBlueprint(nextBlueprint);
      }

      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
    });
  });

  describe('连续对齐 → 多次历史', () => {
    it('连续 2 次对齐产生 2 条历史，undo 2 次回到原状', () => {
      const blueprint = makeUnalignedBlueprint();
      useScreenEditorStore.getState().loadProject(makeProject(blueprint));

      // 第一次：左对齐
      const result1 = alignNodes(toAlignNodes(blueprint), 'left');
      const blueprintAfterFirst: EventBlueprint = {
        ...blueprint,
        nodes: applyResultToBlueprintNodes(blueprint.nodes, result1.items),
      };
      useScreenEditorStore.getState().updateBlueprint(blueprintAfterFirst);

      // 第二次：顶对齐（基于第一次结果）
      const result2 = alignNodes(toAlignNodes(blueprintAfterFirst), 'top');
      const blueprintAfterSecond: EventBlueprint = {
        ...blueprintAfterFirst,
        nodes: applyResultToBlueprintNodes(blueprintAfterFirst.nodes, result2.items),
      };
      useScreenEditorStore.getState().updateBlueprint(blueprintAfterSecond);

      // 2 条历史
      expect(useScreenEditorStore.getState().history.past).toHaveLength(2);

      // undo 1 次：回到第一次对齐后
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(blueprintAfterFirst);

      // undo 2 次：回到原始
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(blueprint);
    });
  });
});

/**
 * 将 AlignResult.items 应用到 blueprint.nodes 数组（保留 config / kind 字段）。
 *
 * 注：blueprint.nodes 中的元素是判别联合（trigger/condition/action/comment），
 * applyAlignResultToNodes 的泛型约束是 { id, position }，可直接复用。
 */
function applyResultToBlueprintNodes<T extends { id: string; position: { x: number; y: number } }>(
  nodes: readonly T[],
  items: readonly { id: string; position: { x: number; y: number } }[],
): T[] {
  return applyAlignResultToNodes(nodes, items);
}
