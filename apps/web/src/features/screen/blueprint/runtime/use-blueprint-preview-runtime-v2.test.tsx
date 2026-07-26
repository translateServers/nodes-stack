/**
 * useBlueprintPreviewRuntime Hook V2 集成测试（任务 3.3）
 *
 * 验证 V2 蓝图运行时集成：
 * - V2 蓝图编译：编译为 V2CompiledRule[]
 * - pageLoad 事件在 mount 时触发
 * - onComponentEvent 派发到匹配规则
 * - onComponentClick 兼容 V2（映射为 click 事件）
 * - 错误诊断的规则被排除
 * - V1 蓝图保持兼容（onComponentClick 仍走 V1 路径）
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { EventBlueprint, EventBlueprintV2, ScreenComponent } from '@nebula/shared';
import { EVENT_BLUEPRINT_VERSION_V2, GLOBAL_COMPONENT_ID } from '@nebula/shared';
import { useBlueprintPreviewRuntime } from './index';

// ===== Mock fetch helper =====

function mockJsonResponse(data: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: () => Promise.resolve(data),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

function makeApiComponent(id: string, url = 'https://example.com/api/chart'): ScreenComponent {
  return {
    ...makeComponent(id),
    type: 'bar-chart',
    dataSource: {
      type: 'api',
      apiConfig: { url, method: 'GET' },
    },
  } as unknown as ScreenComponent;
}

/** 构造 V2 蓝图：pageLoad → show 组件 B */
function makeV2PageLoadBlueprint(targetId = 'comp-target'): EventBlueprintV2 {
  return {
    version: EVENT_BLUEPRINT_VERSION_V2,
    nodes: [
      {
        id: 'global-page-load',
        kind: 'component',
        position: { x: 0, y: 0 },
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'pageLoad',
      },
      {
        id: 'comp-target',
        kind: 'component',
        position: { x: 200, y: 0 },
        componentId: targetId,
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'global-page-load',
        sourceHandle: 'evt:pageLoad',
        target: 'comp-target',
        targetHandle: 'act:show',
      },
    ],
  };
}

/** 构造 V2 蓝图：组件 A 的 click → 隐藏组件 B */
function makeV2ClickBlueprint(triggerId = 'comp-a', targetId = 'comp-b'): EventBlueprintV2 {
  return {
    version: EVENT_BLUEPRINT_VERSION_V2,
    nodes: [
      {
        id: 'node-a',
        kind: 'component',
        position: { x: 0, y: 0 },
        componentId: triggerId,
      },
      {
        id: 'node-b',
        kind: 'component',
        position: { x: 200, y: 0 },
        componentId: targetId,
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'node-a',
        sourceHandle: 'evt:click',
        target: 'node-b',
        targetHandle: 'act:hide',
      },
    ],
  };
}

/** 构造 V2 蓝图：组件 A 的 hover → 显示组件 B */
function makeV2HoverBlueprint(triggerId = 'comp-a', targetId = 'comp-b'): EventBlueprintV2 {
  return {
    version: EVENT_BLUEPRINT_VERSION_V2,
    nodes: [
      {
        id: 'node-a',
        kind: 'component',
        position: { x: 0, y: 0 },
        componentId: triggerId,
      },
      {
        id: 'node-b',
        kind: 'component',
        position: { x: 200, y: 0 },
        componentId: targetId,
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'node-a',
        sourceHandle: 'evt:hover',
        target: 'node-b',
        targetHandle: 'act:show',
      },
    ],
  };
}

// ===== V2 测试 =====

