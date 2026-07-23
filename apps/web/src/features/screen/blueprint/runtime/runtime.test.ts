import { describe, it, expect, vi } from 'vitest';
import type { CompiledCondition, CompiledRule } from '../compiler/types.js';
import type { ConditionNodeConfig } from '@nebula/shared';
import { collectRules } from './matcher.js';
import { planActions, MAX_TRIGGER_DEPTH } from './plan.js';
import { executeRule, triggerAndExecute } from './executor.js';
import type { RuntimeDeps, TriggerEventType } from './types.js';

// ===== 公共构造器 =====

function makeRule(
  triggerNodeId: string,
  triggerConfig: CompiledRule['triggerConfig'],
  actions: CompiledRule['actions'],
  conditions: CompiledRule['conditions'] = [],
): CompiledRule {
  return { triggerNodeId, triggerConfig, actions, conditions };
}

function makeCondition(
  nodeId: string,
  expression: ConditionNodeConfig['expression'],
  thenActions: CompiledCondition['thenActions'] = [],
  elseActions: CompiledCondition['elseActions'] = [],
  depth = 0,
): CompiledCondition {
  return {
    nodeId,
    config: { type: 'condition', expression },
    thenActions,
    elseActions,
    depth,
  };
}

function makeMockDeps(overrides: Partial<RuntimeDeps> = {}): RuntimeDeps {
  return {
    applyVisibility: vi.fn(),
    getVisibility: vi.fn(() => undefined),
    openUrl: vi.fn(),
    scrollToComponent: vi.fn(),
    refreshDataSource: vi.fn().mockResolvedValue(undefined),
    hasComponent: vi.fn(() => true),
    logWarning: vi.fn(),
    requestApi: vi.fn().mockResolvedValue({ status: 200, bodyPreview: '', ok: true }),
    getComponentValue: vi.fn(() => undefined),
    getComponentData: vi.fn(() => undefined),
    ...overrides,
  };
}

// ===== 任务 3.1：规则匹配 =====

describe('collectRules — 规则匹配', () => {
  const clickRule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, []);
  const pageLoadRule = makeRule('t2', { type: 'pageLoad' }, []);
  const anotherClickRule = makeRule('t3', { type: 'componentClick', componentId: 'c2' }, []);
  const rules = [clickRule, pageLoadRule, anotherClickRule];

  it('componentClick 事件匹配相同 componentId 的规则', () => {
    const event: TriggerEventType = { kind: 'componentClick', componentId: 'c1' };
    const matched = collectRules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('t1');
  });

  it('pageLoad 事件匹配所有 pageLoad 规则', () => {
    const event: TriggerEventType = { kind: 'pageLoad' };
    const matched = collectRules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('t2');
  });

  it('不匹配其他 componentId 的规则', () => {
    const event: TriggerEventType = { kind: 'componentClick', componentId: 'c3' };
    const matched = collectRules(rules, event);
    expect(matched).toHaveLength(0);
  });

  it('空字符串 componentId 不匹配任何事件', () => {
    const emptyRule = makeRule('t-empty', { type: 'componentClick', componentId: '' }, []);
    const event: TriggerEventType = { kind: 'componentClick', componentId: '' };
    expect(collectRules([emptyRule], event)).toHaveLength(0);
  });

  it('多规则匹配时保持编译顺序', () => {
    const r1 = makeRule('t1', { type: 'pageLoad' }, []);
    const r2 = makeRule('t2', { type: 'pageLoad' }, []);
    const r3 = makeRule('t3', { type: 'pageLoad' }, []);
    const event: TriggerEventType = { kind: 'pageLoad' };
    const matched = collectRules([r1, r2, r3], event);
    expect(matched.map((r) => r.triggerNodeId)).toEqual(['t1', 't2', 't3']);
  });
});

// ===== 任务 3.1 + 3.2：执行计划展开与深度截断 =====

