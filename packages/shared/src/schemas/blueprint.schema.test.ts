import { describe, it, expect } from 'vitest';
import {
  EVENT_BLUEPRINT_VERSION,
  EventBlueprintSchema,
  BlueprintNodeSchema,
  BlueprintEdgeSchema,
  BlueprintTriggerNodeSchema,
  BlueprintActionNodeSchema,
  ActionNavigateConfigSchema,
  isAllowedNavigateUrl,
  BlueprintClipboardSchema,
  BLUEPRINT_CLIPBOARD_KIND,
  type BlueprintActionNode,
  type BlueprintCommentNode,
  type BlueprintConditionNode,
  type BlueprintNode,
  type BlueprintTriggerNode,
  type EventBlueprint,
} from './blueprint.schema.js';
import { ScreenProjectSchema } from './screen.schema.js';

// ===== 公共构造器 =====

const basePosition = { x: 0, y: 0 };

function makeTriggerNode(overrides: { id?: string; config?: unknown } = {}): BlueprintTriggerNode {
  return {
    id: 't1',
    kind: 'trigger',
    position: basePosition,
    config: { type: 'componentClick', componentId: 'c1' },
    ...overrides,
  } as BlueprintTriggerNode;
}

function makeActionNode(overrides: { id?: string; config?: unknown } = {}): BlueprintActionNode {
  return {
    id: 'a1',
    kind: 'action',
    position: basePosition,
    config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'toggle' },
    ...overrides,
  } as BlueprintActionNode;
}

function makeCommentNode(overrides: { id?: string; config?: unknown } = {}): BlueprintCommentNode {
  return {
    id: 'cm1',
    kind: 'comment',
    position: basePosition,
    config: { text: '备注' },
    ...overrides,
  } as BlueprintCommentNode;
}

function makeConditionNode(
  overrides: { id?: string; config?: unknown } = {},
): BlueprintConditionNode {
  return {
    id: 'cd1',
    kind: 'condition',
    position: basePosition,
    config: {
      type: 'condition',
      expression: {
        source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
        operator: 'eq',
        value: '1',
      },
    },
    ...overrides,
  } as BlueprintConditionNode;
}

function makeEdge(overrides: Partial<{ id: string; source: string; target: string }> = {}) {
  return {
    id: 'e1',
    source: 't1',
    sourceHandle: 'out',
    target: 'a1',
    targetHandle: 'in',
    ...overrides,
  };
}

function makeBlueprint(overrides: Partial<EventBlueprint> = {}): EventBlueprint {
  return {
    version: EVENT_BLUEPRINT_VERSION,
    nodes: [makeTriggerNode(), makeActionNode()],
    edges: [makeEdge()],
    ...overrides,
  };
}

// ===== 任务 1.1：节点与边 Schema =====

