import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Node, Edge } from '@xyflow/react';
import { useBlueprintShortcuts } from './use-blueprint-shortcuts';
import { useScreenEditorStore } from '../../stores/editor-store';

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    type: 'action',
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    type: 'exec',
    ...overrides,
  };
}

function fireKeyDown(key: string, options: { ctrlKey?: boolean; shiftKey?: boolean } = {}): void {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    metaKey: false,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

describe('useBlueprintShortcuts（任务 5.4）', () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onCloseSearchPanel: ReturnType<typeof vi.fn<() => void>>;
  let setNodes: ReturnType<typeof vi.fn<(updater: (nds: Node[]) => Node[]) => void>>;
  let setEdges: ReturnType<typeof vi.fn<(updater: (eds: Edge[]) => Edge[]) => void>>;
  let isConnectingRef: React.RefObject<boolean>;

  beforeEach(() => {
    onClose = vi.fn<() => void>();
    onCloseSearchPanel = vi.fn<() => void>();
    setNodes = vi.fn<(updater: (nds: Node[]) => Node[]) => void>(() => undefined);
    setEdges = vi.fn<(updater: (eds: Edge[]) => Edge[]) => void>(() => undefined);
    isConnectingRef = { current: false };

    // 重置 store 状态
    useScreenEditorStore.setState({
      history: { past: [], future: [] },
      isDirty: false,
    });
  });

  it('Ctrl+Z 调用 undo', () => {
    const store = useScreenEditorStore.getState();
    const undoSpy = vi.spyOn(store, 'undo');

    renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: false,
        onCloseSearchPanel,
        nodes: [],
        edges: [],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    act(() => {
      fireKeyDown('z', { ctrlKey: true });
    });

    expect(undoSpy).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+Z 调用 redo', () => {
    const store = useScreenEditorStore.getState();
    const redoSpy = vi.spyOn(store, 'redo');

    renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: false,
        onCloseSearchPanel,
        nodes: [],
        edges: [],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    act(() => {
      fireKeyDown('z', { ctrlKey: true, shiftKey: true });
    });

    expect(redoSpy).toHaveBeenCalledTimes(1);
  });

  it('Esc + 搜索面板打开 → 关闭搜索面板', () => {
    renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: true,
        onCloseSearchPanel,
        nodes: [makeNode({ selected: true })],
        edges: [],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    act(() => {
      fireKeyDown('Escape');
    });

    expect(onCloseSearchPanel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(setNodes).not.toHaveBeenCalled();
  });

  it('Esc + 连线进行中 → 不关闭弹层也不取消选择', () => {
    isConnectingRef.current = true;

    renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: false,
        onCloseSearchPanel,
        nodes: [makeNode({ selected: true })],
        edges: [],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    act(() => {
      fireKeyDown('Escape');
    });

    // 连线进行中：让 ReactFlow 处理取消，hook 不做任何操作
    expect(onClose).not.toHaveBeenCalled();
    expect(onCloseSearchPanel).not.toHaveBeenCalled();
    expect(setNodes).not.toHaveBeenCalled();
  });

  it('Esc + 有选中节点 → 取消选择', () => {
    renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: false,
        onCloseSearchPanel,
        nodes: [makeNode({ selected: true }), makeNode({ id: 'node-2', selected: false })],
        edges: [],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    act(() => {
      fireKeyDown('Escape');
    });

    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(setEdges).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Esc + 有选中边 → 取消选择', () => {
    renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: false,
        onCloseSearchPanel,
        nodes: [],
        edges: [makeEdge({ selected: true })],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    act(() => {
      fireKeyDown('Escape');
    });

    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(setEdges).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Esc + 无选中 → 关闭弹层', () => {
    renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: false,
        onCloseSearchPanel,
        nodes: [makeNode({ selected: false })],
        edges: [makeEdge({ selected: false })],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    act(() => {
      fireKeyDown('Escape');
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(setNodes).not.toHaveBeenCalled();
    expect(setEdges).not.toHaveBeenCalled();
  });

  it('Esc 分层顺序：搜索面板 > 连线 > 选择 > 关闭', () => {
    // 搜索面板 + 选中节点同时存在 → 只关闭搜索面板
    renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: true,
        onCloseSearchPanel,
        nodes: [makeNode({ selected: true })],
        edges: [],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    act(() => {
      fireKeyDown('Escape');
    });

    expect(onCloseSearchPanel).toHaveBeenCalledTimes(1);
    expect(setNodes).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('组件卸载后不再响应快捷键', () => {
    const { unmount } = renderHook(() =>
      useBlueprintShortcuts({
        onClose,
        searchPanelVisible: false,
        onCloseSearchPanel,
        nodes: [makeNode({ selected: false })],
        edges: [],
        setNodes,
        setEdges,
        isConnectingRef,
      }),
    );

    unmount();

    act(() => {
      fireKeyDown('Escape');
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