describe('planActions — 执行计划展开', () => {
  it('按顺序展开动作', () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'toggle' },
        depth: 0,
      },
      {
        nodeId: 'a2',
        config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
        depth: 1,
      },
    ]);

    const plan = planActions(rule);

    expect(plan.actions).toHaveLength(2);
    expect(plan.actions[0].nodeId).toBe('a1');
    expect(plan.actions[1].nodeId).toBe('a2');
  });

  it('深度低于上限的动作全部保留', () => {
    const rule = makeRule('t1', { type: 'pageLoad' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        depth: MAX_TRIGGER_DEPTH - 1,
      },
    ]);

    const plan = planActions(rule);

    expect(plan.actions).toHaveLength(1);
    expect(plan.truncationWarnings).toHaveLength(0);
  });

  it('深度等于上限的动作被截断', () => {
    const rule = makeRule('t1', { type: 'pageLoad' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        depth: MAX_TRIGGER_DEPTH,
      },
    ]);

    const plan = planActions(rule);

    expect(plan.actions).toHaveLength(0);
    expect(plan.truncationWarnings).toHaveLength(1);
    expect(plan.truncationWarnings[0].nodeId).toBe('a1');
  });

  it('深度超过上限的动作被截断（边界 11）', () => {
    const rule = makeRule('t1', { type: 'pageLoad' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        depth: MAX_TRIGGER_DEPTH + 1,
      },
    ]);

    const plan = planActions(rule);

    expect(plan.actions).toHaveLength(0);
    expect(plan.truncationWarnings).toHaveLength(1);
  });

  it('截断与合法动作并存', () => {
    const rule = makeRule('t1', { type: 'pageLoad' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        depth: 0,
      },
      {
        nodeId: 'a2',
        config: { type: 'setVisibility', targetComponentId: 'c3', visible: 'show' },
        depth: MAX_TRIGGER_DEPTH,
      },
      {
        nodeId: 'a3',
        config: { type: 'setVisibility', targetComponentId: 'c4', visible: 'show' },
        depth: 1,
      },
    ]);

    const plan = planActions(rule);

    expect(plan.actions).toHaveLength(2);
    expect(plan.actions.map((a) => a.nodeId)).toEqual(['a1', 'a3']);
    expect(plan.truncationWarnings).toHaveLength(1);
  });
});

// ===== 任务 3.3：动作执行器 =====

describe('executeRule — 动作执行', () => {
  it('setVisibility(show) 调用 applyVisibility(true)', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps();

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
    expect(log.results[0].kind).toBe('success');
  });

  it('setVisibility(hide) 调用 applyVisibility(false)', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'hide' },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps();

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', false);
  });

  it('setVisibility(toggle) 当前不可见时设为可见', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'toggle' },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({ getVisibility: () => false });

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
  });

  it('setVisibility(toggle) 当前可见时设为不可见', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'toggle' },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({ getVisibility: () => true });

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', false);
  });

  it('navigate 调用 openUrl', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps();

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.openUrl).toHaveBeenCalledWith('https://example.com', '_blank');
  });

  it('navigate 空 URL 跳过', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      { nodeId: 'a1', config: { type: 'navigate', url: '', target: '_blank' }, depth: 0 },
    ]);
    const deps = makeMockDeps();

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.openUrl).not.toHaveBeenCalled();
    expect(log.results[0].kind).toBe('success'); // 空URL不视为失败，静默跳过
  });

  it('scrollToComponent 调用 scrollToComponent', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      { nodeId: 'a1', config: { type: 'scrollToComponent', targetComponentId: 'c2' }, depth: 0 },
    ]);
    const deps = makeMockDeps();

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.scrollToComponent).toHaveBeenCalledWith('c2');
  });

  it('refreshDataSource 调用 refreshDataSource', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      { nodeId: 'a1', config: { type: 'refreshDataSource', targetComponentId: 'c2' }, depth: 0 },
    ]);
    const deps = makeMockDeps();

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.refreshDataSource).toHaveBeenCalledWith('c2');
  });

  it('dangling 目标组件跳过并记录', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'missing', visible: 'show' },
        depth: 0,
      },
      {
        nodeId: 'a2',
        config: { type: 'scrollToComponent', targetComponentId: 'missing' },
        depth: 1,
      },
      {
        nodeId: 'a3',
        config: { type: 'refreshDataSource', targetComponentId: 'missing' },
        depth: 2,
      },
    ]);
    const deps = makeMockDeps({ hasComponent: () => false });

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(log.results).toHaveLength(3);
    expect(log.results.every((r) => r.kind === 'skipped')).toBe(true);
    expect(deps.applyVisibility).not.toHaveBeenCalled();
    expect(deps.scrollToComponent).not.toHaveBeenCalled();
    expect(deps.refreshDataSource).not.toHaveBeenCalled();
  });

  it('前一个动作失败不中断后续独立动作', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      { nodeId: 'a1', config: { type: 'refreshDataSource', targetComponentId: 'c2' }, depth: 0 },
      {
        nodeId: 'a2',
        config: { type: 'setVisibility', targetComponentId: 'c3', visible: 'show' },
        depth: 1,
      },
    ]);
    const deps = makeMockDeps({
      refreshDataSource: vi.fn().mockRejectedValue(new Error('网络错误')),
    });

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(log.results).toHaveLength(2);
    expect(log.results[0].kind).toBe('failure');
    expect(log.results[0]).toHaveProperty('error', '网络错误');
    expect(log.results[1].kind).toBe('success');
    expect(deps.applyVisibility).toHaveBeenCalledWith('c3', true);
  });

  it('深度截断的动作不执行并记录告警', async () => {
    const rule = makeRule('t1', { type: 'pageLoad' }, [
      {
        nodeId: 'a1',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        depth: MAX_TRIGGER_DEPTH,
      },
    ]);
    const deps = makeMockDeps();

    const log = await executeRule(rule, { kind: 'pageLoad' }, deps);

    expect(log.truncated).toBe(true);
    expect(deps.logWarning).toHaveBeenCalledTimes(1);
    expect(deps.applyVisibility).not.toHaveBeenCalled();
  });
});

