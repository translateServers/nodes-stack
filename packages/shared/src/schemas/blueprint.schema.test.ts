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
  type BlueprintNode,
  type EventBlueprint,
} from './blueprint.schema.js';
import { ScreenProjectSchema } from './screen.schema.js';

// ===== 公共构造器 =====

const basePosition = { x: 0, y: 0 };

function makeTriggerNode(overrides: Partial<BlueprintNode> = {}): BlueprintNode {
  return {
    id: 't1',
    kind: 'trigger',
    position: basePosition,
    config: { type: 'componentClick', componentId: 'c1' },
    ...overrides,
  } as BlueprintNode;
}

function makeActionNode(overrides: Partial<BlueprintNode> = {}): BlueprintNode {
  return {
    id: 'a1',
    kind: 'action',
    position: basePosition,
    config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'toggle' },
    ...overrides,
  } as BlueprintNode;
}

function makeCommentNode(overrides: Partial<BlueprintNode> = {}): BlueprintNode {
  return {
    id: 'cm1',
    kind: 'comment',
    position: basePosition,
    config: { text: '备注' },
    ...overrides,
  } as BlueprintNode;
}

function makeConditionNode(overrides: Partial<BlueprintNode> = {}): BlueprintNode {
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
  } as BlueprintNode;
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

describe('ConditionNodeConfigSchema（M3 预留）', () => {
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
