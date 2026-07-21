import { renderHook } from '@testing-library/react';
import { type Node } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { useBlueprintDrag } from './use-blueprint-drag';

function makeNode(
  id: string,
  position: { x: number; y: number },
  measured?: { width: number; height: number },
): Node {
  return {
    id,
    type: 'default',
    position,
    data: {},
    measured,
  };
}

describe('use-blueprint-drag', () => {
  describe('onNodeDragStop', () => {
    it('拖拽结束将节点位置吸附到 8px 网格', () => {
      const nodes = [makeNode('n1', { x: 3, y: 5 }, { width: 100, height: 50 })];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      expect(onNodesChange).toHaveBeenCalledTimes(1);
      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      expect(nextNodes?.[0]?.position).toEqual({ x: 0, y: 8 });
    });

    it('位置已在网格上时不触发 onNodesChange（避免无变化空更新）', () => {
      const nodes = [makeNode('n1', { x: 16, y: 24 }, { width: 100, height: 50 })];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      expect(onNodesChange).not.toHaveBeenCalled();
    });

    it('支持自定义 gridSize', () => {
      const nodes = [makeNode('n1', { x: 7, y: 13 }, { width: 100, height: 50 })];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange, gridSize: 10 }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      expect(nextNodes?.[0]?.position).toEqual({ x: 10, y: 10 });
    });

    it('enableGridSnap=false 时不进行网格吸附', () => {
      const nodes = [makeNode('n1', { x: 3, y: 5 }, { width: 100, height: 50 })];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() =>
        useBlueprintDrag({ nodes, onNodesChange, enableGridSnap: false }),
      );

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      expect(onNodesChange).not.toHaveBeenCalled();
    });

    it('命中对齐吸附时优先使用对齐位置（不进行网格吸附）', () => {
      // n1 拖到 x=2, y=2，n2 在 x=0, y=0
      // n1 左边距离 n2 左边 = 2，命中对齐阈值 4
      // 应吸附到 x=0, y=0（而非网格吸附后的 x=0, y=0）
      const nodes = [
        makeNode('n1', { x: 2, y: 2 }, { width: 100, height: 50 }),
        makeNode('n2', { x: 0, y: 0 }, { width: 100, height: 50 }),
      ];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      expect(onNodesChange).toHaveBeenCalledTimes(1);
      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      expect(nextNodes?.[0]?.position).toEqual({ x: 0, y: 0 });
    });

    it('enableAlignSnap=false 时跳过对齐吸附，仅做网格吸附', () => {
      const nodes = [
        makeNode('n1', { x: 2, y: 2 }, { width: 100, height: 50 }),
        makeNode('n2', { x: 0, y: 0 }, { width: 100, height: 50 }),
      ];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() =>
        useBlueprintDrag({ nodes, onNodesChange, enableAlignSnap: false }),
      );

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      // 仅网格吸附：x=2→0, y=2→0
      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      expect(nextNodes?.[0]?.position).toEqual({ x: 0, y: 0 });
    });

    it('多选拖拽时所有选中节点都做吸附', () => {
      const nodes = [
        makeNode('n1', { x: 3, y: 5 }, { width: 100, height: 50 }),
        makeNode('n2', { x: 11, y: 13 }, { width: 100, height: 50 }),
      ];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      // 模拟多选拖拽：draggedNodes 包含 n1 和 n2
      const draggedNodes: Node[] = [nodes[0], nodes[1]].filter((n): n is Node => Boolean(n));
      const firstDragged = nodes[0];
      if (!firstDragged) return;
      result.current.onNodeDragStop({} as MouseEvent, firstDragged, draggedNodes);

      expect(onNodesChange).toHaveBeenCalledTimes(1);
      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      expect(nextNodes?.[0]?.position).toEqual({ x: 0, y: 8 });
      expect(nextNodes?.[1]?.position).toEqual({ x: 8, y: 16 });
    });

    it('仅写回拖拽节点位置，其他节点不变', () => {
      const nodes = [
        makeNode('n1', { x: 3, y: 5 }, { width: 100, height: 50 }),
        makeNode('n2', { x: 100, y: 200 }, { width: 100, height: 50 }),
      ];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      // n2 位置应保持不变
      expect(nextNodes?.[1]?.position).toEqual({ x: 100, y: 200 });
      // n2 是同一引用
      expect(nextNodes?.[1]).toBe(nodes[1]);
    });

    it('节点未渲染（measured=undefined）时退化为仅网格吸附', () => {
      // 没有尺寸信息无法计算对齐吸附，应退化为仅网格吸附
      const nodes = [
        makeNode('n1', { x: 3, y: 5 }, undefined),
        makeNode('n2', { x: 0, y: 0 }, { width: 100, height: 50 }),
      ];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      // 仅网格吸附：x=3→0, y=5→8
      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      expect(nextNodes?.[0]?.position).toEqual({ x: 0, y: 8 });
    });

    it('空 draggedNodes 数组不触发 onNodesChange', () => {
      const nodes = [makeNode('n1', { x: 3, y: 5 }, { width: 100, height: 50 })];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, []);

      expect(onNodesChange).not.toHaveBeenCalled();
    });

    it('写回的节点保留原 data/type/id 等字段', () => {
      const node: Node = {
        id: 'n1',
        type: 'trigger',
        position: { x: 3, y: 5 },
        data: { label: '组件点击' },
        measured: { width: 100, height: 50 },
      };
      const nodes = [node];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      result.current.onNodeDragStop({} as MouseEvent, node, [node]);

      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      const next = nextNodes?.[0];
      expect(next?.id).toBe('n1');
      expect(next?.type).toBe('trigger');
      expect(next?.data).toEqual({ label: '组件点击' });
      expect(next?.measured).toEqual({ width: 100, height: 50 });
    });
  });

  describe('onNodeDrag', () => {
    it('onNodeDrag 不触发 onNodesChange（中间态不入栈）', () => {
      const nodes = [makeNode('n1', { x: 3, y: 5 }, { width: 100, height: 50 })];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDrag({} as MouseEvent, draggedNode, [draggedNode]);

      expect(onNodesChange).not.toHaveBeenCalled();
    });
  });

  describe('默认配置', () => {
    it('默认启用网格吸附', () => {
      const nodes = [makeNode('n1', { x: 3, y: 5 }, { width: 100, height: 50 })];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      expect(onNodesChange).toHaveBeenCalled();
    });

    it('默认启用对齐吸附', () => {
      // n1 在 x=2, n2 在 x=0，对齐吸附应优先
      const nodes = [
        makeNode('n1', { x: 2, y: 0 }, { width: 100, height: 50 }),
        makeNode('n2', { x: 0, y: 0 }, { width: 100, height: 50 }),
      ];
      const onNodesChange = vi.fn<(nodes: Node[]) => void>();
      const { result } = renderHook(() => useBlueprintDrag({ nodes, onNodesChange }));

      const draggedNode = nodes[0];
      if (!draggedNode) return;
      result.current.onNodeDragStop({} as MouseEvent, draggedNode, [draggedNode]);

      // 命中对齐吸附 → x=0
      const nextNodes = onNodesChange.mock.calls[0]?.[0];
      expect(nextNodes?.[0]?.position.x).toBe(0);
    });
  });
});