// ===== 任务 3.1 + 3.3：triggerAndExecute 多规则聚合 =====

describe('triggerAndExecute — 多规则聚合', () => {
  it('componentClick 事件触发所有匹配规则', async () => {
    const rules = [
      makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
        {
          nodeId: 'a1',
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
          depth: 0,
        },
      ]),
      makeRule('t2', { type: 'componentClick', componentId: 'c1' }, [
        {
          nodeId: 'a2',
          config: { type: 'setVisibility', targetComponentId: 'c3', visible: 'hide' },
          depth: 0,
        },
      ]),
      makeRule('t3', { type: 'componentClick', componentId: 'c2' }, [
        {
          nodeId: 'a3',
          config: { type: 'setVisibility', targetComponentId: 'c4', visible: 'show' },
          depth: 0,
        },
      ]),
    ];
    const deps = makeMockDeps();

    const logs = await triggerAndExecute(
      rules,
      { kind: 'componentClick', componentId: 'c1' },
      deps,
    );

    expect(logs).toHaveLength(2);
    expect(logs[0].triggerNodeId).toBe('t1');
    expect(logs[1].triggerNodeId).toBe('t2');
    expect(deps.applyVisibility).toHaveBeenCalledTimes(2);
  });

  it('pageLoad 事件触发所有 pageLoad 规则', async () => {
    const rules = [
      makeRule('t1', { type: 'pageLoad' }, [
        {
          nodeId: 'a1',
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
          depth: 0,
        },
      ]),
      makeRule('t2', { type: 'componentClick', componentId: 'c1' }, [
        {
          nodeId: 'a2',
          config: { type: 'setVisibility', targetComponentId: 'c3', visible: 'hide' },
          depth: 0,
        },
      ]),
    ];
    const deps = makeMockDeps();

    const logs = await triggerAndExecute(rules, { kind: 'pageLoad' }, deps);

    expect(logs).toHaveLength(1);
    expect(logs[0].triggerNodeId).toBe('t1');
  });
});

// ===== 任务 10.3：高级触发器规则匹配 =====

