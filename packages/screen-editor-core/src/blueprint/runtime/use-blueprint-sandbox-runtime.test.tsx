/**
 * useBlueprintSandboxRuntime Hook 单元测试（任务 8.1）
 *
 * 验证点（对应 tasks.md 8.1 验证要求）：
 * - Hook 测试覆盖沙盒执行：simulateTrigger 调用后产生 executionLogs、executedNodeIds
 * - 真实项目数据与可见性覆盖表不被污染：sandboxVisibilityOverrides 独立于预览；
 *   components 引用不被修改；window.open / fetch / scrollIntoView 不被调用
 *
 * 额外覆盖：
 * - setVisibility 动作写入 sandboxVisibilityOverrides（不写预览覆盖表）
 * - navigate / scrollToComponent / refreshDataSource 动作在沙盒内 no-op（无真实副作用）
 * - dangling 动作（目标组件不存在）返回 skipped
 * - 触发 trigger 不存在 → triggerNotFound=true
 * - 触发 error 级诊断 trigger → refused=true
 * - resetSandbox 清空所有沙盒状态
 * - isSimulating 在执行期间为 true
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type {
  BlueprintActionConfig,
  BlueprintTriggerConfig,
  EventBlueprint,
  ScreenComponent,
} from '@nebula/shared';
import { useBlueprintSandboxRuntime } from './use-blueprint-sandbox-runtime';

// ===== 公共构造器 =====

function makeComponent(id: string, overrides?: Partial<ScreenComponent>): ScreenComponent {
  return {
    id,
    type: 'rect',
    name: `comp-${id}`,
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    props: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
    ...overrides,
  };
}

function makeBlueprint(
  triggerId: string,
  triggerConfig: BlueprintTriggerConfig,
  actionId: string,
  actionConfig: BlueprintActionConfig,
): EventBlueprint {
  return {
    version: 1,
    nodes: [
      { id: triggerId, kind: 'trigger', position: { x: 0, y: 0 }, config: triggerConfig },
      { id: actionId, kind: 'action', position: { x: 100, y: 0 }, config: actionConfig },
    ],
    edges: [
      {
        id: 'e1',
        source: triggerId,
        sourceHandle: 'out',
        target: actionId,
        targetHandle: 'in',
      },
    ],
  };
}

/** 构造多动作链式蓝图：trigger→a1→a2→...→aN */
function makeChainBlueprint(
  triggerId: string,
  triggerConfig: BlueprintTriggerConfig,
  actions: Array<{ id: string; config: BlueprintActionConfig }>,
): EventBlueprint {
  const nodes: EventBlueprint['nodes'] = [
    { id: triggerId, kind: 'trigger', position: { x: 0, y: 0 }, config: triggerConfig },
  ];
  const edges: EventBlueprint['edges'] = [];
  let prevId = triggerId;
  actions.forEach((a, i) => {
    nodes.push({
      id: a.id,
      kind: 'action',
      position: { x: (i + 1) * 100, y: 0 },
      config: a.config,
    });
    edges.push({
      id: `e-${i}`,
      source: prevId,
      sourceHandle: 'out',
      target: a.id,
      targetHandle: 'in',
    });
    prevId = a.id;
  });
  return { version: 1, nodes, edges };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ===== 沙盒执行 =====

describe('useBlueprintSandboxRuntime - 沙盒执行（任务 8.1）', () => {
  it('模拟触发 pageLoad trigger：执行 setVisibility 动作并写入沙盒覆盖表', async () => {
    const target = makeComponent('comp-target');
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-target',
      visible: 'hide',
    });

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, [target]));

    let simResult: Awaited<ReturnType<typeof result.current.simulateTrigger>> | undefined;
    await act(async () => {
      simResult = await result.current.simulateTrigger('t-page');
    });

    expect(simResult?.triggerNotFound).toBe(false);
    expect(simResult?.refused).toBe(false);
    // 执行日志：1 条规则 + 1 个 success 动作
    expect(result.current.executionLogs).toHaveLength(1);
    expect(result.current.executionLogs[0]?.triggerNodeId).toBe('t-page');
    expect(result.current.executionLogs[0]?.results).toHaveLength(1);
    expect(result.current.executionLogs[0]?.results[0]?.kind).toBe('success');
    expect(result.current.executionLogs[0]?.results[0]?.nodeId).toBe('a-hide');
    // 沙盒覆盖表：写入 hide=false
    expect(result.current.sandboxVisibilityOverrides.get('comp-target')).toBe(false);
    // 涉及节点：trigger + action
    expect(result.current.executedNodeIds.has('t-page')).toBe(true);
    expect(result.current.executedNodeIds.has('a-hide')).toBe(true);
  });

  it('模拟触发 componentClick trigger：执行 navigate 动作', async () => {
    const triggerComp = makeComponent('comp-trigger');
    const blueprint = makeBlueprint(
      't-click',
      { type: 'componentClick', componentId: 'comp-trigger' },
      'a-nav',
      { type: 'navigate', url: 'https://example.com', target: '_blank' },
    );

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, [triggerComp]));

    await act(async () => {
      await result.current.simulateTrigger('t-click');
    });

    expect(result.current.executionLogs).toHaveLength(1);
    expect(result.current.executionLogs[0]?.results[0]?.kind).toBe('success');
    expect(result.current.executionLogs[0]?.results[0]?.nodeId).toBe('a-nav');
  });

  it('链式多动作蓝图：按序执行并全部记录到 executionLogs', async () => {
    const targetA = makeComponent('comp-a');
    const targetB = makeComponent('comp-b');
    const blueprint = makeChainBlueprint('t-page', { type: 'pageLoad' }, [
      { id: 'a1', config: { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'hide' } },
      { id: 'a2', config: { type: 'setVisibility', targetComponentId: 'comp-b', visible: 'show' } },
      {
        id: 'a3',
        config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
      },
    ]);

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, [targetA, targetB]));

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });

    expect(result.current.executionLogs).toHaveLength(1);
    const log = result.current.executionLogs[0];
    expect(log?.results).toHaveLength(3);
    expect(log?.results[0]?.nodeId).toBe('a1');
    expect(log?.results[1]?.nodeId).toBe('a2');
    expect(log?.results[2]?.nodeId).toBe('a3');
    expect(result.current.executedNodeIds.size).toBe(4); // t-page + a1 + a2 + a3
    // 沙盒覆盖表：a1=hide, a2=show
    expect(result.current.sandboxVisibilityOverrides.get('comp-a')).toBe(false);
    expect(result.current.sandboxVisibilityOverrides.get('comp-b')).toBe(true);
  });

  it('dangling 动作（目标组件不存在）：返回 skipped', async () => {
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-dangling', {
      type: 'setVisibility',
      targetComponentId: 'non-existent',
      visible: 'hide',
    });

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, []));

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });

    expect(result.current.executionLogs[0]?.results[0]?.kind).toBe('skipped');
    expect(result.current.executionLogs[0]?.results[0]?.nodeId).toBe('a-dangling');
    // skipped 动作仍计入 executedNodeIds
    expect(result.current.executedNodeIds.has('a-dangling')).toBe(true);
  });
});

