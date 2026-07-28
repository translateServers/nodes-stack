/**
 * V2 执行器测试
 *
 * 覆盖：
 * - collectV2Rules 匹配 componentEvent / pageLoad
 * - executeV2Rule 执行 show/hide/toggleVisibility/refreshData/scrollTo/navigate/requestApi
 * - condition 求值选择 then/else 分支
 * - delay step 真实等待后继续执行
 * - dangling 组件跳过
 * - triggerAndExecuteV2 聚合多规则
 */

/* eslint-disable @typescript-eslint/unbound-method -- vitest mock 断言需访问 deps.method 引用，unbound-method 为已知误报 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- 测试构造器中 objectContaining/any(Object) 等匹配器需要灵活类型 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GlobalNavigateConfig, GlobalRequestApiConfig } from '@nebula/shared';
import type {
  V2ActionStep,
  V2CompiledRule,
  V2ConditionStep,
  V2DelayStep,
} from '../compiler/v2-types.js';
import { collectV2Rules } from './v2-matcher.js';
import { executeV2Rule, triggerAndExecuteV2 } from './v2-executor.js';
import type { V2RuntimeDeps, V2TriggerEvent } from './v2-types.js';

// ===== 公共构造器 =====

function makeRule(
  overrides: Partial<V2CompiledRule> & {
    triggerNodeId: string;
    triggerEventId: V2CompiledRule['triggerEventId'];
    triggerComponentId: string;
    steps?: V2CompiledRule['steps'];
  },
): V2CompiledRule {
  return {
    triggerNodeId: overrides.triggerNodeId,
    triggerEventId: overrides.triggerEventId,
    triggerComponentId: overrides.triggerComponentId,
    steps: overrides.steps ?? [],
  };
}

function makeActionStep(
  nodeId: string,
  componentId: string,
  config: V2ActionStep['config'],
): V2ActionStep {
  return { kind: 'action', nodeId, componentId, config };
}

function makeConditionStep(
  nodeId: string,
  expression: V2ConditionStep['expression'],
  thenSteps: V2ConditionStep['thenSteps'] = [],
  elseSteps: V2ConditionStep['elseSteps'] = [],
): V2ConditionStep {
  return { kind: 'condition', nodeId, expression, thenSteps, elseSteps };
}

function makeDelayStep(nodeId: string, delayMs: number): V2DelayStep {
  return { kind: 'delay', nodeId, delayMs };
}

function makeMockDeps(overrides: Partial<V2RuntimeDeps> = {}): V2RuntimeDeps {
  return {
    hasComponent: vi.fn(() => true),
    getComponentValue: vi.fn(() => undefined),
    getComponentData: vi.fn(() => undefined),
    applyVisibility: vi.fn(),
    getVisibility: vi.fn(() => false),
    refreshDataSource: vi.fn().mockResolvedValue(undefined),
    scrollToComponent: vi.fn(),
    openUrl: vi.fn(),
    requestApi: vi.fn().mockResolvedValue({ status: 200, bodyPreview: '', ok: true }),
    logWarning: vi.fn(),
    ...overrides,
  };
}

function navigateConfig(url: string, target: '_blank' | '_self' = '_blank'): GlobalNavigateConfig {
  return { globalType: 'navigate', url, target };
}

function requestApiConfig(overrides: Partial<GlobalRequestApiConfig> = {}): GlobalRequestApiConfig {
  return {
    globalType: 'requestApi',
    method: 'GET',
    url: 'https://api.example.com/data',
    headers: {},
    body: '',
    secretHeaderKeys: [],
    timeoutMs: 10_000,
    ...overrides,
  };
}

// ===== collectV2Rules — 规则匹配 =====

describe('collectV2Rules — V2 规则匹配', () => {
  const clickRule = makeRule({
    triggerNodeId: 'n1',
    triggerEventId: 'click',
    triggerComponentId: 'comp-1',
  });
  const hoverRule = makeRule({
    triggerNodeId: 'n2',
    triggerEventId: 'hover',
    triggerComponentId: 'comp-1',
  });
  const anotherClickRule = makeRule({
    triggerNodeId: 'n3',
    triggerEventId: 'click',
    triggerComponentId: 'comp-2',
  });
  const pageLoadRule = makeRule({
    triggerNodeId: 'n4',
    triggerEventId: 'pageLoad',
    triggerComponentId: 'global',
  });

  const rules = [clickRule, hoverRule, anotherClickRule, pageLoadRule];

  it('componentEvent 匹配 componentId + eventId 都相同的规则', () => {
    const event: V2TriggerEvent = {
      kind: 'componentEvent',
      componentId: 'comp-1',
      eventId: 'click',
    };
    const matched = collectV2Rules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('n1');
  });

  it('componentEvent 不同 eventId 不匹配', () => {
    const event: V2TriggerEvent = {
      kind: 'componentEvent',
      componentId: 'comp-1',
      eventId: 'hover',
    };
    const matched = collectV2Rules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('n2');
  });

  it('componentEvent 不同 componentId 不匹配', () => {
    const event: V2TriggerEvent = {
      kind: 'componentEvent',
      componentId: 'comp-2',
      eventId: 'click',
    };
    const matched = collectV2Rules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('n3');
  });

  it('pageLoad 事件匹配所有 pageLoad 规则', () => {
    const event: V2TriggerEvent = { kind: 'pageLoad' };
    const matched = collectV2Rules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('n4');
  });

  it('componentEvent 空字符串 componentId 不匹配', () => {
    const emptyRule = makeRule({
      triggerNodeId: 'n-empty',
      triggerEventId: 'click',
      triggerComponentId: '',
    });
    const event: V2TriggerEvent = {
      kind: 'componentEvent',
      componentId: '',
      eventId: 'click',
    };
    expect(collectV2Rules([emptyRule], event)).toHaveLength(0);
  });

  it('多规则匹配时保持编译顺序', () => {
    const r1 = makeRule({
      triggerNodeId: 'n-a',
      triggerEventId: 'pageLoad',
      triggerComponentId: 'global',
    });
    const r2 = makeRule({
      triggerNodeId: 'n-b',
      triggerEventId: 'pageLoad',
      triggerComponentId: 'global',
    });
    const r3 = makeRule({
      triggerNodeId: 'n-c',
      triggerEventId: 'pageLoad',
      triggerComponentId: 'global',
    });
    const matched = collectV2Rules([r1, r2, r3], { kind: 'pageLoad' });
    expect(matched.map((r) => r.triggerNodeId)).toEqual(['n-a', 'n-b', 'n-c']);
  });
});

// ===== executeV2Rule — action 步骤执行 =====

describe('executeV2Rule — action 步骤执行', () => {
  it('show 调用 applyVisibility(true)', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeActionStep('a1', 'c2', { actionId: 'show' })],
    });
    const deps = makeMockDeps();

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
    expect(log.results).toHaveLength(1);
    expect(log.results[0].kind).toBe('success');
    expect(log.results[0].actionId).toBe('show');
  });

  it('hide 调用 applyVisibility(false)', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeActionStep('a1', 'c2', { actionId: 'hide' })],
    });
    const deps = makeMockDeps();

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', false);
  });

  it('toggleVisibility 当前不可见时设为可见', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeActionStep('a1', 'c2', { actionId: 'toggleVisibility' })],
    });
    const deps = makeMockDeps({ getVisibility: () => false });

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
  });

  it('toggleVisibility 当前可见时设为不可见', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeActionStep('a1', 'c2', { actionId: 'toggleVisibility' })],
    });
    const deps = makeMockDeps({ getVisibility: () => true });

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', false);
  });

  it('refreshData 调用 refreshDataSource', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeActionStep('a1', 'c2', { actionId: 'refreshData' })],
    });
    const deps = makeMockDeps();

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.refreshDataSource).toHaveBeenCalledWith('c2');
  });

  it('scrollTo 调用 scrollToComponent', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeActionStep('a1', 'c2', { actionId: 'scrollTo' })],
    });
    const deps = makeMockDeps();

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.scrollToComponent).toHaveBeenCalledWith('c2');
  });

  it('navigate 调用 openUrl', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeActionStep('a1', 'global', {
          actionId: 'navigate',
          config: navigateConfig('https://example.com', '_blank'),
        }),
      ],
    });
    const deps = makeMockDeps();

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.openUrl).toHaveBeenCalledWith('https://example.com', '_blank');
  });

  it('navigate 空 URL 跳过', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeActionStep('a1', 'global', {
          actionId: 'navigate',
          config: navigateConfig(''),
        }),
      ],
    });
    const deps = makeMockDeps();

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.openUrl).not.toHaveBeenCalled();
    expect(log.results[0].kind).toBe('skipped');
  });

  it('requestApi 2xx 响应返回 success', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeActionStep('a1', 'global', {
          actionId: 'requestApi',
          config: requestApiConfig(),
        }),
      ],
    });
    const deps = makeMockDeps({
      requestApi: vi.fn().mockResolvedValue({
        status: 200,
        bodyPreview: '{"ok":true}',
        ok: true,
      }),
    });

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.requestApi).toHaveBeenCalledTimes(1);
    expect(log.results[0].kind).toBe('success');
  });

  it('requestApi 4xx/5xx 响应返回 failure 且 error 包含状态码', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeActionStep('a1', 'global', {
          actionId: 'requestApi',
          config: requestApiConfig(),
        }),
      ],
    });
    const deps = makeMockDeps({
      requestApi: vi.fn().mockResolvedValue({
        status: 500,
        bodyPreview: 'Internal Server Error',
        ok: false,
      }),
    });

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(log.results[0].kind).toBe('failure');
    if (log.results[0].kind === 'failure') {
      expect(log.results[0].error).toContain('500');
      expect(log.results[0].error).toContain('Internal Server Error');
    }
  });

  it('requestApi 空 URL 跳过', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeActionStep('a1', 'global', {
          actionId: 'requestApi',
          config: requestApiConfig({ url: '' }),
        }),
      ],
    });
    const deps = makeMockDeps();

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.requestApi).not.toHaveBeenCalled();
    expect(log.results[0].kind).toBe('skipped');
  });

  it('requestApi 调用参数正确传递', async () => {
    const cfg = requestApiConfig({
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: '{"name":"foo"}',
      secretHeaderKeys: ['Authorization'],
      timeoutMs: 5000,
    });
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeActionStep('a1', 'global', { actionId: 'requestApi', config: cfg })],
    });
    const deps = makeMockDeps();

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.requestApi).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: '{"name":"foo"}',
      secretHeaderKeys: ['Authorization'],
      timeoutMs: 5000,
    });
  });
});

// ===== executeV2Rule — dangling 跳过 =====

describe('executeV2Rule — dangling 组件跳过', () => {
  it('dangling 目标组件跳过并记录', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeActionStep('a1', 'missing', { actionId: 'show' }),
        makeActionStep('a2', 'missing', { actionId: 'scrollTo' }),
        makeActionStep('a3', 'missing', { actionId: 'refreshData' }),
        makeActionStep('a4', 'missing', { actionId: 'toggleVisibility' }),
        makeActionStep('a5', 'missing', { actionId: 'hide' }),
      ],
    });
    const deps = makeMockDeps({ hasComponent: () => false });

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(log.results).toHaveLength(5);
    expect(log.results.every((r) => r.kind === 'skipped')).toBe(true);
    expect(deps.applyVisibility).not.toHaveBeenCalled();
    expect(deps.scrollToComponent).not.toHaveBeenCalled();
    expect(deps.refreshDataSource).not.toHaveBeenCalled();
  });

  it('空 componentId 视为未配置跳过', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeActionStep('a1', '', { actionId: 'show' })],
    });
    const deps = makeMockDeps();

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(log.results[0].kind).toBe('skipped');
    expect(deps.applyVisibility).not.toHaveBeenCalled();
  });

  it('前一个动作失败不中断后续独立动作', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeActionStep('a1', 'c2', { actionId: 'refreshData' }),
        makeActionStep('a2', 'c3', { actionId: 'show' }),
      ],
    });
    const deps = makeMockDeps({
      refreshDataSource: vi.fn().mockRejectedValue(new Error('网络错误')),
    });

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(log.results).toHaveLength(2);
    expect(log.results[0].kind).toBe('failure');
    if (log.results[0].kind === 'failure') {
      expect(log.results[0].error).toBe('网络错误');
    }
    expect(log.results[1].kind).toBe('success');
    expect(deps.applyVisibility).toHaveBeenCalledWith('c3', true);
  });
});

// ===== executeV2Rule — condition 求值 =====

describe('executeV2Rule — condition 求值', () => {
  it('表达式为 true 时执行 then 分支', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeConditionStep(
          'cond1',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'status' },
            operator: 'eq',
            value: 'active',
          },
          [makeActionStep('a-then', 'c2', { actionId: 'show' })],
          [makeActionStep('a-else', 'c3', { actionId: 'show' })],
        ),
      ],
    });
    const deps = makeMockDeps({
      getComponentValue: () => ({ status: 'active' }),
    });

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(log.results).toHaveLength(1);
    expect(log.results[0].nodeId).toBe('a-then');
    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
    expect(deps.applyVisibility).not.toHaveBeenCalledWith('c3', true);
  });

  it('表达式为 false 时执行 else 分支', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeConditionStep(
          'cond1',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'status' },
            operator: 'eq',
            value: 'active',
          },
          [makeActionStep('a-then', 'c2', { actionId: 'show' })],
          [makeActionStep('a-else', 'c3', { actionId: 'hide' })],
        ),
      ],
    });
    const deps = makeMockDeps({
      getComponentValue: () => ({ status: 'inactive' }),
    });

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(deps.applyVisibility).toHaveBeenCalledWith('c3', false);
    expect(deps.applyVisibility).not.toHaveBeenCalledWith('c2', true);
  });

  it('componentData 路径支持嵌套字段判断', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'dataLoaded',
      triggerComponentId: 'c1',
      steps: [
        makeConditionStep(
          'cond1',
          {
            source: { kind: 'componentData', componentId: 'c1', path: 'user.age' },
            operator: 'gte',
            value: 18,
          },
          [makeActionStep('a-then', 'c2', { actionId: 'show' })],
        ),
      ],
    });
    const deps = makeMockDeps({
      getComponentData: () => ({ user: { age: 20 } }),
    });

    await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'dataLoaded' },
      deps,
    );

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
  });

  it('empty / notEmpty 运算符按空值语义判断', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeConditionStep(
          'cond1',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'empty',
          },
          [makeActionStep('a-then', 'c2', { actionId: 'show' })],
        ),
        makeConditionStep(
          'cond2',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'notEmpty',
          },
          [makeActionStep('a-then2', 'c3', { actionId: 'show' })],
        ),
      ],
    });
    const deps = makeMockDeps({
      getComponentValue: () => ({ value: '' }),
    });

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    const nodeIds = log.results.map((r) => r.nodeId);
    expect(nodeIds).toContain('a-then');
    expect(nodeIds).not.toContain('a-then2');
  });

  it('condition 内嵌 condition 递归执行', async () => {
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeConditionStep(
          'cond1',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'a' },
            operator: 'eq',
            value: true,
          },
          [
            makeConditionStep(
              'cond2',
              {
                source: { kind: 'componentProp', componentId: 'c1', key: 'b' },
                operator: 'eq',
                value: true,
              },
              [makeActionStep('a-deep', 'c2', { actionId: 'show' })],
            ),
          ],
        ),
      ],
    });
    const deps = makeMockDeps({
      getComponentValue: () => ({ a: true, b: true }),
    });

    const log = await executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(log.results).toHaveLength(1);
    expect(log.results[0].nodeId).toBe('a-deep');
  });
});

// ===== executeV2Rule - delay step 真实等待 =====

describe('executeV2Rule - delay step 真实等待', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delay step 真实等待 delayMs 后继续执行后续步骤，不产生 ActionResult', async () => {
    vi.useFakeTimers();
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [
        makeActionStep('a1', 'c2', { actionId: 'show' }),
        makeDelayStep('d1', 500),
        makeActionStep('a2', 'c3', { actionId: 'show' }),
      ],
    });
    const deps = makeMockDeps();

    const promise = executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    // a1 立即执行，a2 尚未执行（被 delay 阻塞）
    await vi.advanceTimersByTimeAsync(0);
    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
    expect(deps.applyVisibility).not.toHaveBeenCalledWith('c3', true);

    // 推进 500ms 后 a2 执行
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(deps.applyVisibility).toHaveBeenCalledWith('c3', true);
    // delay step 不产生 ActionResult，不记录告警
    expect(deps.logWarning).not.toHaveBeenCalled();
  });

  it('delayMs=0 不阻塞后续步骤', async () => {
    vi.useFakeTimers();
    const rule = makeRule({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      steps: [makeDelayStep('d1', 0), makeActionStep('a1', 'c2', { actionId: 'show' })],
    });
    const deps = makeMockDeps();

    const promise = executeV2Rule(
      rule,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
  });
});
// ===== triggerAndExecuteV2 — 多规则聚合 =====

describe('triggerAndExecuteV2 — 多规则聚合', () => {
  it('componentEvent 事件触发所有匹配规则', async () => {
    const rules = [
      makeRule({
        triggerNodeId: 'n1',
        triggerEventId: 'click',
        triggerComponentId: 'c1',
        steps: [makeActionStep('a1', 'c2', { actionId: 'show' })],
      }),
      makeRule({
        triggerNodeId: 'n2',
        triggerEventId: 'click',
        triggerComponentId: 'c1',
        steps: [makeActionStep('a2', 'c3', { actionId: 'hide' })],
      }),
      makeRule({
        triggerNodeId: 'n3',
        triggerEventId: 'click',
        triggerComponentId: 'c2',
        steps: [makeActionStep('a3', 'c4', { actionId: 'show' })],
      }),
    ];
    const deps = makeMockDeps();

    const logs = await triggerAndExecuteV2(
      rules,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(logs).toHaveLength(2);
    expect(logs[0].triggerNodeId).toBe('n1');
    expect(logs[1].triggerNodeId).toBe('n2');
    expect(deps.applyVisibility).toHaveBeenCalledTimes(2);
  });

  it('pageLoad 事件触发所有 pageLoad 规则', async () => {
    const rules = [
      makeRule({
        triggerNodeId: 'n1',
        triggerEventId: 'pageLoad',
        triggerComponentId: 'global',
        steps: [makeActionStep('a1', 'c2', { actionId: 'show' })],
      }),
      makeRule({
        triggerNodeId: 'n2',
        triggerEventId: 'click',
        triggerComponentId: 'c1',
        steps: [makeActionStep('a2', 'c3', { actionId: 'hide' })],
      }),
    ];
    const deps = makeMockDeps();

    const logs = await triggerAndExecuteV2(rules, { kind: 'pageLoad' }, deps);

    expect(logs).toHaveLength(1);
    expect(logs[0].triggerNodeId).toBe('n1');
  });

  it('返回的执行日志包含 trigger 信息', async () => {
    const rules = [
      makeRule({
        triggerNodeId: 'n1',
        triggerEventId: 'click',
        triggerComponentId: 'c1',
        steps: [makeActionStep('a1', 'c2', { actionId: 'show' })],
      }),
    ];
    const deps = makeMockDeps();

    const logs = await triggerAndExecuteV2(
      rules,
      { kind: 'componentEvent', componentId: 'c1', eventId: 'click' },
      deps,
    );

    expect(logs[0]).toEqual({
      triggerNodeId: 'n1',
      triggerEventId: 'click',
      triggerComponentId: 'c1',
      results: expect.arrayContaining([expect.any(Object)]),
      truncated: false,
    });
  });
});