describe('collectRules — 高级触发器（任务 10.3）', () => {
  it('componentHover 事件匹配相同 componentId 的规则', () => {
    const rules = [
      makeRule('t1', { type: 'componentHover', componentId: 'c1' }, []),
      makeRule('t2', { type: 'componentHover', componentId: 'c2' }, []),
      makeRule('t3', { type: 'componentClick', componentId: 'c1' }, []),
    ];
    const event: TriggerEventType = { kind: 'componentHover', componentId: 'c1' };
    const matched = collectRules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('t1');
  });

  it('componentHover 空 componentId 不匹配', () => {
    const rules = [makeRule('t1', { type: 'componentHover', componentId: '' }, [])];
    expect(collectRules(rules, { kind: 'componentHover', componentId: '' })).toHaveLength(0);
  });

  it('dataLoaded 事件匹配相同 componentId 的规则', () => {
    const rules = [
      makeRule('t1', { type: 'dataLoaded', componentId: 'c1' }, []),
      makeRule('t2', { type: 'dataLoaded', componentId: 'c2' }, []),
      makeRule('t3', { type: 'dataError', componentId: 'c1' }, []),
    ];
    const event: TriggerEventType = { kind: 'dataLoaded', componentId: 'c1' };
    const matched = collectRules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('t1');
  });

  it('dataError 事件匹配相同 componentId 的规则', () => {
    const rules = [
      makeRule('t1', { type: 'dataError', componentId: 'c1' }, []),
      makeRule('t2', { type: 'dataLoaded', componentId: 'c1' }, []),
    ];
    const event: TriggerEventType = { kind: 'dataError', componentId: 'c1', error: 'network' };
    const matched = collectRules(rules, event);
    expect(matched).toHaveLength(1);
    expect(matched[0].triggerNodeId).toBe('t1');
  });

  it('interval 事件匹配所有 interval 规则（每条定时器规则触发）', () => {
    const rules = [
      makeRule('t1', { type: 'interval', intervalMs: 1000 }, []),
      makeRule('t2', { type: 'interval', intervalMs: 2000 }, []),
      makeRule('t3', { type: 'pageLoad' }, []),
    ];
    const event: TriggerEventType = { kind: 'interval' };
    const matched = collectRules(rules, event);
    expect(matched).toHaveLength(2);
    expect(matched.map((r) => r.triggerNodeId)).toEqual(['t1', 't2']);
  });

  it('不同触发器类型不互相匹配（componentHover ≠ componentClick）', () => {
    const rules = [makeRule('t1', { type: 'componentHover', componentId: 'c1' }, [])];
    expect(collectRules(rules, { kind: 'componentClick', componentId: 'c1' })).toHaveLength(0);
  });

  it('interval 规则不匹配 componentClick 事件', () => {
    const rules = [makeRule('t1', { type: 'interval', intervalMs: 1000 }, [])];
    expect(collectRules(rules, { kind: 'componentClick', componentId: 'c1' })).toHaveLength(0);
  });

  it('多规则匹配 interval 事件保持编译顺序', () => {
    const rules = [
      makeRule('t1', { type: 'interval', intervalMs: 1000 }, []),
      makeRule('t2', { type: 'interval', intervalMs: 5000 }, []),
      makeRule('t3', { type: 'interval', intervalMs: 60000 }, []),
    ];
    const matched = collectRules(rules, { kind: 'interval' });
    expect(matched.map((r) => r.triggerNodeId)).toEqual(['t1', 't2', 't3']);
  });
});

// ===== 任务 10.4：requestApi 动作执行 =====

describe('executeRule — requestApi 动作执行（任务 10.4）', () => {
  it('requestApi 2xx 响应返回 success', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: {},
          body: '',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({
      requestApi: vi.fn().mockResolvedValue({
        status: 200,
        bodyPreview: '{"ok":true}',
        ok: true,
      }),
    });

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.requestApi).toHaveBeenCalledTimes(1);
    expect(log.results[0].kind).toBe('success');
  });

  it('requestApi 4xx/5xx 响应返回 failure 且 error 包含状态码', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'POST',
          url: 'https://api.example.com/login',
          headers: {},
          body: '',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({
      requestApi: vi.fn().mockResolvedValue({
        status: 500,
        bodyPreview: 'Internal Server Error',
        ok: false,
      }),
    });

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(log.results[0].kind).toBe('failure');
    expect(log.results[0]).toHaveProperty('error');
    const error = (log.results[0] as { error: string }).error;
    expect(error).toContain('500');
    expect(error).toContain('Internal Server Error');
  });

  it('requestApi 空 URL 跳过并记录原因', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'GET',
          url: '',
          headers: {},
          body: '',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps();

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.requestApi).not.toHaveBeenCalled();
    expect(log.results[0].kind).toBe('skipped');
    expect((log.results[0] as { reason: string }).reason).toContain('URL');
  });

  it('requestApi 网络错误（reject）返回 failure 且 error 为错误消息', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: {},
          body: '',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({
      requestApi: vi.fn().mockRejectedValue(new Error('网络超时')),
    });

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(log.results[0].kind).toBe('failure');
    expect((log.results[0] as { error: string }).error).toBe('网络超时');
  });

  it('requestApi 调用参数正确传递（method/url/headers/body/secretHeaderKeys/timeoutMs）', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
          body: '{"name":"foo"}',
          secretHeaderKeys: ['Authorization'],
          timeoutMs: 5000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps();

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.requestApi).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: '{"name":"foo"}',
      secretHeaderKeys: ['Authorization'],
      timeoutMs: 5000,
    });
  });

  it('requestApi 失败不中断后续独立动作', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: {},
          body: '',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
      {
        nodeId: 'a2',
        config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        depth: 1,
      },
    ]);
    const deps = makeMockDeps({
      requestApi: vi.fn().mockResolvedValue({
        status: 503,
        bodyPreview: 'Service Unavailable',
        ok: false,
      }),
    });

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(log.results).toHaveLength(2);
    expect(log.results[0].kind).toBe('failure');
    expect(log.results[1].kind).toBe('success');
    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
  });
});

