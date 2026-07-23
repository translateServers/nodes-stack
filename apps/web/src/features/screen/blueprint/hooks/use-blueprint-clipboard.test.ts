import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Node, Edge } from '@xyflow/react';
import { useBlueprintClipboard } from './use-blueprint-clipboard';
import { BLUEPRINT_CLIPBOARD_KIND, type BlueprintClipboard } from '@nebula/shared';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

import { toast } from 'sonner';

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    type: 'action',
    position: { x: 100, y: 200 },
    data: {
      config: { type: 'setVisibility', targetComponentId: '', visible: 'show' },
      label: '',
      dangling: false,
    },
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'out',
    targetHandle: 'in',
    type: 'exec',
    data: {},
    ...overrides,
  };
}

function fireKeyDown(key: string, options: { ctrlKey?: boolean } = {}): void {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: false,
    metaKey: false,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

describe('useBlueprintClipboard（任务 5.5）', () => {
  let clipboardStore: string;
  let setNodes: ReturnType<typeof vi.fn>;
  let setEdges: ReturnType<typeof vi.fn>;
  let writeTextMock: ReturnType<typeof vi.fn>;
  let nodes: Node[];
  let edges: Edge[];

  beforeEach(() => {
    clipboardStore = '';
    setNodes = vi.fn((updater: Node[] | ((nodes: Node[]) => Node[])) => {
      nodes = typeof updater === 'function' ? updater(nodes) : updater;
    });
    setEdges = vi.fn((updater: Edge[] | ((edges: Edge[]) => Edge[])) => {
      edges = typeof updater === 'function' ? updater(edges) : updater;
    });
    nodes = [];
    edges = [];

    // Mock navigator.clipboard
    writeTextMock = vi.fn((text: string) => {
      clipboardStore = text;
      return Promise.resolve();
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
        readText: vi.fn(() => Promise.resolve(clipboardStore)),
      },
    });

    vi.mocked(toast.error).mockClear();
  });

  it('copy：选中节点序列化为 BlueprintClipboard 格式写入剪贴板', async () => {
    nodes = [makeNode({ id: 'n1', selected: true }), makeNode({ id: 'n2', selected: false })];
    edges = [makeEdge({ id: 'e1', source: 'n1', target: 'n2' })];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.copy();
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const payload: BlueprintClipboard = JSON.parse(clipboardStore) as BlueprintClipboard;
    expect(payload.kind).toBe(BLUEPRINT_CLIPBOARD_KIND);
    expect(payload.nodes).toHaveLength(1);
    expect(payload.nodes[0]?.id).toBe('n1');
    // 边不在选中节点之间（n2 未选中），不复制
    expect(payload.edges).toHaveLength(0);
  });

  it('copy：复制选中节点之间的边', async () => {
    nodes = [makeNode({ id: 'n1', selected: true }), makeNode({ id: 'n2', selected: true })];
    edges = [makeEdge({ id: 'e1', source: 'n1', target: 'n2' })];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.copy();
    });

    const payload: BlueprintClipboard = JSON.parse(clipboardStore) as BlueprintClipboard;
    expect(payload.nodes).toHaveLength(2);
    expect(payload.edges).toHaveLength(1);
    expect(payload.edges[0]?.source).toBe('n1');
    expect(payload.edges[0]?.target).toBe('n2');
  });

  it('copy：无选中节点时不写入剪贴板', async () => {
    nodes = [makeNode({ id: 'n1', selected: false })];
    edges = [];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.copy();
    });

    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it('paste：重新生成节点 ID', async () => {
    const payload: BlueprintClipboard = {
      kind: BLUEPRINT_CLIPBOARD_KIND,
      nodes: [
        {
          id: 'old-n1',
          kind: 'trigger',
          position: { x: 10, y: 20 },
          config: { type: 'pageLoad' },
        },
      ],
      edges: [],
    };
    clipboardStore = JSON.stringify(payload);
    nodes = [makeNode({ id: 'existing-1', selected: false })];
    edges = [];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.paste();
    });

    expect(setNodes).toHaveBeenCalledTimes(1);
    // 获取 setNodes 调用时的 updater 函数结果
    const updater = vi.mocked(setNodes).mock.calls[0]?.[0] as (nds: Node[]) => Node[];
    const resultNodes = updater([makeNode({ id: 'existing-1', selected: false })]);
    expect(resultNodes).toHaveLength(2);
    // 新节点 ID 不等于旧 ID
    const newNode = resultNodes.find((n) => n.id !== 'existing-1');
    expect(newNode).toBeDefined();
    expect(newNode?.id).not.toBe('old-n1');
    // 位置偏移
    expect(newNode?.position.x).toBe(30); // 10 + 20
    expect(newNode?.position.y).toBe(40); // 20 + 20
    // 新节点被选中
    expect(newNode?.selected).toBe(true);
  });

  it('paste：更新边的 source/target 引用为新节点 ID', async () => {
    const payload: BlueprintClipboard = {
      kind: BLUEPRINT_CLIPBOARD_KIND,
      nodes: [
        { id: 'old-n1', kind: 'trigger', position: { x: 0, y: 0 }, config: { type: 'pageLoad' } },
        {
          id: 'old-n2',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'setVisibility', targetComponentId: '', visible: 'show' },
        },
      ],
      edges: [
        {
          id: 'old-e1',
          source: 'old-n1',
          sourceHandle: 'out',
          target: 'old-n2',
          targetHandle: 'in',
        },
      ],
    };
    clipboardStore = JSON.stringify(payload);
    nodes = [];
    edges = [];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.paste();
    });

    // setEdges 被调用
    expect(setEdges).toHaveBeenCalledTimes(1);
    const edgeUpdater = vi.mocked(setEdges).mock.calls[0]?.[0] as (eds: Edge[]) => Edge[];
    const resultEdges = edgeUpdater([]);
    expect(resultEdges).toHaveLength(1);
    // 边 ID 已重新生成
    expect(resultEdges[0]?.id).not.toBe('old-e1');
    // source/target 已更新为新节点 ID
    expect(resultEdges[0]?.source).not.toBe('old-n1');
    expect(resultEdges[0]?.target).not.toBe('old-n2');

    // 验证 source/target 与粘贴的节点 ID 一致
    const nodeUpdater = vi.mocked(setNodes).mock.calls[0]?.[0] as (nds: Node[]) => Node[];
    const resultNodes = nodeUpdater([]);
    const newNodeIds = resultNodes.map((n) => n.id);
    expect(newNodeIds).toContain(resultEdges[0]?.source);
    expect(newNodeIds).toContain(resultEdges[0]?.target);
  });

  it('paste：非法 JSON 内容显示错误提示', async () => {
    clipboardStore = 'not valid json {{{';
    nodes = [];
    edges = [];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.paste();
    });

    expect(toast.error).toHaveBeenCalledWith('剪贴板内容不是有效的 JSON');
    expect(setNodes).not.toHaveBeenCalled();
  });

  it('paste：非蓝图格式的 JSON 显示错误提示', async () => {
    clipboardStore = JSON.stringify({ kind: 'unknown-format', data: [1, 2, 3] });
    nodes = [];
    edges = [];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.paste();
    });

    expect(toast.error).toHaveBeenCalledWith('剪贴板内容不是有效的蓝图数据');
    expect(setNodes).not.toHaveBeenCalled();
  });

  it('paste：跨项目粘贴（不同节点 ID 不冲突）', async () => {
    const payload: BlueprintClipboard = {
      kind: BLUEPRINT_CLIPBOARD_KIND,
      nodes: [
        {
          id: 'project-A-node-1',
          kind: 'action',
          position: { x: 50, y: 50 },
          config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
        },
      ],
      edges: [],
    };
    clipboardStore = JSON.stringify(payload);
    // 当前项目已有同 ID 节点（模拟跨项目场景）
    nodes = [makeNode({ id: 'project-A-node-1', selected: false })];
    edges = [];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.paste();
    });

    const updater = vi.mocked(setNodes).mock.calls[0]?.[0] as (nds: Node[]) => Node[];
    const resultNodes = updater([makeNode({ id: 'project-A-node-1', selected: false })]);
    // 新节点 ID 不等于已有节点 ID
    const newNode = resultNodes.find((n) => n.id !== 'project-A-node-1');
    expect(newNode).toBeDefined();
    expect(newNode?.id).not.toBe('project-A-node-1');
  });

  it('cut：复制后删除选中节点和相关边', async () => {
    nodes = [
      makeNode({ id: 'n1', selected: true }),
      makeNode({ id: 'n2', selected: true }),
      makeNode({ id: 'n3', selected: false }),
    ];
    edges = [
      makeEdge({ id: 'e1', source: 'n1', target: 'n2' }),
      makeEdge({ id: 'e2', source: 'n1', target: 'n3' }),
    ];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    await act(async () => {
      await result.current.cut();
    });

    // 写入剪贴板
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const payload: BlueprintClipboard = JSON.parse(clipboardStore) as BlueprintClipboard;
    expect(payload.nodes).toHaveLength(2);
    expect(payload.edges).toHaveLength(1); // 只有 n1→n2（两端均选中）

    // 删除选中节点
    const nodeUpdater = vi.mocked(setNodes).mock.calls[0]?.[0] as (nds: Node[]) => Node[];
    const resultNodes = nodeUpdater(nodes);
    expect(resultNodes).toHaveLength(1);
    expect(resultNodes[0]?.id).toBe('n3');

    // 删除与选中节点相关的边
    const edgeUpdater = vi.mocked(setEdges).mock.calls[0]?.[0] as (eds: Edge[]) => Edge[];
    const resultEdges = edgeUpdater(edges);
    expect(resultEdges).toHaveLength(0); // e1 和 e2 都涉及选中节点
  });

  it('duplicate：就地复制选中节点（不经过系统剪贴板）', () => {
    nodes = [
      makeNode({ id: 'n1', selected: true, position: { x: 100, y: 100 } }),
      makeNode({ id: 'n2', selected: false, position: { x: 200, y: 200 } }),
    ];
    edges = [makeEdge({ id: 'e1', source: 'n1', target: 'n2' })];

    const { result } = renderHook(() =>
      useBlueprintClipboard({ nodes, edges, setNodes, setEdges }),
    );

    act(() => {
      result.current.duplicate();
    });

    // 不写入系统剪贴板
    expect(writeTextMock).not.toHaveBeenCalled();

    // setNodes 被调用，mock 已自动更新 nodes
    expect(setNodes).toHaveBeenCalledTimes(1);
    // 原节点取消选中 + 新节点被选中
    expect(nodes).toHaveLength(3); // 原 n1, n2 + 复制的 n1'
    const duplicatedNode = nodes.find((n) => n.id !== 'n1' && n.id !== 'n2' && n.selected === true);
    expect(duplicatedNode).toBeDefined();
    expect(duplicatedNode?.id).not.toBe('n1');
    expect(duplicatedNode?.position.x).toBe(120); // 100 + 20
    expect(duplicatedNode?.position.y).toBe(120); // 100 + 20
  });

  it('Ctrl+C 键盘快捷键触发 copy', async () => {
    nodes = [makeNode({ id: 'n1', selected: true })];
    edges = [];

    renderHook(() => useBlueprintClipboard({ nodes, edges, setNodes, setEdges }));

    await act(async () => {
      fireKeyDown('c', { ctrlKey: true });
      // 等待 async copy 完成
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+V 键盘快捷键触发 paste', async () => {
    const payload: BlueprintClipboard = {
      kind: BLUEPRINT_CLIPBOARD_KIND,
      nodes: [
        { id: 'n1', kind: 'trigger', position: { x: 0, y: 0 }, config: { type: 'pageLoad' } },
      ],
      edges: [],
    };
    clipboardStore = JSON.stringify(payload);
    nodes = [];
    edges = [];

    renderHook(() => useBlueprintClipboard({ nodes, edges, setNodes, setEdges }));

    await act(async () => {
      fireKeyDown('v', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(setNodes).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+D 键盘快捷键触发 duplicate', () => {
    nodes = [makeNode({ id: 'n1', selected: true })];
    edges = [];

    renderHook(() => useBlueprintClipboard({ nodes, edges, setNodes, setEdges }));

    act(() => {
      fireKeyDown('d', { ctrlKey: true });
    });

    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(writeTextMock).not.toHaveBeenCalled();
  });
});
