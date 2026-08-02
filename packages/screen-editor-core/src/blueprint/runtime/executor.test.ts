import { describe, expect, it, vi } from 'vitest';
import type { GlobalRequestApiConfig } from '@nebula/shared';

import type { ActionStep, CompiledRule, ConditionStep, DelayStep } from '../compiler/types.js';
import { executeRule, triggerAndExecute } from './executor.js';
import { collectRules } from './matcher.js';
import type { RuntimeDeps, TriggerEvent } from './types.js';

function makeRule(
  overrides: Pick<CompiledRule, 'triggerNodeId' | 'triggerEventId' | 'triggerComponentId'> &
    Partial<Pick<CompiledRule, 'steps' | 'intervalMs'>>,
): CompiledRule {
  return {
    triggerNodeId: overrides.triggerNodeId,
    triggerEventId: overrides.triggerEventId,
    triggerComponentId: overrides.triggerComponentId,
    steps: overrides.steps ?? [],
    ...(overrides.intervalMs === undefined ? {} : { intervalMs: overrides.intervalMs }),
  };
}

function action(nodeId: string, componentId: string, config: ActionStep['config']): ActionStep {
  return { kind: 'action', nodeId, componentId, config };
}

function condition(
  nodeId: string,
  expression: ConditionStep['expression'],
  thenSteps: ConditionStep['thenSteps'] = [],
  elseSteps: ConditionStep['elseSteps'] = [],
): ConditionStep {
  return { kind: 'condition', nodeId, expression, thenSteps, elseSteps };
}

function delay(nodeId: string, delayMs: number): DelayStep {
  return { kind: 'delay', nodeId, delayMs };
}

function createDeps(overrides: Partial<RuntimeDeps> = {}): RuntimeDeps {
  return {
    hasComponent: vi.fn(() => true),
    getComponentValue: vi.fn(() => undefined),
    getComponentData: vi.fn(() => undefined),
    applyVisibility: vi.fn(),
    getVisibility: vi.fn(() => true),
    refreshDataSource: vi.fn().mockResolvedValue(undefined),
    scrollToComponent: vi.fn(),
    openUrl: vi.fn(),
    requestApi: vi.fn().mockResolvedValue({ ok: true, status: 200, bodyPreview: '' }),
    logWarning: vi.fn(),
    ...overrides,
  };
}

describe('collectRules', () => {
  const rules = [
    makeRule({
      triggerNodeId: 'click',
      triggerEventId: 'click',
      triggerComponentId: 'component-a',
    }),
    makeRule({
      triggerNodeId: 'hover',
      triggerEventId: 'hover',
      triggerComponentId: 'component-a',
    }),
    makeRule({ triggerNodeId: 'load', triggerEventId: 'pageLoad', triggerComponentId: 'global' }),
  ];

  it('matches component and global events in declaration order', () => {
    const event: TriggerEvent = {
      kind: 'componentEvent',
      componentId: 'component-a',
      eventId: 'click',
    };
    expect(collectRules(rules, event).map((rule) => rule.triggerNodeId)).toEqual(['click']);
    expect(collectRules(rules, { kind: 'pageLoad' }).map((rule) => rule.triggerNodeId)).toEqual([
      'load',
    ]);
  });

  it('rejects an empty component id', () => {
    expect(
      collectRules(
        [makeRule({ triggerNodeId: 'empty', triggerEventId: 'click', triggerComponentId: '' })],
        { kind: 'componentEvent', componentId: '', eventId: 'click' },
      ),
    ).toEqual([]);
  });
});