// ===== 任务 10.1 + 10.3：condition 条件分支执行 =====

describe('executeRule — condition 条件分支执行（任务 10.1 + 10.3）', () => {
  it('表达式为 true 时执行 then 分支，不执行 else 分支', async () => {
    const rule = makeRule(
      't1',
      { type: 'componentClick', componentId: 'c1' },
      [],
      [
        makeCondition(
          'cond1',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'status' },
            operator: 'eq',
            value: 'active',
          },
          [
            {
              nodeId: 'a-then',
              config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
              depth: 0,
            },
          ],
          [
            {
              nodeId: 'a-else',
              config: { type: 'setVisibility', targetComponentId: 'c3', visible: 'show' },
              depth: 0,
            },
          ],
        ),
      ],
    );
    const deps = makeMockDeps({
      getComponentValue: () => ({ status: 'active' }),
    });

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(log.results).toHaveLength(1);
    expect(log.results[0].nodeId).toBe('a-then');
    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
    expect(deps.applyVisibility).not.toHaveBeenCalledWith('c3', true);
  });

  it('表达式为 false 时执行 else 分支', async () => {
    const rule = makeRule(
      't1',
      { type: 'componentClick', componentId: 'c1' },
      [],
      [
        makeCondition(
          'cond1',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'status' },
            operator: 'eq',
            value: 'active',
          },
          [
            {
              nodeId: 'a-then',
              config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
              depth: 0,
            },
          ],
          [
            {
              nodeId: 'a-else',
              config: { type: 'setVisibility', targetComponentId: 'c3', visible: 'hide' },
              depth: 0,
            },
          ],
        ),
      ],
    );
    const deps = makeMockDeps({
      getComponentValue: () => ({ status: 'inactive' }),
    });

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.applyVisibility).toHaveBeenCalledWith('c3', false);
    expect(deps.applyVisibility).not.toHaveBeenCalledWith('c2', true);
  });

  it('componentData 路径支持嵌套字段判断', async () => {
    const rule = makeRule(
      't1',
      { type: 'dataLoaded', componentId: 'c1' },
      [],
      [
        makeCondition(
          'cond1',
          {
            source: { kind: 'componentData', componentId: 'c1', path: 'user.age' },
            operator: 'gte',
            value: 18,
          },
          [
            {
              nodeId: 'a-then',
              config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
              depth: 0,
            },
          ],
        ),
      ],
    );
    const deps = makeMockDeps({
      getComponentData: () => ({ user: { age: 20 } }),
    });

    await executeRule(rule, { kind: 'dataLoaded', componentId: 'c1' }, deps);

    expect(deps.applyVisibility).toHaveBeenCalledWith('c2', true);
  });

  it('empty / notEmpty 运算符按空值语义判断', async () => {
    const rule = makeRule(
      't1',
      { type: 'componentClick', componentId: 'c1' },
      [],
      [
        makeCondition(
          'cond1',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'empty',
          },
          [
            {
              nodeId: 'a-then',
              config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
              depth: 0,
            },
          ],
        ),
        makeCondition(
          'cond2',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'notEmpty',
          },
          [
            {
              nodeId: 'a-then2',
              config: { type: 'setVisibility', targetComponentId: 'c3', visible: 'show' },
              depth: 0,
            },
          ],
        ),
      ],
    );
    const deps = makeMockDeps({ getComponentValue: () => ({ value: '' }) });

    const log = await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    const nodeIds = log.results.map((r) => r.nodeId);
    expect(nodeIds).toContain('a-then');
    expect(nodeIds).not.toContain('a-then2');
  });

  it('condition 分支内动作深度超过上限时截断并记录告警', async () => {
    const rule = makeRule(
      't1',
      { type: 'componentClick', componentId: 'c1' },
      [],
      [
        makeCondition(
          'cond1',
          {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'eq',
            value: 'foo',
          },
          [
            {
              nodeId: 'a-deep',
              config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
              depth: MAX_TRIGGER_DEPTH,
            },
          ],
        ),
      ],
    );
    const deps = makeMockDeps({ getComponentValue: () => ({ value: 'foo' }) });

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.logWarning).toHaveBeenCalledTimes(1);
    expect(deps.applyVisibility).not.toHaveBeenCalled();
  });

  it('condition 分支动作支持模板插值', async () => {
    const rule = makeRule(
      't1',
      { type: 'componentClick', componentId: 'c1' },
      [],
      [
        makeCondition(
          'cond1',
          {
            source: { kind: 'componentData', componentId: 'c1', path: 'flags.run' },
            operator: 'eq',
            value: true,
          },
          [
            {
              nodeId: 'a-then',
              config: {
                type: 'requestApi',
                method: 'GET',
                url: 'https://api.example.com/{{trigger.value}}',
                headers: {},
                body: '',
                secretHeaderKeys: [],
                timeoutMs: 10_000,
              },
              depth: 0,
            },
          ],
        ),
      ],
    );
    const deps = makeMockDeps({
      getComponentValue: () => 'foo',
      getComponentData: () => ({ flags: { run: true } }),
    });

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.requestApi).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/foo',
      }),
    );
  });
});