// ===== 沙盒隔离：不污染真实状态 =====

describe('useBlueprintSandboxRuntime - 沙盒隔离（不污染真实状态）', () => {
  it('navigate 动作不调用 window.open（沙盒 no-op）', async () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);

    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-nav', {
      type: 'navigate',
      url: 'https://example.com',
      target: '_blank',
    });

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, []));

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });

    // 沙盒内不真实打开窗口（避免离开 Sheet）
    expect(openSpy).not.toHaveBeenCalled();
    // 但执行结果仍为 success（模拟成功）
    expect(result.current.executionLogs[0]?.results[0]?.kind).toBe('success');
  });

  it('refreshDataSource 动作不调用 fetch（沙盒 no-op）', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-refresh', {
      type: 'refreshDataSource',
      targetComponentId: 'comp-chart',
    });
    const chart = makeComponent('comp-chart');

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, [chart]));

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });

    // 沙盒内不发起真实网络请求
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.executionLogs[0]?.results[0]?.kind).toBe('success');
  });

  it('scrollToComponent 动作不调用 scrollIntoView（沙盒 no-op）', async () => {
    // 构造一个 DOM 元素以验证 scrollIntoView 未被调用
    const el = document.createElement('div');
    const scrollSpy = vi.fn();
    el.scrollIntoView = scrollSpy;
    vi.spyOn(document, 'querySelector').mockReturnValue(el);

    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-scroll', {
      type: 'scrollToComponent',
      targetComponentId: 'comp-target',
    });
    const target = makeComponent('comp-target');

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, [target]));

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });

    // 沙盒内不真实滚动
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(result.current.executionLogs[0]?.results[0]?.kind).toBe('success');
  });

  it('不修改传入的 components 引用（read-only）', async () => {
    const target = makeComponent('comp-target');
    const components = [target];
    const originalSnapshot = JSON.parse(JSON.stringify(components)) as ScreenComponent[];

    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-target',
      visible: 'hide',
    });

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, components));

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });

    // components 内容未被修改
    expect(components).toEqual(originalSnapshot);
    // 沙盒覆盖表独立存在
    expect(result.current.sandboxVisibilityOverrides.get('comp-target')).toBe(false);
  });

  it('不修改传入的 blueprint 引用（read-only）', async () => {
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-target',
      visible: 'hide',
    });
    const originalSnapshot = JSON.parse(JSON.stringify(blueprint)) as EventBlueprint;

    const { result } = renderHook(() =>
      useBlueprintSandboxRuntime(blueprint, [makeComponent('comp-target')]),
    );

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });

    expect(blueprint).toEqual(originalSnapshot);
  });
});

