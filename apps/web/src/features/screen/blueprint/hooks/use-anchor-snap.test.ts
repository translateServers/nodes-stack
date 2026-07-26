/**
 * V2 任务 5.3：锚点磁吸 Hook 测试
 *
 * 测试策略：
 * - jsdom 环境 mock `document.querySelectorAll` 与 `getBoundingClientRect`
 * - 验证磁吸命中/未命中、兼容性过滤、阈值边界、DOM 高亮 class 管理
 * - 验证 onConnectEnd 在命中/未命中/RF 直接命中三种分支的行为
 * - 验证 hook 卸载时清理 DOM 高亮 class
 */

import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { SNAP_HIGHLIGHT_CLASS, SNAP_THRESHOLD_PX, useAnchorSnap } from './use-anchor-snap';
import type { V2ConnectionCandidate } from '../lib/pin-compatibility-v2';

/** 创建 RF node（component 类型，带 componentId） */
function makeComponentNode(id: string, componentId: string): Node {
  return {
    id,
    type: 'component',
    position: { x: 0, y: 0 },
    data: { componentId },
  };
}

/** 创建 RF edge */
function makeEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    type: 'exec',
    source,
    target,
    sourceHandle: 'evt:click',
    targetHandle: 'act:show',
  };
}

/** mock handle DOM 元素 */
interface MockHandleEl {
  dataset: { nodeid: string; handleid: string };
  classList: {
    add: (cls: string) => void;
    remove: (cls: string) => void;
    contains: (cls: string) => boolean;
  };
  _rect: { left: number; top: number; width: number; height: number };
  getBoundingClientRect: () => DOMRect;
}

/** 当前测试中活跃的 handles（通过闭包传递给 mock） */
let activeHandles: MockHandleEl[] = [];

/** 创建 mock handle DOM 元素 */
function createMockHandle(
  nodeId: string,
  handleId: string,
  rect: { left: number; top: number; width: number; height: number },
): MockHandleEl {
  const classes = new Set<string>();
  return {
    dataset: { nodeid: nodeId, handleid: handleId },
    classList: {
      add: (cls: string) => classes.add(cls),
      remove: (cls: string) => classes.delete(cls),
      contains: (cls: string) => classes.has(cls),
    },
    _rect: rect,
    getBoundingClientRect: (): DOMRect => ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  };
}

/** 设置当前活跃的 handles，并 mock document.querySelectorAll / querySelector */
function mockQuerySelectorAll(handles: MockHandleEl[]): void {
  activeHandles = handles;
}

/** 安装 document spy（在 beforeEach 中调用一次） */
function installDocumentSpy(): void {
  vi.spyOn(document, 'querySelectorAll').mockImplementation((selector: string) => {
    if (selector.startsWith('.react-flow__handle')) {
      return activeHandles as unknown as NodeListOf<HTMLElement>;
    }
    if (selector.startsWith('.blueprint-anchor-snap-target')) {
      return activeHandles.filter((h) =>
        h.classList.contains(SNAP_HIGHLIGHT_CLASS),
      ) as unknown as NodeListOf<HTMLElement>;
    }
    return [] as unknown as NodeListOf<HTMLElement>;
  });

  vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
    if (!selector.startsWith('.react-flow__handle')) return null;
    const nodeIdMatch = selector.match(/\[data-nodeid="([^"]+)"\]/);
    const handleIdMatch = selector.match(/\[data-handleid="([^"]+)"\]/);
    if (!nodeIdMatch || !handleIdMatch) return null;
    return (activeHandles.find(
      (h) => h.dataset.nodeid === nodeIdMatch[1] && h.dataset.handleid === handleIdMatch[1],
    ) ?? null) as unknown as HTMLElement | null;
  });
}