describe('executeRule', () => {
  const clickEvent: TriggerEvent = {
    kind: 'componentEvent',
    componentId: 'component-a',
    eventId: 'click',
  };

  it('executes visibility, data refresh, scroll, and navigation actions', async () => {
    const deps = createDeps();
    const rule = makeRule({
      triggerNodeId: 'trigger',
      triggerEventId: 'click',
      triggerComponentId: 'component-a',
      steps: [
        action('show', 'component-b', { actionId: 'show' }),
        action('refresh', 'component-b', { actionId: 'refreshData' }),
        action('scroll', 'component-b', { actionId: 'scrollTo' }),
        action('navigate', 'global', {
          actionId: 'navigate',
          config: { globalType: 'navigate', url: 'https://example.com', target: '_blank' },
        }),
      ],
    });

    const log = await executeRule(rule, clickEvent, deps);

    expect(deps.applyVisibility).toHaveBeenCalledWith('component-b', true);
    expect(deps.refreshDataSource).toHaveBeenCalledWith('component-b');
    expect(deps.scrollToComponent).toHaveBeenCalledWith('component-b');
    expect(deps.openUrl).toHaveBeenCalledWith('https://example.com', '_blank');
    expect(log.results).toHaveLength(4);
    expect(log.truncated).toBe(false);
  });

  it('selects a condition branch using component props', async () => {
    const deps = createDeps({ getComponentValue: () => ({ status: 'active' }) });
    const rule = makeRule({
      triggerNodeId: 'trigger',
      triggerEventId: 'click',
      triggerComponentId: 'component-a',
      steps: [
        condition(
          'condition',
          {
            source: { kind: 'componentProp', componentId: 'component-a', key: 'status' },
            operator: 'eq',
            value: 'active',
          },
          [action('then', 'component-b', { actionId: 'show' })],
          [action('else', 'component-c', { actionId: 'hide' })],
        ),
      ],
    });

    await executeRule(rule, clickEvent, deps);

    expect(deps.applyVisibility).toHaveBeenCalledWith('component-b', true);
    expect(deps.applyVisibility).not.toHaveBeenCalledWith('component-c', false);
  });

  it('continues after a delay without emitting an action result for the delay', async () => {
    vi.useFakeTimers();
    try {
      const deps = createDeps();
      const rule = makeRule({
        triggerNodeId: 'trigger',
        triggerEventId: 'click',
        triggerComponentId: 'component-a',
        steps: [
          action('first', 'component-b', { actionId: 'show' }),
          delay('wait', 100),
          action('second', 'component-c', { actionId: 'hide' }),
        ],
      });

      const execution = executeRule(rule, clickEvent, deps);
      await vi.advanceTimersByTimeAsync(100);
      const log = await execution;

      expect(deps.applyVisibility).toHaveBeenCalledWith('component-c', false);
      expect(log.results).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a failed API request without aborting the rule', async () => {
    const config: GlobalRequestApiConfig = {
      globalType: 'requestApi',
      method: 'POST',
      url: 'https://example.com/api',
      headers: {},
      body: '{}',
      secretHeaderKeys: [],
      timeoutMs: 1_000,
    };
    const deps = createDeps({
      requestApi: vi.fn().mockResolvedValue({ ok: false, status: 500, bodyPreview: 'failure' }),
    });
    const rule = makeRule({
      triggerNodeId: 'trigger',
      triggerEventId: 'click',
      triggerComponentId: 'component-a',
      steps: [
        action('request', 'global', { actionId: 'requestApi', config }),
        action('follow-up', 'component-b', { actionId: 'show' }),
      ],
    });

    const log = await executeRule(rule, clickEvent, deps);

    expect(log.results[0]?.kind).toBe('failure');
    expect(deps.applyVisibility).toHaveBeenCalledWith('component-b', true);
  });

  it('skips dangling component actions', async () => {
    const deps = createDeps({ hasComponent: () => false });
    const rule = makeRule({
      triggerNodeId: 'trigger',
      triggerEventId: 'click',
      triggerComponentId: 'component-a',
      steps: [action('show', 'missing', { actionId: 'show' })],
    });

    const log = await executeRule(rule, clickEvent, deps);

    expect(log.results[0]?.kind).toBe('skipped');
    expect(deps.applyVisibility).not.toHaveBeenCalled();
  });
});

describe('triggerAndExecute', () => {
  it('executes every matching rule', async () => {
    const deps = createDeps();
    const rules = [
      makeRule({
        triggerNodeId: 'first',
        triggerEventId: 'click',
        triggerComponentId: 'component-a',
        steps: [action('show', 'component-b', { actionId: 'show' })],
      }),
      makeRule({
        triggerNodeId: 'second',
        triggerEventId: 'click',
        triggerComponentId: 'component-a',
        steps: [action('hide', 'component-c', { actionId: 'hide' })],
      }),
    ];

    const logs = await triggerAndExecute(
      rules,
      {
        kind: 'componentEvent',
        componentId: 'component-a',
        eventId: 'click',
      },
      deps,
    );

    expect(logs.map((log) => log.triggerNodeId)).toEqual(['first', 'second']);
  });
});