describe('useBlueprintPreviewRuntime - V2 蓝图集成（任务 3.3）', () => {
  it('V2 蓝图编译产出 V2CompiledRule[]', () => {
    const component = makeComponent('comp-target');
    const blueprint = makeV2PageLoadBlueprint('comp-target');

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    expect(result.current.compiledRulesV2).toHaveLength(1);
    expect(result.current.compiledRulesV2[0]?.triggerEventId).toBe('pageLoad');
    expect(result.current.compiledRulesV2[0]?.triggerComponentId).toBe(GLOBAL_COMPONENT_ID);
    expect(result.current.isEnabled).toBe(true);
    // V1 compiledRules 应为空（V2 蓝图）
    expect(result.current.compiledRules).toHaveLength(0);
  });

  it('V2 pageLoad 事件在 mount 时触发：执行 show 动作', async () => {
    const component = makeComponent('comp-target');
    const blueprint = makeV2PageLoadBlueprint('comp-target');

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-target')).toBe(true);
    });
  });

  it('V2 onComponentEvent click 触发对应规则', async () => {
    const componentA = makeComponent('comp-a');
    const componentB = makeComponent('comp-b');
    const blueprint = makeV2ClickBlueprint('comp-a', 'comp-b');

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [componentA, componentB]),
    );

    // pageLoad 不匹配，初始无副作用
    await Promise.resolve();
    expect(result.current.contextValue.visibilityOverrides.size).toBe(0);

    act(() => {
      result.current.onComponentEvent('comp-a', 'click');
    });

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-b')).toBe(false);
    });
  });

  it('V2 onComponentEvent hover 触发对应规则', async () => {
    const componentA = makeComponent('comp-a');
    const componentB = makeComponent('comp-b');
    const blueprint = makeV2HoverBlueprint('comp-a', 'comp-b');

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [componentA, componentB]),
    );

    act(() => {
      result.current.onComponentEvent('comp-a', 'hover');
    });

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-b')).toBe(true);
    });
  });

  it('V2 onComponentClick 映射为 click 事件', async () => {
    const componentA = makeComponent('comp-a');
    const componentB = makeComponent('comp-b');
    const blueprint = makeV2ClickBlueprint('comp-a', 'comp-b');

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [componentA, componentB]),
    );

    act(() => {
      result.current.onComponentClick('comp-a');
    });

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-b')).toBe(false);
    });
  });

  it('V2 蓝图 refreshData 动作触发后写入 apiDataOverrides', async () => {
    const payload = [{ name: 'NEW', value: 1 }];
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const chartComponent = makeApiComponent('comp-chart');
    const triggerComponent = makeComponent('comp-trigger');
    const blueprint: EventBlueprintV2 = {
      version: EVENT_BLUEPRINT_VERSION_V2,
      nodes: [
        {
          id: 'node-trigger',
          kind: 'component',
          position: { x: 0, y: 0 },
          componentId: 'comp-trigger',
        },
        {
          id: 'node-chart',
          kind: 'component',
          position: { x: 200, y: 0 },
          componentId: 'comp-chart',
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'node-trigger',
          sourceHandle: 'evt:click',
          target: 'node-chart',
          targetHandle: 'act:refreshData',
        },
      ],
    };

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [chartComponent, triggerComponent]),
    );

    act(() => {
      result.current.onComponentEvent('comp-trigger', 'click');
    });

    await waitFor(() => {
      expect(result.current.contextValue.apiDataOverrides.get('comp-chart')).toEqual(payload);
    });
  });

  it('V2 蓝图 error 诊断的 trigger 节点排除规则', () => {
    // 构造 dangling 组件节点（componentId 不存在）→ error 级诊断
    const blueprint: EventBlueprintV2 = {
      version: EVENT_BLUEPRINT_VERSION_V2,
      nodes: [
        {
          id: 'node-dangling',
          kind: 'component',
          position: { x: 0, y: 0 },
          componentId: 'non-existent',
        },
        {
          id: 'node-target',
          kind: 'component',
          position: { x: 200, y: 0 },
          componentId: 'comp-target',
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'node-dangling',
          sourceHandle: 'evt:click',
          target: 'node-target',
          targetHandle: 'act:show',
        },
      ],
    };
    const component = makeComponent('comp-target');

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    // node-dangling 有 error 诊断，规则被排除
    expect(result.current.compiledRulesV2).toHaveLength(0);
    expect(result.current.isEnabled).toBe(false);
  });

  it('V2 onComponentEvent 在 isEnabled=false 时为 no-op', async () => {
    const component = makeComponent('comp-a');
    const blueprint: EventBlueprintV2 = {
      version: EVENT_BLUEPRINT_VERSION_V2,
      nodes: [],
      edges: [],
    };

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    expect(result.current.isEnabled).toBe(false);
    act(() => {
      result.current.onComponentEvent('comp-a', 'click');
    });
    await Promise.resolve();
    expect(result.current.contextValue.visibilityOverrides.size).toBe(0);
  });

  it('V1 蓝图保持兼容：onComponentClick 走 V1 路径', async () => {
    const componentA = makeComponent('comp-a');
    const componentB = makeComponent('comp-b');
    const v1Blueprint: EventBlueprint = {
      version: 1,
      nodes: [
        {
          id: 't-click',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'comp-a' },
        },
        {
          id: 'a-hide-b',
          kind: 'action',
          position: { x: 200, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'comp-b', visible: 'hide' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 't-click',
          sourceHandle: 'out',
          target: 'a-hide-b',
          targetHandle: 'in',
        },
      ],
    };

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(v1Blueprint, [componentA, componentB]),
    );

    expect(result.current.compiledRules).toHaveLength(1);
    expect(result.current.compiledRulesV2).toHaveLength(0);

    act(() => {
      result.current.onComponentClick('comp-a');
    });

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-b')).toBe(false);
    });
  });

  it('V1 蓝图 onComponentEvent 将 click 映射为 componentClick', async () => {
    const componentA = makeComponent('comp-a');
    const componentB = makeComponent('comp-b');
    const v1Blueprint: EventBlueprint = {
      version: 1,
      nodes: [
        {
          id: 't-click',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'comp-a' },
        },
        {
          id: 'a-hide-b',
          kind: 'action',
          position: { x: 200, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'comp-b', visible: 'hide' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 't-click',
          sourceHandle: 'out',
          target: 'a-hide-b',
          targetHandle: 'in',
        },
      ],
    };

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(v1Blueprint, [componentA, componentB]),
    );

    act(() => {
      result.current.onComponentEvent('comp-a', 'click');
    });

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-b')).toBe(false);
    });
  });
});