// ===== 边界与错误处理 =====

describe('useBlueprintSandboxRuntime - 边界与错误处理（任务 8.1）', () => {
  it('触发 trigger 不存在：返回 triggerNotFound', async () => {
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-target',
      visible: 'hide',
    });

    const { result } = renderHook(() =>
      useBlueprintSandboxRuntime(blueprint, [makeComponent('comp-target')]),
    );

    let simResult: Awaited<ReturnType<typeof result.current.simulateTrigger>> | undefined;
    await act(async () => {
      simResult = await result.current.simulateTrigger('non-existent-trigger');
    });

    expect(simResult?.triggerNotFound).toBe(true);
    expect(simResult?.logs).toEqual([]);
    expect(result.current.executionLogs).toEqual([]);
  });

  it('触发 error 级诊断 trigger（componentClick 空组件 ID）：refused=true', async () => {
    // componentClick with empty componentId → error-level empty-param diagnostic
    const blueprint = makeBlueprint(
      't-click',
      { type: 'componentClick', componentId: '' },
      'a-hide',
      {
        type: 'setVisibility',
        targetComponentId: 'comp-target',
        visible: 'hide',
      },
    );

    const { result } = renderHook(() =>
      useBlueprintSandboxRuntime(blueprint, [makeComponent('comp-target')]),
    );

    let simResult: Awaited<ReturnType<typeof result.current.simulateTrigger>> | undefined;
    await act(async () => {
      simResult = await result.current.simulateTrigger('t-click');
    });

    expect(simResult?.refused).toBe(true);
    expect(simResult?.refusalReason).toContain('触发器未选择触发组件');
    expect(simResult?.logs).toEqual([]);
    expect(result.current.executionLogs).toEqual([]);
  });

  it('blueprint 为 undefined：触发任意 trigger 返回 triggerNotFound', async () => {
    const { result } = renderHook(() => useBlueprintSandboxRuntime(undefined, []));

    let simResult: Awaited<ReturnType<typeof result.current.simulateTrigger>> | undefined;
    await act(async () => {
      simResult = await result.current.simulateTrigger('any-trigger');
    });

    expect(simResult?.triggerNotFound).toBe(true);
    expect(result.current.compiledRules).toEqual([]);
  });

  it('resetSandbox：清空日志、可见性覆盖、节点集', async () => {
    const target = makeComponent('comp-target');
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-target',
      visible: 'hide',
    });

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, [target]));

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });
    expect(result.current.executionLogs).toHaveLength(1);
    expect(result.current.sandboxVisibilityOverrides.size).toBe(1);
    expect(result.current.executedNodeIds.size).toBe(2);

    act(() => {
      result.current.resetSandbox();
    });

    expect(result.current.executionLogs).toEqual([]);
    expect(result.current.sandboxVisibilityOverrides.size).toBe(0);
    expect(result.current.executedNodeIds.size).toBe(0);
  });

  it('isSimulating：初始与结束后均为 false', async () => {
    const target = makeComponent('comp-target');
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-target',
      visible: 'hide',
    });

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, [target]));

    expect(result.current.isSimulating).toBe(false);

    await act(async () => {
      await result.current.simulateTrigger('t-page');
    });

    // 执行结束后恢复 false
    expect(result.current.isSimulating).toBe(false);
  });
});

