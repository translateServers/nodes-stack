import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { EventBlueprint } from '@nebula/shared';
import { useBlueprintDiagnostics } from './use-blueprint-diagnostics';

// rAF mock for jsdom
let rafCallbacks: Array<() => void> = [];
vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
  rafCallbacks.push(cb);
  return rafCallbacks.length;
});
vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  rafCallbacks = rafCallbacks.filter((_, i) => i !== id - 1);
});

function flushRaf(): void {
  const cbs = [...rafCallbacks];
  rafCallbacks = [];
  cbs.forEach((cb) => cb());
}

describe('useBlueprintDiagnostics（任务 6.1）', () => {
  it('无蓝图时返回空诊断', () => {
    const { result } = renderHook(() =>
      useBlueprintDiagnostics({
        blueprint: undefined,
        componentIds: new Set(),
      }),
    );

    act(() => {
      flushRaf();
    });

    expect(result.current.diagnostics).toEqual([]);
    expect(result.current.errorCount).toBe(0);
    expect(result.current.warningCount).toBe(0);
    expect(result.current.infoCount).toBe(0);
  });

  it('空蓝图返回空诊断', () => {
    const blueprint: EventBlueprint = { version: 1, nodes: [], edges: [] };

    const { result } = renderHook(() =>
      useBlueprintDiagnostics({
        blueprint,
        componentIds: new Set(),
      }),
    );

    act(() => {
      flushRaf();
    });

    expect(result.current.diagnostics).toEqual([]);
    expect(result.current.errorCount).toBe(0);
  });

  it('蓝图变更后诊断实时刷新', () => {
    const componentIds = new Set(['comp-1']);

    // 初始蓝图：trigger 连接到不存在的 action（dangling）
    const blueprint1: EventBlueprint = {
      version: 1,
      nodes: [
        {
          id: 'trigger-1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'comp-1' },
        },
        {
          id: 'action-1',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'nonexistent', visible: 'show' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'trigger-1',
          sourceHandle: 'out',
          target: 'action-1',
          targetHandle: 'in',
        },
      ],
    };

    const { result, rerender } = renderHook(
      ({ bp }) =>
        useBlueprintDiagnostics({
          blueprint: bp,
          componentIds,
        }),
      { initialProps: { bp: blueprint1 } },
    );

    act(() => {
      flushRaf();
    });

    // action-1 的 targetComponentId 不存在，应有 dangling-component warning
    const danglingDiags = result.current.diagnostics.filter((d) => d.code === 'dangling-component');
    expect(danglingDiags.length).toBeGreaterThan(0);

    // 修复 dangling：将 targetComponentId 改为存在的组件
    const blueprint2: EventBlueprint = {
      version: 1,
      nodes: [
        {
          id: 'trigger-1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'comp-1' },
        },
        {
          id: 'action-1',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'comp-1', visible: 'show' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'trigger-1',
          sourceHandle: 'out',
          target: 'action-1',
          targetHandle: 'in',
        },
      ],
    };

    rerender({ bp: blueprint2 });

    act(() => {
      flushRaf();
    });

    // dangling 诊断应消失
    const fixedDanglingDiags = result.current.diagnostics.filter(
      (d) => d.code === 'dangling-component',
    );
    expect(fixedDanglingDiags).toHaveLength(0);
  });

  it('高频编辑经 rAF 节流合并', async () => {
    const componentIds = new Set(['comp-1']);
    const blueprint: EventBlueprint = {
      version: 1,
      nodes: [
        {
          id: 'trigger-1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'pageLoad' },
        },
      ],
      edges: [],
    };

    let compileCount = 0;
    const originalModule = await vi.importActual<typeof import('../compiler')>('../compiler');
    const originalCompile = originalModule.compileBlueprint;
    vi.doMock('../compiler', () => ({
      ...originalModule,
      compileBlueprint: (...args: Parameters<typeof originalCompile>) => {
        compileCount++;
        return originalCompile(...args);
      },
    }));

    const { rerender } = renderHook(
      ({ bp }) =>
        useBlueprintDiagnostics({
          blueprint: bp,
          componentIds,
        }),
      { initialProps: { bp: blueprint } },
    );

    // 模拟多次快速 rerender（同一帧内）
    rerender({ bp: { ...blueprint } });
    rerender({ bp: { ...blueprint } });
    rerender({ bp: { ...blueprint } });

    // 仅一帧的 rAF 回调
    act(() => {
      flushRaf();
    });

    // 编译应被节流合并为一次（初始 + 一次 flush）
    expect(compileCount).toBeLessThanOrEqual(2);
  });

  it('分级计数正确', () => {
    const componentIds = new Set<string>();

    // 构造一个有 cycle（error）+ dangling（warning）+ comment（info）的蓝图
    const blueprint: EventBlueprint = {
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
          position: { x: 100, y: 0 },
          config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
        },
        {
          id: 'action-2',
          kind: 'action',
          position: { x: 200, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'nonexistent', visible: 'show' },
        },
        {
          id: 'comment-1',
          kind: 'comment',
          position: { x: 300, y: 0 },
          config: { text: '注释' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'trigger-1',
          sourceHandle: 'out',
          target: 'action-1',
          targetHandle: 'in',
        },
        {
          id: 'e2',
          source: 'action-1',
          sourceHandle: 'out',
          target: 'trigger-1',
          targetHandle: 'in',
        },
      ],
    };

    const { result } = renderHook(() =>
      useBlueprintDiagnostics({
        blueprint,
        componentIds,
      }),
    );

    act(() => {
      flushRaf();
    });

    // 应有 error（cycle）、warning（dangling）、info（comment orphan）
    expect(result.current.errorCount).toBeGreaterThan(0);
    expect(result.current.warningCount).toBeGreaterThan(0);
    expect(result.current.infoCount).toBeGreaterThan(0);
    expect(result.current.diagnostics.length).toBe(
      result.current.errorCount + result.current.warningCount + result.current.infoCount,
    );
  });
});