describe('use-anchor-snap', () => {
  beforeEach((): void => {
    activeHandles = [];
    installDocumentSpy();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
    activeHandles = [];
  });

  describe('初始状态', () => {
    it('初始 snapState 全部为 null', () => {
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => [],
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      expect(result.current.snapState).toEqual({
        activeSourceNodeId: null,
        activeSourceHandle: null,
        snappedTargetNodeId: null,
        snappedTargetHandle: null,
      });
    });
  });

  describe('wrapConnectStart', () => {
    it('记录源节点和源 handle，并调用 existing handler', () => {
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => [],
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );
      const existing = vi.fn();
      const wrapped = result.current.wrapConnectStart(existing);

      act(() => {
        wrapped(
          {} as MouseEvent,
          {
            nodeId: 'node-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
      });

      expect(result.current.snapState.activeSourceNodeId).toBe('node-1');
      expect(result.current.snapState.activeSourceHandle).toBe('evt:click');
      expect(existing).toHaveBeenCalledOnce();
    });

    it('handleType 不是 source 时不记录源信息', () => {
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => [],
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );
      const wrapped = result.current.wrapConnectStart();

      act(() => {
        wrapped(
          {} as MouseEvent,
          {
            nodeId: 'node-1',
            handleId: 'act:show',
            handleType: 'target',
          } as never,
        );
      });

      expect(result.current.snapState.activeSourceNodeId).toBeNull();
    });
  });

  describe('handleMouseMove + 磁吸命中', () => {
    it('20px 内有兼容目标 handle 时更新 snappedTarget', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const onSnapConnect = vi.fn<(conn: V2ConnectionCandidate) => void>();
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect,
        }),
      );

      // mock handle DOM：target handle 在 (100, 100) 处，size 10x10，中心点 (105, 105)
      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      // 先触发 onConnectStart 记录源
      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
      });

      // mousemove 在 (105, 110)：距离中心点 (105, 105) = 5px，命中
      act(() => {
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 110,
        } as MouseEvent);
      });

      expect(result.current.snapState.snappedTargetNodeId).toBe('target-1');
      expect(result.current.snapState.snappedTargetHandle).toBe('act:show');
      // DOM 高亮 class 已添加
      expect(targetHandle.classList.contains(SNAP_HIGHLIGHT_CLASS)).toBe(true);
    });

    it('超过 20px 时不命中', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
      });

      // mousemove 在 (200, 200)：距离中心点 (105, 105) > 100px，不命中
      act(() => {
        result.current.handleMouseMove({
          clientX: 200,
          clientY: 200,
        } as MouseEvent);
      });

      expect(result.current.snapState.snappedTargetNodeId).toBeNull();
      expect(targetHandle.classList.contains(SNAP_HIGHLIGHT_CLASS)).toBe(false);
    });

    it('isInputHandle 过滤：候选 handle 必须是输入锚点（act:* / in）', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      // 'in' 是输入锚点（兼容 evt->in），应被命中
      const inputHandle = createMockHandle('target-1', 'in', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      // 'evt:hover' 是输出锚点，应被 isInputHandle 过滤掉
      const outputHandle = createMockHandle('target-1', 'evt:hover', {
        left: 200,
        top: 200,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([inputHandle, outputHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
      });

      // mousemove 在 outputHandle 中心 (205, 205)，但 outputHandle 应被过滤
      // inputHandle 在 (105, 105)，距离 (205, 205) > 100px，不在 20px 范围内
      // 因此应无命中
      act(() => {
        result.current.handleMouseMove({
          clientX: 205,
          clientY: 205,
        } as MouseEvent);
      });

      expect(result.current.snapState.snappedTargetNodeId).toBeNull();
    });

    it('重复边检测：已有边存在时不命中', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const existingEdge = makeEdge('edge-1', 'source-1', 'target-1');
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [existingEdge],
          onSnapConnect: vi.fn(),
        }),
      );

      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
      });

      act(() => {
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 105,
        } as MouseEvent);
      });

      // 已存在相同 source+sourceHandle+target+targetHandle 的边，应被判定为重复
      expect(result.current.snapState.snappedTargetNodeId).toBeNull();
    });

    it('多个兼容 handle 时返回最近的', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
        makeComponentNode('target-2', 'comp-3'),
      ];
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      // 两个兼容目标 handle，target-1 在 (100, 100)，target-2 在 (110, 110)
      const handle1 = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      const handle2 = createMockHandle('target-2', 'act:show', {
        left: 110,
        top: 110,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([handle1, handle2]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
      });

      // mousemove 在 (108, 108)：距离 handle1 中心 (105,105) = 4.24px，距离 handle2 中心 (115,115) = 9.9px
      // 两者都在 20px 内，但 handle1 更近
      act(() => {
        result.current.handleMouseMove({
          clientX: 108,
          clientY: 108,
        } as MouseEvent);
      });

      expect(result.current.snapState.snappedTargetNodeId).toBe('target-1');
      expect(result.current.snapState.snappedTargetHandle).toBe('act:show');
    });

    it('未触发 onConnectStart 时 handleMouseMove 不做任何事', () => {
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => [],
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 105,
        } as MouseEvent);
      });

      expect(result.current.snapState.snappedTargetNodeId).toBeNull();
    });
  });

  describe('wrapConnectEnd', () => {
    it('磁吸命中时调用 onSnapConnect 并跳过 existing handler', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const onSnapConnect = vi.fn<(conn: V2ConnectionCandidate) => void>();
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect,
        }),
      );
      const existing = vi.fn();
      const wrappedEnd = result.current.wrapConnectEnd(existing);
      const wrappedStart = result.current.wrapConnectStart();

      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        wrappedStart(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 105,
        } as MouseEvent);
      });

      // connectionState.toNode 为 undefined（模拟磁吸场景）
      act(() => {
        wrappedEnd(
          { clientX: 105, clientY: 105 } as MouseEvent,
          { toNode: null, fromNode: null, fromHandle: null } as never,
        );
      });

      expect(onSnapConnect).toHaveBeenCalledOnce();
      expect(onSnapConnect).toHaveBeenCalledWith({
        source: 'source-1',
        sourceHandle: 'evt:click',
        target: 'target-1',
        targetHandle: 'act:show',
      });
      // existing 不应被调用（磁吸命中后跳过搜索面板）
      expect(existing).not.toHaveBeenCalled();
      // 状态已清理
      expect(result.current.snapState.activeSourceNodeId).toBeNull();
      expect(result.current.snapState.snappedTargetNodeId).toBeNull();
    });

    it('RF 已识别 toNode 时跳过磁吸，走 existing handler', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const onSnapConnect = vi.fn<(conn: V2ConnectionCandidate) => void>();
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect,
        }),
      );
      const existing = vi.fn();
      const wrappedEnd = result.current.wrapConnectEnd(existing);

      // 模拟磁吸命中
      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 105,
        } as MouseEvent);
      });

      // RF 直接命中（toNode 非空）
      act(() => {
        wrappedEnd(
          { clientX: 105, clientY: 105 } as MouseEvent,
          {
            toNode: { id: 'target-1' },
            fromNode: null,
            fromHandle: null,
          } as never,
        );
      });

      // RF 直接命中时走 onConnect 路径，不调用磁吸 connect
      expect(onSnapConnect).not.toHaveBeenCalled();
      // existing 被调用（注意：磁吸 hook 在 toNode 存在时也会调用 existing）
      expect(existing).toHaveBeenCalledOnce();
    });

    it('磁吸未命中时回退到 existing handler', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const onSnapConnect = vi.fn<(conn: V2ConnectionCandidate) => void>();
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect,
        }),
      );
      const existing = vi.fn();
      const wrappedEnd = result.current.wrapConnectEnd(existing);

      // 模拟磁吸未命中（无 handle 在范围内）
      const farHandle = createMockHandle('target-1', 'act:show', {
        left: 1000,
        top: 1000,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([farHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
        result.current.handleMouseMove({
          clientX: 50,
          clientY: 50,
        } as MouseEvent);
      });

      act(() => {
        wrappedEnd(
          { clientX: 50, clientY: 50 } as MouseEvent,
          { toNode: null, fromNode: null, fromHandle: null } as never,
        );
      });

      expect(onSnapConnect).not.toHaveBeenCalled();
      expect(existing).toHaveBeenCalledOnce();
    });

    it('connectEnd 后 DOM 高亮 class 被清理', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 105,
        } as MouseEvent);
      });

      expect(targetHandle.classList.contains(SNAP_HIGHLIGHT_CLASS)).toBe(true);

      act(() => {
        result.current.wrapConnectEnd()(
          { clientX: 105, clientY: 105 } as MouseEvent,
          { toNode: null, fromNode: null, fromHandle: null } as never,
        );
      });

      expect(targetHandle.classList.contains(SNAP_HIGHLIGHT_CLASS)).toBe(false);
    });
  });

  describe('resetSnap', () => {
    it('手动重置磁吸状态并清理 DOM 高亮', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 105,
        } as MouseEvent);
      });

      expect(targetHandle.classList.contains(SNAP_HIGHLIGHT_CLASS)).toBe(true);

      act(() => {
        result.current.resetSnap();
      });

      expect(result.current.snapState.activeSourceNodeId).toBeNull();
      expect(result.current.snapState.snappedTargetNodeId).toBeNull();
      expect(targetHandle.classList.contains(SNAP_HIGHLIGHT_CLASS)).toBe(false);
    });
  });

  describe('常量', () => {
    it('SNAP_THRESHOLD_PX 为 20', () => {
      expect(SNAP_THRESHOLD_PX).toBe(20);
    });

    it('SNAP_HIGHLIGHT_CLASS 为 blueprint-anchor-snap-target', () => {
      expect(SNAP_HIGHLIGHT_CLASS).toBe('blueprint-anchor-snap-target');
    });
  });

  describe('边界距离测试', () => {
    it('恰好 20px 距离时命中（闭区间）', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      // handle 中心 (100, 100)，size 10x10，中心点 (105, 105)
      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
      });

      // mousemove 在 (105, 125)：距离中心点 (105, 105) = 20px，恰好阈值
      act(() => {
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 125,
        } as MouseEvent);
      });

      expect(result.current.snapState.snappedTargetNodeId).toBe('target-1');
    });

    it('21px 距离时不命中', () => {
      const nodes = [
        makeComponentNode('source-1', 'comp-1'),
        makeComponentNode('target-1', 'comp-2'),
      ];
      const { result } = renderHook(() =>
        useAnchorSnap({
          getNodes: () => nodes,
          getEdges: () => [],
          onSnapConnect: vi.fn(),
        }),
      );

      const targetHandle = createMockHandle('target-1', 'act:show', {
        left: 100,
        top: 100,
        width: 10,
        height: 10,
      });
      mockQuerySelectorAll([targetHandle]);

      act(() => {
        result.current.wrapConnectStart()(
          {} as MouseEvent,
          {
            nodeId: 'source-1',
            handleId: 'evt:click',
            handleType: 'source',
          } as never,
        );
      });

      // mousemove 在 (105, 126)：距离中心点 (105, 105) = 21px，超过阈值
      act(() => {
        result.current.handleMouseMove({
          clientX: 105,
          clientY: 126,
        } as MouseEvent);
      });

      expect(result.current.snapState.snappedTargetNodeId).toBeNull();
    });
  });
});