describe('BlueprintNodeKindSchema / BlueprintNodeSchema', () => {
  it('接受 trigger 节点', () => {
    const node = makeTriggerNode();
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 condition 节点（M3 预留）', () => {
    const node = makeConditionNode();
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 action 节点', () => {
    const node = makeActionNode();
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 comment 节点', () => {
    const node = makeCommentNode();
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('拒绝未知 kind', () => {
    const node = { ...makeTriggerNode(), kind: 'unknown' };
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('拒绝缺失 id 的节点', () => {
    const { id: _omit, ...rest } = makeTriggerNode() as Record<string, unknown>;
    void _omit;
    expect(() => BlueprintNodeSchema.parse(rest)).toThrow();
  });

  it('拒绝缺失 position 的节点', () => {
    const { position: _omit, ...rest } = makeTriggerNode() as Record<string, unknown>;
    void _omit;
    expect(() => BlueprintNodeSchema.parse(rest)).toThrow();
  });

  it('拒绝缺失 config 的节点', () => {
    const { config: _omit, ...rest } = makeTriggerNode() as Record<string, unknown>;
    void _omit;
    expect(() => BlueprintNodeSchema.parse(rest)).toThrow();
  });

  it('TriggerNode 拒绝未知 trigger type', () => {
    const node = makeTriggerNode({
      config: { type: 'unknown', componentId: 'c1' } as never,
    });
    expect(() => BlueprintTriggerNodeSchema.parse(node)).toThrow();
  });

  it('ActionNode 拒绝未知 action type', () => {
    const node = makeActionNode({
      config: { type: 'unknown', targetComponentId: 'c1' } as never,
    });
    expect(() => BlueprintActionNodeSchema.parse(node)).toThrow();
  });
});

describe('BlueprintEdgeSchema', () => {
  it('接受合法边', () => {
    const edge = makeEdge();
    expect(BlueprintEdgeSchema.parse(edge)).toEqual(edge);
  });

  it('拒绝缺失 sourceHandle 的边', () => {
    const { sourceHandle: _omit, ...rest } = makeEdge() as Record<string, unknown>;
    void _omit;
    expect(() => BlueprintEdgeSchema.parse(rest)).toThrow();
  });

  it('拒绝空字符串 source 的边', () => {
    expect(() => BlueprintEdgeSchema.parse({ ...makeEdge(), source: '' })).toThrow();
  });
});

// ===== 任务 1.2：触发器与动作判别联合 + navigate 白名单 =====

describe('BlueprintTriggerConfigSchema', () => {
  it('接受 componentClick 触发器', () => {
    const node = makeTriggerNode({
      config: { type: 'componentClick', componentId: 'c1' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 pageLoad 触发器', () => {
    const node = makeTriggerNode({
      id: 't-pl',
      config: { type: 'pageLoad' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('componentClick 允许空字符串 componentId（非破坏保存，由编译器诊断）', () => {
    const node = makeTriggerNode({
      config: { type: 'componentClick', componentId: '' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 componentHover 触发器（任务 10.3）', () => {
    const node = makeTriggerNode({
      id: 't-h',
      config: { type: 'componentHover', componentId: 'c1' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 dataLoaded 触发器（任务 10.3）', () => {
    const node = makeTriggerNode({
      id: 't-dl',
      config: { type: 'dataLoaded', componentId: 'c1' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 dataError 触发器（任务 10.3）', () => {
    const node = makeTriggerNode({
      id: 't-de',
      config: { type: 'dataError', componentId: 'c1' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受合法 interval 触发器（任务 10.3）', () => {
    const node = makeTriggerNode({
      id: 't-iv',
      config: { type: 'interval', intervalMs: 1000 },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('interval 触发器接受 100ms 最小值', () => {
    const node = makeTriggerNode({
      id: 't-iv-min',
      config: { type: 'interval', intervalMs: 100 },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('interval 触发器接受 86400000ms 最大值（24h）', () => {
    const node = makeTriggerNode({
      id: 't-iv-max',
      config: { type: 'interval', intervalMs: 86_400_000 },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('interval 触发器拒绝 99ms（小于 100ms）', () => {
    const node = makeTriggerNode({
      config: { type: 'interval', intervalMs: 99 },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('interval 触发器拒绝 0ms', () => {
    const node = makeTriggerNode({
      config: { type: 'interval', intervalMs: 0 },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('interval 触发器拒绝负数', () => {
    const node = makeTriggerNode({
      config: { type: 'interval', intervalMs: -1000 },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('interval 触发器拒绝小数', () => {
    const node = makeTriggerNode({
      config: { type: 'interval', intervalMs: 1500.5 },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('interval 触发器拒绝超过 24h 的间隔', () => {
    const node = makeTriggerNode({
      config: { type: 'interval', intervalMs: 86_400_001 },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('拒绝未知触发器类型', () => {
    const node = makeTriggerNode({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { type: 'unknown' } as any,
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });
});

describe('BlueprintActionConfigSchema', () => {
  it('接受 setVisibility 动作（show/hide/toggle）', () => {
    for (const visible of ['show', 'hide', 'toggle'] as const) {
      const node = makeActionNode({
        config: { type: 'setVisibility', targetComponentId: 'c2', visible },
      });
      expect(BlueprintNodeSchema.parse(node)).toEqual(node);
    }
  });

  it('拒绝 setVisibility 的未知 visible 值', () => {
    const node = makeActionNode({
      config: {
        type: 'setVisibility',
        targetComponentId: 'c2',
        visible: 'flip' as never,
      },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('接受 navigate 动作（http/https 白名单）', () => {
    const node = makeActionNode({
      config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('navigate 默认 target 为 _blank', () => {
    const parsed = ActionNavigateConfigSchema.parse({
      type: 'navigate',
      url: 'http://example.com',
    });
    expect(parsed.target).toBe('_blank');
  });

  it('navigate 拒绝 javascript: 协议', () => {
    expect(() =>
      ActionNavigateConfigSchema.parse({ type: 'navigate', url: 'javascript:alert(1)' }),
    ).toThrow();
  });

  it('navigate 拒绝 data: 协议', () => {
    expect(() =>
      ActionNavigateConfigSchema.parse({ type: 'navigate', url: 'data:text/html,xxx' }),
    ).toThrow();
  });

  it('navigate 允许空 URL（由编译器诊断，非破坏保存）', () => {
    expect(() => ActionNavigateConfigSchema.parse({ type: 'navigate', url: '' })).not.toThrow();
  });

  it('接受 scrollToComponent 动作', () => {
    const node = makeActionNode({
      config: { type: 'scrollToComponent', targetComponentId: 'c2' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 refreshDataSource 动作', () => {
    const node = makeActionNode({
      config: { type: 'refreshDataSource', targetComponentId: 'c2' },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 requestApi 动作（任务 10.4，最小配置）', () => {
    const node = makeActionNode({
      id: 'a-req',
      config: { type: 'requestApi', method: 'GET', url: 'https://api.example.com/data' },
    });
    const parsed = BlueprintNodeSchema.parse(node);
    expect(parsed).toMatchObject({
      id: 'a-req',
      kind: 'action',
      config: { type: 'requestApi', method: 'GET', url: 'https://api.example.com/data' },
    });
  });

  it('接受 requestApi 动作（POST + headers + body + secretHeaderKeys）', () => {
    const node = makeActionNode({
      id: 'a-req2',
      config: {
        type: 'requestApi',
        method: 'POST',
        url: 'https://api.example.com/login',
        headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        body: '{"user":"foo"}',
        secretHeaderKeys: ['Authorization'],
        timeoutMs: 5000,
      },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受全部 5 种 HTTP 方法', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const node = makeActionNode({
        id: `a-req-${method}`,
        config: { type: 'requestApi', method, url: 'https://api.example.com/data' },
      });
      const parsed = BlueprintNodeSchema.parse(node);
      expect(parsed).toMatchObject({
        id: `a-req-${method}`,
        kind: 'action',
        config: { type: 'requestApi', method, url: 'https://api.example.com/data' },
      });
    }
  });

  it('requestApi 拒绝未知 HTTP 方法', () => {
    const node = makeActionNode({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { type: 'requestApi', method: 'HEAD' as any, url: 'https://a.com' },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('requestApi 拒绝 javascript: URL', () => {
    const node = makeActionNode({
      config: { type: 'requestApi', method: 'GET', url: 'javascript:alert(1)' },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('requestApi 允许空 URL（由编译器诊断，非破坏保存）', () => {
    const node = makeActionNode({
      config: { type: 'requestApi', method: 'GET', url: '' },
    });
    const parsed = BlueprintNodeSchema.parse(node);
    expect(parsed).toMatchObject({
      id: 'a1',
      kind: 'action',
      config: { type: 'requestApi', method: 'GET', url: '' },
    });
  });

  it('requestApi 拒绝 0 timeoutMs', () => {
    const node = makeActionNode({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { type: 'requestApi', method: 'GET', url: 'https://a.com', timeoutMs: 0 as any },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('requestApi 拒绝负数 timeoutMs', () => {
    const node = makeActionNode({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { type: 'requestApi', method: 'GET', url: 'https://a.com', timeoutMs: -1000 as any },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('requestApi 拒绝超过 300000ms 的 timeoutMs', () => {
    const node = makeActionNode({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {
        type: 'requestApi',
        method: 'GET',
        url: 'https://a.com',
        timeoutMs: 300_001 as any,
      },
    });
    expect(() => BlueprintNodeSchema.parse(node)).toThrow();
  });

  it('requestApi 接受 300000ms 上限', () => {
    const node = makeActionNode({
      config: { type: 'requestApi', method: 'GET', url: 'https://a.com', timeoutMs: 300_000 },
    });
    const parsed = BlueprintNodeSchema.parse(node);
    expect(parsed).toMatchObject({
      id: 'a1',
      kind: 'action',
      config: { type: 'requestApi', method: 'GET', url: 'https://a.com', timeoutMs: 300_000 },
    });
  });

  it('requestApi 默认 headers 为空对象', () => {
    const node = makeActionNode({
      config: { type: 'requestApi', method: 'GET', url: 'https://a.com' },
    });
    const parsed = BlueprintNodeSchema.parse(node);
    expect((parsed.config as { headers: Record<string, string> }).headers).toEqual({});
  });

  it('requestApi 默认 body 为空字符串', () => {
    const node = makeActionNode({
      config: { type: 'requestApi', method: 'GET', url: 'https://a.com' },
    });
    const parsed = BlueprintNodeSchema.parse(node);
    expect((parsed.config as { body: string }).body).toBe('');
  });

  it('requestApi 默认 secretHeaderKeys 为空数组', () => {
    const node = makeActionNode({
      config: { type: 'requestApi', method: 'GET', url: 'https://a.com' },
    });
    const parsed = BlueprintNodeSchema.parse(node);
    expect((parsed.config as { secretHeaderKeys: string[] }).secretHeaderKeys).toEqual([]);
  });

  it('requestApi 默认 timeoutMs 为 10000', () => {
    const node = makeActionNode({
      config: { type: 'requestApi', method: 'GET', url: 'https://a.com' },
    });
    const parsed = BlueprintNodeSchema.parse(node);
    expect((parsed.config as { timeoutMs: number }).timeoutMs).toBe(10_000);
  });
});

describe('isAllowedNavigateUrl', () => {
  it('允许 http://', () => {
    expect(isAllowedNavigateUrl('http://a.com')).toBe(true);
  });
  it('允许 https://', () => {
    expect(isAllowedNavigateUrl('https://a.com')).toBe(true);
  });
  it('允许大写 HTTPS://', () => {
    expect(isAllowedNavigateUrl('HTTPS://a.com')).toBe(true);
  });
  it('拒绝 javascript:', () => {
    expect(isAllowedNavigateUrl('javascript:alert(1)')).toBe(false);
  });
  it('拒绝空字符串', () => {
    expect(isAllowedNavigateUrl('')).toBe(false);
  });
  it('拒绝 ftp:', () => {
    expect(isAllowedNavigateUrl('ftp://a.com')).toBe(false);
  });
});

describe('ConditionNodeConfigSchema（任务 10.1 开放）', () => {
  it('接受合法 condition 配置', () => {
    const node = makeConditionNode();
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 empty / notEmpty 操作符（无需 value）', () => {
    const node = makeConditionNode({
      config: {
        type: 'condition',
        expression: {
          source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
          operator: 'empty',
        },
      },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });

  it('接受 componentData 字段来源', () => {
    const node = makeConditionNode({
      config: {
        type: 'condition',
        expression: {
          source: { kind: 'componentData', componentId: 'c1', path: 'list.0.value' },
          operator: 'gt',
          value: 100,
        },
      },
    });
    expect(BlueprintNodeSchema.parse(node)).toEqual(node);
  });
});

describe('ConditionExpression 契约（任务 10.1）', () => {
  function makeExpr(overrides: Record<string, unknown> = {}): unknown {
    return {
      source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
      operator: 'eq',
      value: '1',
      ...overrides,
    };
  }

  function makeNodeWithExpr(expression: unknown): BlueprintNode {
    return {
      id: 'cd1',
      kind: 'condition',
      position: { x: 0, y: 0 },
      config: { type: 'condition', expression: expression as never },
    } as BlueprintNode;
  }

  describe('operator 与 value 类型组合', () => {
    it('接受 eq + string value', () => {
      const node = makeNodeWithExpr(makeExpr({ operator: 'eq', value: 'abc' }));
      expect(BlueprintNodeSchema.parse(node)).toEqual(node);
    });

    it('接受 eq + number value', () => {
      const node = makeNodeWithExpr(makeExpr({ operator: 'eq', value: 42 }));
      expect(BlueprintNodeSchema.parse(node)).toEqual(node);
    });

    it('接受 eq + boolean value', () => {
      const node = makeNodeWithExpr(makeExpr({ operator: 'eq', value: true }));
      expect(BlueprintNodeSchema.parse(node)).toEqual(node);
    });

    it('接受 ne/gt/gte/lt/lte + 数值比较', () => {
      for (const op of ['ne', 'gt', 'gte', 'lt', 'lte'] as const) {
        const node = makeNodeWithExpr(makeExpr({ operator: op, value: 100 }));
        expect(BlueprintNodeSchema.parse(node)).toEqual(node);
      }
    });

    it('接受 contains + string value', () => {
      const node = makeNodeWithExpr(makeExpr({ operator: 'contains', value: 'sub' }));
      expect(BlueprintNodeSchema.parse(node)).toEqual(node);
    });

    it('接受 empty / notEmpty（value 缺省）', () => {
      for (const op of ['empty', 'notEmpty'] as const) {
        const node = makeNodeWithExpr({
          source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
          operator: op,
        });
        expect(BlueprintNodeSchema.parse(node)).toEqual(node);
      }
    });

    it('接受 empty / notEmpty 同时携带 value（schema 不强制禁止，由 UI 层约束）', () => {
      const node = makeNodeWithExpr(makeExpr({ operator: 'empty', value: 'ignored' }));
      expect(BlueprintNodeSchema.parse(node)).toEqual(node);
    });
  });

  describe('source 字段来源', () => {
    it('接受 componentProp 来源', () => {
      const node = makeNodeWithExpr(
        makeExpr({
          source: { kind: 'componentProp', componentId: 'c1', key: 'props.value' },
        }),
      );
      expect(BlueprintNodeSchema.parse(node)).toEqual(node);
    });

    it('接受 componentData 来源（path 点分隔）', () => {
      const node = makeNodeWithExpr(
        makeExpr({
          source: { kind: 'componentData', componentId: 'c1', path: 'list.0.name' },
        }),
      );
      expect(BlueprintNodeSchema.parse(node)).toEqual(node);
    });
  });

  describe('拒绝非法表达式', () => {
    it('拒绝未知 operator', () => {
      const node = makeNodeWithExpr(makeExpr({ operator: 'unknown' }));
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝未知 source.kind', () => {
      const node = makeNodeWithExpr(makeExpr({ source: { kind: 'unknown', componentId: 'c1' } }));
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 componentProp 缺少 componentId', () => {
      const node = makeNodeWithExpr(makeExpr({ source: { kind: 'componentProp', key: 'value' } }));
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 componentProp 缺少 key', () => {
      const node = makeNodeWithExpr(
        makeExpr({ source: { kind: 'componentProp', componentId: 'c1' } }),
      );
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 componentData 缺少 path', () => {
      const node = makeNodeWithExpr(
        makeExpr({ source: { kind: 'componentData', componentId: 'c1' } }),
      );
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 value 为非法类型（对象）', () => {
      const node = makeNodeWithExpr(makeExpr({ value: { foo: 1 } }));
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 value 为 null', () => {
      const node = makeNodeWithExpr(makeExpr({ value: null }));
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 value 为数组', () => {
      const node = makeNodeWithExpr(makeExpr({ value: [1, 2, 3] }));
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 expression 缺少 source', () => {
      const node = makeNodeWithExpr({ operator: 'eq', value: '1' });
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 expression 缺少 operator', () => {
      const node = makeNodeWithExpr({
        source: { kind: 'componentProp', componentId: 'c1', key: 'v' },
        value: '1',
      });
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });

    it('拒绝 config.type 不为 condition', () => {
      const node: BlueprintNode = {
        id: 'cd1',
        kind: 'condition',
        position: { x: 0, y: 0 },
        config: { type: 'setVisibility', expression: makeExpr() } as never,
      };
      expect(() => BlueprintNodeSchema.parse(node)).toThrow();
    });
  });
});

// ===== 任务 1.3：EventBlueprintSchema 与向后兼容 =====

describe('EventBlueprintSchema', () => {
  it('接受合法蓝图', () => {
    const bp = makeBlueprint();
    expect(EventBlueprintSchema.parse(bp)).toEqual(bp);
  });

  it('接受空节点与空边', () => {
    const bp = { version: EVENT_BLUEPRINT_VERSION, nodes: [], edges: [] };
    expect(EventBlueprintSchema.parse(bp)).toEqual(bp);
  });

  it('拒绝未知 version', () => {
    expect(() => EventBlueprintSchema.parse({ version: 999, nodes: [], edges: [] })).toThrow();
  });

  it('拒绝缺失 version', () => {
    expect(() => EventBlueprintSchema.parse({ nodes: [], edges: [] } as never)).toThrow();
  });

  it('拒绝节点 id 重复时仍由后续业务保证（schema 不强制唯一）', () => {
    // Schema 层不强制节点 id 唯一，由编译器诊断处理
    const bp = {
      version: EVENT_BLUEPRINT_VERSION,
      nodes: [makeTriggerNode(), makeTriggerNode()],
      edges: [],
    };
    expect(EventBlueprintSchema.parse(bp)).toEqual(bp);
  });
});

describe('ScreenProjectSchema — blueprint 向后兼容', () => {
  const baseProject = {
    id: 'p1',
    name: '大屏',
    canvas: { width: 1920, height: 1080, backgroundColor: '#000', scaleMode: 'fit' },
    components: [],
    status: 'draft',
    createdAt: '2025-07-16 10:00:00',
    updatedAt: '2025-07-16 10:00:00',
  };

  it('无 blueprint 字段时解析成功，行为与演进前一致', () => {
    const parsed = ScreenProjectSchema.parse(baseProject);
    expect(parsed.blueprint).toBeUndefined();
  });

  it('含合法 blueprint 时解析成功', () => {
    const project = { ...baseProject, blueprint: makeBlueprint() };
    const parsed = ScreenProjectSchema.parse(project);
    expect(parsed.blueprint).toBeDefined();
    expect(parsed.blueprint?.nodes).toHaveLength(2);
  });

  it('含非法 blueprint 时被拒绝', () => {
    const project = {
      ...baseProject,
      blueprint: { version: 999, nodes: [], edges: [] },
    };
    expect(() => ScreenProjectSchema.parse(project)).toThrow();
  });

  it('含 javascript: URL 的 navigate 动作被拒绝', () => {
    const project = {
      ...baseProject,
      blueprint: makeBlueprint({
        nodes: [
          makeTriggerNode(),
          makeActionNode({
            config: { type: 'navigate', url: 'javascript:alert(1)', target: '_blank' },
          }),
        ],
        edges: [makeEdge()],
      }),
    };
    expect(() => ScreenProjectSchema.parse(project)).toThrow();
  });
});

// ===== 任务 5.5：跨项目剪贴板载荷 =====

describe('BlueprintClipboardSchema', () => {
  it('接受合法剪贴板载荷', () => {
    const payload = {
      kind: BLUEPRINT_CLIPBOARD_KIND,
      nodes: [makeTriggerNode(), makeActionNode()],
      edges: [makeEdge()],
    };
    expect(BlueprintClipboardSchema.parse(payload)).toEqual(payload);
  });

  it('拒绝未知 kind 的剪贴板载荷', () => {
    const payload = {
      kind: 'unknown',
      nodes: [],
      edges: [],
    };
    expect(() => BlueprintClipboardSchema.parse(payload)).toThrow();
  });

  it('拒绝含非法节点的剪贴板载荷', () => {
    const payload = {
      kind: BLUEPRINT_CLIPBOARD_KIND,
      nodes: [{ id: 'x', kind: 'unknown', position: { x: 0, y: 0 }, config: {} }],
      edges: [],
    };
    expect(() => BlueprintClipboardSchema.parse(payload)).toThrow();
  });
});