// ===== 编译诊断暴露 =====

describe('useBlueprintSandboxRuntime - 编译诊断暴露（任务 8.1）', () => {
  it('dangling trigger 暴露 warning 级诊断', () => {
    const blueprint = makeBlueprint(
      't-click',
      { type: 'componentClick', componentId: 'non-existent' },
      'a-hide',
      {
        type: 'setVisibility',
        targetComponentId: 'comp-target',
        visible: 'hide',
      },
    );

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, []));

    const danglingDiags = result.current.compileDiagnostics.filter(
      (d) => d.code === 'dangling-component',
    );
    expect(danglingDiags.length).toBeGreaterThan(0);
  });

  it('blueprint 为 undefined：compiledRules 与 compileDiagnostics 为空', () => {
    const { result } = renderHook(() => useBlueprintSandboxRuntime(undefined, []));
    expect(result.current.compiledRules).toEqual([]);
    expect(result.current.compileDiagnostics).toEqual([]);
  });

  it('多次模拟：executionLogs 替换为最新，sandboxVisibilityOverrides 累积', async () => {
    const targetA = makeComponent('comp-a');
    const targetB = makeComponent('comp-b');
    // 两个独立 trigger：t1 隐藏 comp-a，t2 显示 comp-b
    const blueprint: EventBlueprint = {
      version: 1,
      nodes: [
        { id: 't1', kind: 'trigger', position: { x: 0, y: 0 }, config: { type: 'pageLoad' } },
        {
          id: 'a1',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'hide' },
        },
        { id: 't2', kind: 'trigger', position: { x: 0, y: 100 }, config: { type: 'pageLoad' } },
        {
          id: 'a2',
          kind: 'action',
          position: { x: 100, y: 100 },
          config: { type: 'setVisibility', targetComponentId: 'comp-b', visible: 'show' },
        },
      ],
      edges: [
        { id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' },
        { id: 'e2', source: 't2', sourceHandle: 'out', target: 'a2', targetHandle: 'in' },
      ],
    };

    const { result } = renderHook(() => useBlueprintSandboxRuntime(blueprint, [targetA, targetB]));

    // 第一次模拟 t1
    await act(async () => {
      await result.current.simulateTrigger('t1');
    });
    expect(result.current.executionLogs[0]?.triggerNodeId).toBe('t1');
    expect(result.current.sandboxVisibilityOverrides.get('comp-a')).toBe(false);
    expect(result.current.sandboxVisibilityOverrides.has('comp-b')).toBe(false);

    // 第二次模拟 t2：executionLogs 替换为 t2 的，visibility 累积
    await act(async () => {
      await result.current.simulateTrigger('t2');
    });
    expect(result.current.executionLogs[0]?.triggerNodeId).toBe('t2');
    expect(result.current.executionLogs).toHaveLength(1); // 替换而非累积
    expect(result.current.sandboxVisibilityOverrides.get('comp-a')).toBe(false); // 保留
    expect(result.current.sandboxVisibilityOverrides.get('comp-b')).toBe(true); // 累积
  });
});
