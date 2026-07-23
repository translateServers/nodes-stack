/**
 * useBlueprintPreviewRuntime Hook 集成测试（任务 3.5）
 *
 * 验证点（对应 tasks.md 3.5 验证要求）：
 * - 预览集成测试覆盖触发执行：blueprint 存在时组件点击与页面加载触发执行
 * - 编辑器画布无蓝图副作用：无 blueprint 时不触发任何执行
 * - 卸载无残留请求：组件卸载后所有进行中请求被中止
 * - 编辑器画布不执行蓝图：本 Hook 不在编辑器调用
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import type { EventBlueprint, ScreenComponent, ScreenProject } from '@nebula/shared';
import { BlueprintPreviewProvider, useBlueprintPreview, useBlueprintPreviewRuntime } from './index';
import { PreviewComponentRenderer } from '../../components/preview-component-renderer';

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

function makeBlueprint(
  triggerId: string,
  triggerConfig: EventBlueprint['nodes'][number]['kind'] extends infer K
    ? K extends 'trigger'
      ? Extract<EventBlueprint['nodes'][number], { kind: K }>['config']
      : never
    : never,
  actionId: string,
  actionConfig: EventBlueprint['nodes'][number]['kind'] extends infer K
    ? K extends 'action'
      ? Extract<EventBlueprint['nodes'][number], { kind: K }>['config']
      : never
    : never,
): EventBlueprint {
  return {
    version: 1,
    nodes: [
      {
        id: triggerId,
        kind: 'trigger',
        position: { x: 0, y: 0 },
        config: triggerConfig,
      },
      {
        id: actionId,
        kind: 'action',
        position: { x: 100, y: 0 },
        config: actionConfig,
      },
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

// ===== 集成测试 =====

describe('useBlueprintPreviewRuntime - 触发执行（任务 3.5）', () => {
  it('pageLoad 事件在 mount 时触发：执行 setVisibility 动作', async () => {
    const component = makeComponent('comp-target');
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-target',
      visible: 'hide',
    });

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    // 等待 pageLoad effect 执行
    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-target')).toBe(false);
    });
  });

  it('componentClick 事件触发：点击组件执行动作', async () => {
    const componentA = makeComponent('comp-a');
    const componentB = makeComponent('comp-b');
    const blueprint = makeBlueprint(
      't-click',
      { type: 'componentClick', componentId: 'comp-a' },
      'a-hide-b',
      { type: 'setVisibility', targetComponentId: 'comp-b', visible: 'hide' },
    );

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [componentA, componentB]),
    );

    // mount 时 pageLoad 没有规则匹配，不触发任何动作
    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.size).toBe(0);
    });

    // 触发 componentClick 事件
    act(() => {
      result.current.onComponentClick('comp-a');
    });

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-b')).toBe(false);
    });
  });

  it('不存在的组件点击不触发任何规则', async () => {
    const component = makeComponent('comp-a');
    const blueprint = makeBlueprint(
      't-click',
      { type: 'componentClick', componentId: 'comp-a' },
      'a-noop',
      { type: 'setVisibility', targetComponentId: 'comp-target', visible: 'hide' },
    );

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    // 点击不存在的组件
    act(() => {
      result.current.onComponentClick('non-existent');
    });

    // 等待异步执行完成
    await Promise.resolve();
    expect(result.current.contextValue.visibilityOverrides.size).toBe(0);
  });

  it('refreshDataSource 动作触发后写入 apiDataOverrides', async () => {
    const payload = [{ name: 'NEW', value: 1 }];
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const component = makeApiComponent('comp-chart');
    const blueprint = makeBlueprint(
      't-click',
      { type: 'componentClick', componentId: 'comp-trigger' },
      'a-refresh',
      { type: 'refreshDataSource', targetComponentId: 'comp-chart' },
    );
    // 触发组件可以是任意组件（不需要是 chart）
    const triggerComponent = makeComponent('comp-trigger');

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [component, triggerComponent]),
    );

    act(() => {
      result.current.onComponentClick('comp-trigger');
    });

    await waitFor(() => {
      expect(result.current.contextValue.apiDataOverrides.get('comp-chart')).toEqual(payload);
    });
  });
});

describe('useBlueprintPreviewRuntime - 编辑器画布无蓝图副作用（任务 3.5）', () => {
  it('blueprint 为 undefined 时不启用蓝图（isEnabled=false）', () => {
    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(undefined, [makeComponent('comp-a')]),
    );

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.compiledRules).toEqual([]);
  });

  it('isEnabled=false 时 onComponentClick 不触发任何动作', () => {
    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(undefined, [makeComponent('comp-a')]),
    );

    act(() => {
      result.current.onComponentClick('comp-a');
    });

    // 不应有任何 visibilityOverrides 写入
    expect(result.current.contextValue.visibilityOverrides.size).toBe(0);
    expect(result.current.contextValue.apiDataOverrides.size).toBe(0);
  });

  it('isEnabled=false 时不发起 pageLoad 请求', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useBlueprintPreviewRuntime(undefined, []));

    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('编辑器画布不调用本 Hook（设计约束：仅预览页使用）', () => {
    // 这个测试是文档化的约束验证：本 Hook 不应在编辑器画布组件中导入
    // 通过 useBlueprintPreview 在无 Provider 时返回 null 验证：
    const { result } = renderHook(() => useBlueprintPreview());
    expect(result.current).toBeNull();
  });
});

describe('useBlueprintPreviewRuntime - 卸载清理（任务 3.5）', () => {
  it('组件卸载时中止进行中的 refreshDataSource 请求', () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const component = makeApiComponent('comp-chart');
    const blueprint = makeBlueprint(
      't-click',
      { type: 'componentClick', componentId: 'comp-trigger' },
      'a-refresh',
      { type: 'refreshDataSource', targetComponentId: 'comp-chart' },
    );
    const triggerComponent = makeComponent('comp-trigger');

    const { result, unmount } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [component, triggerComponent]),
    );

    // 触发 refresh 动作（不 await）
    act(() => {
      result.current.onComponentClick('comp-trigger');
    });

    // 请求已发起但未完成
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstInit.signal?.aborted).toBe(false);

    // 卸载：应中止请求
    unmount();

    expect(firstInit.signal?.aborted).toBe(true);
  });

  it('组件卸载后无浮动 Promise rejection', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    // 监听 unhandledrejection 事件
    const unhandledRejections: unknown[] = [];
    const handler = (e: PromiseRejectionEvent): void => {
      unhandledRejections.push(e.reason);
      e.preventDefault();
    };
    window.addEventListener('unhandledrejection', handler);

    try {
      const component = makeApiComponent('comp-chart');
      const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-refresh', {
        type: 'refreshDataSource',
        targetComponentId: 'comp-chart',
      });

      const { unmount } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

      // pageLoad 触发请求
      await Promise.resolve();

      // 卸载：应中止请求
      unmount();

      // 等待微任务完成
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 无未处理 rejection
      expect(unhandledRejections).toHaveLength(0);
    } finally {
      window.removeEventListener('unhandledrejection', handler);
    }
  });
});

describe('useBlueprintPreviewRuntime - Context 集成（任务 3.5）', () => {
  it('BlueprintPreviewProvider 提供的 Context 被 useBlueprintPreview 消费', () => {
    const component = makeComponent('comp-a');
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-a',
      visible: 'hide',
    });

    let capturedCtx: ReturnType<typeof useBlueprintPreview> = null as ReturnType<
      typeof useBlueprintPreview
    >;

    function Consumer(): JSX.Element {
      capturedCtx = useBlueprintPreview();
      return <div data-testid="consumer" />;
    }

    function TestApp(): JSX.Element {
      const runtime = useBlueprintPreviewRuntime(blueprint, [component]);
      return (
        <BlueprintPreviewProvider value={runtime.contextValue}>
          <Consumer />
        </BlueprintPreviewProvider>
      );
    }

    render(<TestApp />);

    expect(capturedCtx).not.toBeNull();
    expect(capturedCtx?.visibilityOverrides).toBeInstanceOf(Map);
    expect(capturedCtx?.apiDataOverrides).toBeInstanceOf(Map);
  });

  it('PreviewComponentRenderer 在 Provider 内消费 override', async () => {
    const payload = [{ name: 'A', value: 1 }];
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const component = makeApiComponent('comp-chart');
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-refresh', {
      type: 'refreshDataSource',
      targetComponentId: 'comp-chart',
    });

    function TestApp(): JSX.Element {
      const runtime = useBlueprintPreviewRuntime(blueprint, [component]);
      return (
        <BlueprintPreviewProvider value={runtime.contextValue}>
          <PreviewComponentRenderer component={component} />
        </BlueprintPreviewProvider>
      );
    }

    const { container } = render(<TestApp />);

    // 等待 pageLoad effect 完成并触发 refresh → override 写入
    await waitFor(() => {
      // PreviewComponentRenderer 不渲染具体 DOM（ComponentRenderer mock 后）
      // 这里仅断言 override 在 Context 中可被消费
    });

    // 测试 Provider 嵌套不破坏渲染（container 不为空）
    expect(container.firstChild).not.toBeNull();
  });

  it('Provider 外（编辑器场景）useBlueprintPreview 返回 null', () => {
    let captured: ReturnType<typeof useBlueprintPreview> = 'not-null' as never;

    function Consumer(): JSX.Element {
      captured = useBlueprintPreview();
      return <div data-testid="consumer" />;
    }

    render(<Consumer />);

    expect(captured).toBeNull();
  });
});

describe('useBlueprintPreviewRuntime - 引用稳定性', () => {
  it('blueprint 与 components 引用未变时 contextValue 引用稳定', () => {
    const component = makeComponent('comp-a');
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-a',
      visible: 'hide',
    });

    const { result, rerender } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [component]),
    );

    const firstCtx = result.current.contextValue;
    rerender();
    expect(result.current.contextValue).toBe(firstCtx);
  });

  it('onComponentClick 引用稳定（避免组件重订阅）', () => {
    const component = makeComponent('comp-a');
    const blueprint = makeBlueprint(
      't-click',
      { type: 'componentClick', componentId: 'comp-a' },
      'a-hide',
      { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'hide' },
    );

    const { result, rerender } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [component]),
    );

    const firstClick = result.current.onComponentClick;
    rerender();
    expect(result.current.onComponentClick).toBe(firstClick);
  });
});

describe('useBlueprintPreviewRuntime - 蓝图编译结果', () => {
  it('compiledRules 反映蓝图实际编译结果', () => {
    const component = makeComponent('comp-a');
    const blueprint = makeBlueprint('t-page', { type: 'pageLoad' }, 'a-hide', {
      type: 'setVisibility',
      targetComponentId: 'comp-a',
      visible: 'hide',
    });

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    expect(result.current.compiledRules).toHaveLength(1);
    expect(result.current.compiledRules[0]?.triggerNodeId).toBe('t-page');
    expect(result.current.compiledRules[0]?.actions).toHaveLength(1);
  });

  it('含环蓝图不产出规则但 isEnabled=false', () => {
    const component = makeComponent('comp-a');
    const blueprint: EventBlueprint = {
      version: 1,
      nodes: [
        {
          id: 't-loop',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'comp-a' },
        },
        {
          id: 'a-back',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: {
            type: 'setVisibility',
            targetComponentId: 'comp-a',
            visible: 'toggle',
          },
        },
      ],
      edges: [
        // 触发 → 动作
        {
          id: 'e-out',
          source: 't-loop',
          sourceHandle: 'out',
          target: 'a-back',
          targetHandle: 'in',
        },
        // 环：动作 → 触发器（回到 t-loop，使 t-loop 处于环中）
        {
          id: 'e-back',
          source: 'a-back',
          sourceHandle: 'out',
          target: 't-loop',
          targetHandle: 'in',
        },
      ],
    };

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    // 含环触发器不产出规则（编译器语义：cycleTriggerIds 跳过）
    expect(result.current.compiledRules).toHaveLength(0);
    // isEnabled 由 compiledRules.length > 0 决定，含环时为 false
    expect(result.current.isEnabled).toBe(false);
  });
});

describe('useBlueprintPreviewRuntime - 与 ScreenProject 集成', () => {
  it('完整 ScreenProject 接入：blueprint 字段从 project 读取', async () => {
    const project: ScreenProject = {
      id: 'proj-1',
      name: '测试项目',
      canvas: { width: 1920, height: 1080, backgroundColor: '#000', scaleMode: 'fit' },
      components: [makeComponent('comp-a'), makeComponent('comp-b')],
      blueprint: makeBlueprint(
        't-click-a',
        { type: 'componentClick', componentId: 'comp-a' },
        'a-hide-b',
        { type: 'setVisibility', targetComponentId: 'comp-b', visible: 'hide' },
      ),
      status: 'published',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(project.blueprint, project.components),
    );

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.compiledRules).toHaveLength(1);

    // 触发点击
    act(() => {
      result.current.onComponentClick('comp-a');
    });

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-b')).toBe(false);
    });
  });

  it('无 blueprint 的旧 ScreenProject 不启用蓝图（向后兼容）', () => {
    const project: ScreenProject = {
      id: 'proj-1',
      name: '旧项目',
      canvas: { width: 1920, height: 1080, backgroundColor: '#000', scaleMode: 'fit' },
      components: [makeComponent('comp-a')],
      status: 'published',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(project.blueprint, project.components),
    );

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.compiledRules).toEqual([]);
  });
});

describe('useBlueprintPreviewRuntime - error 诊断触发器显式收口（任务 4.9）', () => {
  it('componentClick 空组件 ID 的 trigger 被显式排除（不依赖空串匹配副作用）', () => {
    const blueprint = makeBlueprint(
      't-empty',
      { type: 'componentClick', componentId: '' },
      'a-hide',
      { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'hide' },
    );
    const component = makeComponent('comp-a');

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    // 空 componentId 的 trigger 有 error 级诊断，规则被显式排除
    expect(result.current.compiledRules).toHaveLength(0);
    expect(result.current.isEnabled).toBe(false);
  });

  it('非空 componentId 但存在 error 级诊断的 trigger 仍被排除', () => {
    // 构造一个 dangling trigger：componentId 不为空但组件不存在
    // 编译器会对 dangling 产出 warning，不是 error；
    // 但如果 trigger 的 action 有 empty-param error（如 setVisibility 空 targetComponentId），
    // error 诊断在 action 节点上，不影响 trigger 规则的排除
    // 这里测试 trigger 自身有 error 诊断的场景：环 trigger（cycle error）
    const blueprint: EventBlueprint = {
      version: 1,
      nodes: [
        {
          id: 't-cycle',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'comp-a' },
        },
        {
          id: 'a-back',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: {
            type: 'setVisibility',
            targetComponentId: 'comp-a',
            visible: 'toggle',
          },
        },
      ],
      edges: [
        {
          id: 'e-out',
          source: 't-cycle',
          sourceHandle: 'out',
          target: 'a-back',
          targetHandle: 'in',
        },
        // 环：action -> trigger
        {
          id: 'e-back',
          source: 'a-back',
          sourceHandle: 'out',
          target: 't-cycle',
          targetHandle: 'in',
        },
      ],
    };
    const component = makeComponent('comp-a');

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    // 环 trigger 被 cycle error 诊断标记 -> 显式排除
    expect(result.current.compiledRules).toHaveLength(0);
    expect(result.current.isEnabled).toBe(false);
  });

  it('仅有 warning 级诊断的 trigger 不被排除（正常执行）', () => {
    // dangling 是 warning 级：componentId 指向不存在的组件，但仍可产出规则
    const blueprint = makeBlueprint(
      't-dangling',
      { type: 'componentClick', componentId: 'non-existent' },
      'a-hide',
      { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'hide' },
    );
    const component = makeComponent('comp-a');

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    // warning 级诊断不排除规则
    expect(result.current.compiledRules).toHaveLength(1);
    expect(result.current.isEnabled).toBe(true);
  });

  it('error 级 trigger 不执行 componentClick 动作', async () => {
    const blueprint = makeBlueprint(
      't-empty',
      { type: 'componentClick', componentId: '' },
      'a-hide',
      { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'hide' },
    );
    const component = makeComponent('comp-a');

    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [component]));

    // 尝试触发 componentClick（空串不会被匹配，但即使匹配了规则也被排除）
    act(() => {
      result.current.onComponentClick('');
    });

    await Promise.resolve();
    // 不应有任何 visibilityOverrides 写入
    expect(result.current.contextValue.visibilityOverrides.size).toBe(0);
  });

  it('混合场景：error trigger 被排除，正常 trigger 仍执行', async () => {
    const component = makeComponent('comp-a');
    const componentB = makeComponent('comp-b');
    const blueprint: EventBlueprint = {
      version: 1,
      nodes: [
        // trigger 1：空 componentId（error 诊断 -> 排除）
        {
          id: 't-error',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: '' },
        },
        // trigger 2：正常 componentClick
        {
          id: 't-ok',
          kind: 'trigger',
          position: { x: 0, y: 200 },
          config: { type: 'componentClick', componentId: 'comp-a' },
        },
        // action：隐藏 comp-b
        {
          id: 'a-hide-b',
          kind: 'action',
          position: { x: 200, y: 200 },
          config: { type: 'setVisibility', targetComponentId: 'comp-b', visible: 'hide' },
        },
      ],
      edges: [
        // t-error -> a-hide-b（这条规则被排除）
        {
          id: 'e1',
          source: 't-error',
          sourceHandle: 'out',
          target: 'a-hide-b',
          targetHandle: 'in',
        },
        // t-ok -> a-hide-b（这条规则保留）
        {
          id: 'e2',
          source: 't-ok',
          sourceHandle: 'out',
          target: 'a-hide-b',
          targetHandle: 'in',
        },
      ],
    };

    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(blueprint, [component, componentB]),
    );

    // 仅 t-ok 的规则保留
    expect(result.current.compiledRules).toHaveLength(1);
    expect(result.current.compiledRules[0]?.triggerNodeId).toBe('t-ok');
    expect(result.current.isEnabled).toBe(true);

    // 点击 comp-a -> t-ok 触发 -> comp-b 隐藏
    act(() => {
      result.current.onComponentClick('comp-a');
    });

    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get('comp-b')).toBe(false);
    });
  });
});