// ===== 任务 10.5：模板插值集成 =====

describe('executeRule — 模板插值集成（任务 10.5）', () => {
  it('requestApi URL / Body / Headers 使用 trigger.value / data 插值', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'POST',
          url: 'https://api.example.com/items/{{trigger.value}}',
          headers: { 'X-Item-Id': '{{trigger.data.id}}' },
          body: '{"name":"{{trigger.data.name}}"}',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({
      getComponentValue: () => 'foo',
      getComponentData: () => ({ id: 42, name: 'bar' }),
    });

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.requestApi).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.example.com/items/foo',
      headers: { 'X-Item-Id': '42' },
      body: '{"name":"bar"}',
      secretHeaderKeys: [],
      timeoutMs: 10_000,
    });
  });

  it('dataError 事件使用 event.error 插值', async () => {
    const rule = makeRule('t1', { type: 'dataError', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'POST',
          url: 'https://api.example.com/log',
          headers: {},
          body: '{"error":"{{event.error}}"}',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps();

    await executeRule(
      rule,
      { kind: 'dataError', componentId: 'c1', error: 'network timeout' },
      deps,
    );

    expect(deps.requestApi).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '{"error":"network timeout"}',
      }),
    );
  });

  it('navigate URL 支持模板插值', async () => {
    const rule = makeRule('t1', { type: 'componentHover', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'navigate',
          url: 'https://example.com?q={{trigger.value}}',
          target: '_blank',
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({ getComponentValue: () => 'hovered' });

    await executeRule(rule, { kind: 'componentHover', componentId: 'c1' }, deps);

    expect(deps.openUrl).toHaveBeenCalledWith('https://example.com?q=hovered', '_blank');
  });

  it('缺失路径降级为空字符串，不破坏 URL 结构', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'GET',
          url: 'https://api.example.com/items/{{trigger.data.missing}}',
          headers: {},
          body: '',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({ getComponentData: () => ({ id: 1 }) });

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.requestApi).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/items/',
      }),
    );
  });

  it('非法 JS 表达式路径降级为空字符串', async () => {
    const rule = makeRule('t1', { type: 'componentClick', componentId: 'c1' }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'POST',
          url: 'https://api.example.com/safe',
          headers: {},
          body: '{"payload":"{{a+b}}"}',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps();

    await executeRule(rule, { kind: 'componentClick', componentId: 'c1' }, deps);

    expect(deps.requestApi).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '{"payload":""}',
      }),
    );
  });

  it('interval / pageLoad 事件无 trigger 上下文，模板占位符清空', async () => {
    const rule = makeRule('t1', { type: 'interval', intervalMs: 1000 }, [
      {
        nodeId: 'a1',
        config: {
          type: 'requestApi',
          method: 'GET',
          url: 'https://api.example.com/ping/{{trigger.value}}',
          headers: {},
          body: '',
          secretHeaderKeys: [],
          timeoutMs: 10_000,
        },
        depth: 0,
      },
    ]);
    const deps = makeMockDeps({ getComponentValue: () => 'should-not-be-used' });

    await executeRule(rule, { kind: 'interval' }, deps);

    expect(deps.requestApi).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/ping/',
      }),
    );
  });
});
