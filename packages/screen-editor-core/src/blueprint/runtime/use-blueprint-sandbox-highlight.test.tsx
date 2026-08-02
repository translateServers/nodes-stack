/**
 * useBlueprintSandboxHighlight Hook 单元测试（任务 8.2）
 *
 * 验证点（对应 tasks.md 8.2 验证要求）：
 * - 组件测试覆盖高亮状态机
 * - 节点依次亮起、边流动高亮、动画结束自动复位
 *
 * 使用 vitest 假定时器控制 STEP_INTERVAL_MS / HOLD_MS 推进。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { EventBlueprint } from '@nebula/shared';
import {
  useBlueprintSandboxHighlight,
  deriveExecutionPath,
} from './use-blueprint-sandbox-highlight';
import type { RuleExecutionLog } from './types';

// ===== 公共构造器 =====

function makeLog(triggerId: string, actionIds: string[]): RuleExecutionLog {
  return {
    triggerNodeId: triggerId,
    results: actionIds.map((id) => ({
      kind: 'success' as const,
      nodeId: id,
      durationMs: 1,
    })),
    truncated: false,
  };
}

function makeBlueprint(
  triggerId: string,
  actionIds: string[],
  edgeIds: string[] = [],
): EventBlueprint {
  const nodes: EventBlueprint['nodes'] = [
    { id: triggerId, kind: 'trigger', position: { x: 0, y: 0 }, config: { type: 'pageLoad' } },
  ];
  for (const id of actionIds) {
    nodes.push({
      id,
      kind: 'action',
      position: { x: 100, y: 0 },
      config: { type: 'setVisibility', targetComponentId: 'c', visible: 'show' },
    });
  }
  const edges: EventBlueprint['edges'] = [];
  const all = [triggerId, ...actionIds];
  for (let i = 0; i < all.length - 1; i++) {
    const eid = edgeIds[i] ?? `e-${i}`;
    edges.push({
      id: eid,
      source: all[i] ?? '',
      sourceHandle: 'out',
      target: all[i + 1] ?? '',
      targetHandle: 'in',
    });
  }
  return { version: 1, nodes, edges };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ===== deriveExecutionPath 纯函数 =====

describe('deriveExecutionPath - 纯函数', () => {
  it('log 为 undefined：返回空路径', () => {
    const path = deriveExecutionPath(undefined, []);
    expect(path.nodes).toEqual([]);
    expect(path.edges).toEqual([]);
  });

  it('无 action：路径仅含 trigger 节点，无边', () => {
    const log: RuleExecutionLog = {
      triggerNodeId: 't1',
      results: [],
      truncated: false,
    };
    const path = deriveExecutionPath(log, []);
    expect(path.nodes).toEqual(['t1']);
    expect(path.edges).toEqual([]);
  });

  it('链式 action：按序派生节点 + 匹配的边', () => {
    const log = makeLog('t1', ['a1', 'a2', 'a3']);
    const edges = makeBlueprint('t1', ['a1', 'a2', 'a3'], ['edge-1', 'edge-2', 'edge-3']).edges;
    const path = deriveExecutionPath(log, edges);
    expect(path.nodes).toEqual(['t1', 'a1', 'a2', 'a3']);
    expect(path.edges).toEqual(['edge-1', 'edge-2', 'edge-3']);
  });

  it('相邻节点在 blueprint.edges 中无匹配边：该段边缺失', () => {
    const log = makeLog('t1', ['a1', 'a2']);
    // 仅提供 t1→a1 的边，缺 a1→a2
    const edges = [
      { id: 'edge-1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' },
    ];
    const path = deriveExecutionPath(log, edges);
    expect(path.nodes).toEqual(['t1', 'a1', 'a2']);
    expect(path.edges).toEqual(['edge-1']); // 仅 1 条边
  });
});

// ===== 高亮状态机 =====

describe('useBlueprintSandboxHighlight - 状态机（任务 8.2）', () => {
  it('初始无 executionLogs：idle，空高亮集合', () => {
    const blueprint = makeBlueprint('t1', ['a1']);
    const { result } = renderHook(() => useBlueprintSandboxHighlight([], blueprint));

    expect(result.current.isAnimating).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.totalSteps).toBe(0);
    expect(result.current.highlightedNodeIds.size).toBe(0);
    expect(result.current.highlightedEdgeIds.size).toBe(0);
  });

  it('blueprint 为 undefined + executionLogs：派生节点但无边', () => {
    const log = makeLog('t1', ['a1']);
    const { result } = renderHook(() => useBlueprintSandboxHighlight([log], undefined));

    expect(result.current.totalSteps).toBe(2); // t1 + a1
    // 初始 step=0，定时器尚未推进
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isAnimating).toBe(true);
  });

  it('executionLogs 设置后启动动画：节点依次亮起', () => {
    const log = makeLog('t1', ['a1', 'a2']);
    const blueprint = makeBlueprint('t1', ['a1', 'a2'], ['e1', 'e2']);

    const { result } = renderHook(() => useBlueprintSandboxHighlight([log], blueprint));

    expect(result.current.isAnimating).toBe(true);
    expect(result.current.totalSteps).toBe(3);

    // 初始：step=0，无亮起
    expect(result.current.currentStep).toBe(0);
    expect(result.current.highlightedNodeIds.size).toBe(0);
    expect(result.current.highlightedEdgeIds.size).toBe(0);

    // 推进 1 步：亮起 t1，无边
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.highlightedNodeIds.has('t1')).toBe(true);
    expect(result.current.highlightedNodeIds.size).toBe(1);
    expect(result.current.highlightedEdgeIds.size).toBe(0);

    // 推进 2 步：亮起 t1+a1，1 条边
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.currentStep).toBe(2);
    expect(result.current.highlightedNodeIds.has('a1')).toBe(true);
    expect(result.current.highlightedNodeIds.size).toBe(2);
    expect(result.current.highlightedEdgeIds.has('e1')).toBe(true);
    expect(result.current.highlightedEdgeIds.size).toBe(1);

    // 推进 3 步：亮起 t1+a1+a2，2 条边
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.currentStep).toBe(3);
    expect(result.current.highlightedNodeIds.has('a2')).toBe(true);
    expect(result.current.highlightedNodeIds.size).toBe(3);
    expect(result.current.highlightedEdgeIds.has('e2')).toBe(true);
    expect(result.current.highlightedEdgeIds.size).toBe(2);
  });

  it('全部节点亮起后保持 HOLD_MS，然后自动复位', () => {
    const log = makeLog('t1', ['a1']);
    const blueprint = makeBlueprint('t1', ['a1'], ['e1']);

    const { result } = renderHook(() => useBlueprintSandboxHighlight([log], blueprint));

    // 推进到全部亮起（2 步 × 300ms = 600ms）
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.currentStep).toBe(2);
    expect(result.current.isAnimating).toBe(true);

    // 仍在保持期内（HOLD_MS=1200ms），未复位
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.currentStep).toBe(2);
    expect(result.current.isAnimating).toBe(true);

    // 保持期结束，复位
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.highlightedNodeIds.size).toBe(0);
    expect(result.current.highlightedEdgeIds.size).toBe(0);
  });

  it('executionLogs 变化：重启动画', () => {
    const log1 = makeLog('t1', ['a1']);
    const log2 = makeLog('t2', ['a2', 'a3']);
    const blueprint: EventBlueprint = {
      version: 1,
      nodes: [
        { id: 't1', kind: 'trigger', position: { x: 0, y: 0 }, config: { type: 'pageLoad' } },
        {
          id: 'a1',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'c', visible: 'show' },
        },
        { id: 't2', kind: 'trigger', position: { x: 0, y: 100 }, config: { type: 'pageLoad' } },
        {
          id: 'a2',
          kind: 'action',
          position: { x: 100, y: 100 },
          config: { type: 'setVisibility', targetComponentId: 'c', visible: 'show' },
        },
        {
          id: 'a3',
          kind: 'action',
          position: { x: 200, y: 100 },
          config: { type: 'setVisibility', targetComponentId: 'c', visible: 'show' },
        },
      ],
      edges: [
        { id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' },
        { id: 'e2', source: 't2', sourceHandle: 'out', target: 'a2', targetHandle: 'in' },
        { id: 'e3', source: 'a2', sourceHandle: 'out', target: 'a3', targetHandle: 'in' },
      ],
    };

    const { result, rerender } = renderHook(
      ({ logs }: { logs: RuleExecutionLog[] }) => useBlueprintSandboxHighlight(logs, blueprint),
      { initialProps: { logs: [log1] } },
    );

    // 推进 log1 的动画到一半
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.highlightedNodeIds.has('t1')).toBe(true);

    // 切换到 log2：动画重启
    rerender({ logs: [log2] });
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isAnimating).toBe(true);
    expect(result.current.totalSteps).toBe(3); // t2 + a2 + a3
    expect(result.current.highlightedNodeIds.size).toBe(0);

    // 推进 log2 动画
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.highlightedNodeIds.has('t2')).toBe(true);
    expect(result.current.highlightedNodeIds.has('t1')).toBe(false);
  });

  it('executionLogs 清空（[]）：状态复位为 idle', () => {
    const log = makeLog('t1', ['a1']);
    const blueprint = makeBlueprint('t1', ['a1'], ['e1']);

    const { result, rerender } = renderHook(
      ({ logs }: { logs: RuleExecutionLog[] }) => useBlueprintSandboxHighlight(logs, blueprint),
      { initialProps: { logs: [log] } },
    );

    // 推进动画
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isAnimating).toBe(true);

    // 清空 executionLogs
    rerender({ logs: [] });
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.totalSteps).toBe(0);
    expect(result.current.highlightedNodeIds.size).toBe(0);
  });

  it('卸载时清理定时器（无残留回调）', () => {
    const log = makeLog('t1', ['a1', 'a2']);
    const blueprint = makeBlueprint('t1', ['a1', 'a2'], ['e1', 'e2']);

    const { result, unmount } = renderHook(() => useBlueprintSandboxHighlight([log], blueprint));

    // 推进部分动画
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.currentStep).toBe(1);

    // 卸载：定时器应被清理
    unmount();

    // 推进时间，不应有状态变化（无 console error/warning 关于 setState on unmounted）
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // 卸载后 result.current 不再有意义，仅验证不抛错
  });

  it('skipped 动作仍计入执行路径（高亮不区分成功/跳过）', () => {
    const log: RuleExecutionLog = {
      triggerNodeId: 't1',
      results: [
        { kind: 'success', nodeId: 'a1', durationMs: 1 },
        { kind: 'skipped', nodeId: 'a2', reason: 'dangling' },
        { kind: 'success', nodeId: 'a3', durationMs: 1 },
      ],
      truncated: false,
    };
    const blueprint = makeBlueprint('t1', ['a1', 'a2', 'a3'], ['e1', 'e2', 'e3']);

    const { result } = renderHook(() => useBlueprintSandboxHighlight([log], blueprint));

    expect(result.current.totalSteps).toBe(4); // t1 + a1 + a2 + a3

    // 推进到全部亮起
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.currentStep).toBe(4);
    expect(result.current.highlightedNodeIds.has('a2')).toBe(true); // skipped 也亮起
    expect(result.current.highlightedEdgeIds.has('e2')).toBe(true);
  });
});
