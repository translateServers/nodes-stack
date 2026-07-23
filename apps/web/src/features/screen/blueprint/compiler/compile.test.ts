import { describe, it, expect } from 'vitest';
import type { BlueprintNode, EventBlueprint } from '@nebula/shared';
import { compileBlueprint } from './compile.js';
import type { CompileContext } from './types.js';

// ===== 公共构造器 =====

type TriggerConfig = Extract<BlueprintNode, { kind: 'trigger' }>['config'];

function makeTrigger(
  id: string,
  config: TriggerConfig = { type: 'componentClick', componentId: 'c1' },
  position = { x: 0, y: 0 },
): BlueprintNode {
  return { id, kind: 'trigger', position, config };
}

function makeAction(id: string, config: Record<string, unknown> = {}): BlueprintNode {
  return {
    id,
    kind: 'action',
    position: { x: 200, y: 0 },
    config: {
      type: 'setVisibility',
      targetComponentId: 'c2',
      visible: 'toggle',
      ...config,
    },
  };
}

function makeComment(id: string): BlueprintNode {
  return {
    id,
    kind: 'comment',
    position: { x: 400, y: 0 },
    config: { text: '备注' },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  handles: { sourceHandle?: string; targetHandle?: string } = {},
): EventBlueprint['edges'][number] {
  return {
    id,
    source,
    target,
    sourceHandle: handles.sourceHandle ?? 'out',
    targetHandle: handles.targetHandle ?? 'in',
  };
}

function makeBlueprint(nodes: BlueprintNode[], edges: EventBlueprint['edges']): EventBlueprint {
  return { version: 1, nodes, edges };
}

const ctxWithComponents = (ids: string[]): CompileContext => ({
  componentIds: new Set(ids),
});

// ===== 任务 2.2：拓扑编译 =====

describe('compileBlueprint — 拓扑编译', () => {
  it('单链：trigger → action 产出一条规则，含一个动作', () => {
    const bp = makeBlueprint([makeTrigger('t1'), makeAction('a1')], [makeEdge('e1', 't1', 'a1')]);

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].triggerNodeId).toBe('t1');
    expect(result.rules[0].actions).toHaveLength(1);
    expect(result.rules[0].actions[0].nodeId).toBe('a1');
    expect(result.rules[0].actions[0].depth).toBe(0);
  });

  it('多分支：trigger → a1 / a2，两个动作都入规则', () => {
    const bp = makeBlueprint(
      [
        makeTrigger('t1'),
        makeAction('a1'),
        makeAction('a2', { type: 'navigate', url: 'https://example.com', target: '_blank' }),
      ],
      [makeEdge('e1', 't1', 'a1'), makeEdge('e2', 't1', 'a2')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].actions).toHaveLength(2);
    const actionIds = result.rules[0].actions.map((a) => a.nodeId);
    expect(actionIds).toEqual(expect.arrayContaining(['a1', 'a2']));
  });

  it('多触发器：每个 trigger 独立产出一条规则', () => {
    const bp = makeBlueprint(
      [
        makeTrigger('t1', { type: 'componentClick', componentId: 'c1' }),
        makeTrigger('t2', { type: 'pageLoad' }),
        makeAction('a1'),
        makeAction('a2'),
      ],
      [makeEdge('e1', 't1', 'a1'), makeEdge('e2', 't2', 'a2')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.rules).toHaveLength(2);
    const triggerIds = result.rules.map((r) => r.triggerNodeId);
    expect(triggerIds).toEqual(expect.arrayContaining(['t1', 't2']));
  });

  it('comment 节点排除在执行规则外，产出 info 诊断', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1'), makeComment('cm1')],
      [makeEdge('e1', 't1', 'a1')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.rules[0].actions).toHaveLength(1);
    expect(result.rules[0].actions[0].nodeId).toBe('a1');
    const commentDiag = result.diagnostics.find(
      (d) => d.code === 'orphan-subgraph' && d.nodeId === 'cm1',
    );
    expect(commentDiag).toBeDefined();
    expect(commentDiag?.level).toBe('info');
  });

  it('孤立 action 子图（未连接 trigger）产出 info 诊断，不进规则', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1'), makeAction('a2')],
      [makeEdge('e1', 't1', 'a1')], // a2 无入边
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].actions.map((a) => a.nodeId)).toEqual(['a1']);
    const orphanDiag = result.diagnostics.find(
      (d) => d.code === 'orphan-subgraph' && d.nodeId === 'a2',
    );
    expect(orphanDiag).toBeDefined();
    expect(orphanDiag?.level).toBe('info');
  });

  it('无 trigger 的空蓝图产出空规则集', () => {
    const bp = makeBlueprint([makeAction('a1')], []);

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.rules).toHaveLength(0);
  });

  it('深度链路：trigger → a1 → a2 → a3，depth 依次递增', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1'), makeAction('a2'), makeAction('a3')],
      [makeEdge('e1', 't1', 'a1'), makeEdge('e2', 'a1', 'a2'), makeEdge('e3', 'a2', 'a3')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.rules[0].actions).toHaveLength(3);
    expect(result.rules[0].actions.map((a) => a.nodeId)).toEqual(['a1', 'a2', 'a3']);
  });
});

// ===== 任务 2.3：环检测 =====

describe('compileBlueprint — 环检测', () => {
  it('自环：a1 → a1 产出 error 诊断，含环触发器不产出规则', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1')],
      [makeEdge('e1', 't1', 'a1'), makeEdge('e2', 'a1', 'a1')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    const cycleDiag = result.diagnostics.find((d) => d.code === 'cycle');
    expect(cycleDiag).toBeDefined();
    expect(cycleDiag?.level).toBe('error');
  });

  it('多节点环：a1 → a2 → a1 产出 error 诊断', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1'), makeAction('a2')],
      [
        makeEdge('e1', 't1', 'a1'),
        makeEdge('e2', 'a1', 'a2'),
        makeEdge('e3', 'a2', 'a1'), // 形成环
      ],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    const cycleDiag = result.diagnostics.find((d) => d.code === 'cycle');
    expect(cycleDiag).toBeDefined();
    expect(cycleDiag?.level).toBe('error');
    expect(cycleDiag?.message).toContain('a1');
  });

  it('环与合法链并存：合法链的 trigger 仍产出规则', () => {
    const bp = makeBlueprint(
      [
        makeTrigger('t1'),
        makeTrigger('t2'),
        makeAction('a1'), // t1 的合法链
        makeAction('a2'), // t2 的环链
        makeAction('a3'),
      ],
      [
        makeEdge('e1', 't1', 'a1'),
        makeEdge('e2', 't2', 'a2'),
        makeEdge('e3', 'a2', 'a3'),
        makeEdge('e4', 'a3', 'a2'), // 环
      ],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.diagnostics.some((d) => d.code === 'cycle')).toBe(true);
    // t1 链路合法，仍产出规则
    const t1Rule = result.rules.find((r) => r.triggerNodeId === 't1');
    expect(t1Rule).toBeDefined();
    expect(t1Rule?.actions.map((a) => a.nodeId)).toEqual(['a1']);
  });
});

// ===== 任务 2.4：悬空引用与空参数诊断 =====

describe('compileBlueprint — dangling 与空参数诊断', () => {
  it('trigger 引用的 componentId 不存在 → warning 级 dangling', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1', { type: 'componentClick', componentId: 'missing' })],
      [],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    const dangling = result.diagnostics.find((d) => d.code === 'dangling-component');
    expect(dangling).toBeDefined();
    expect(dangling?.level).toBe('warning');
    expect(dangling?.nodeId).toBe('t1');
  });

  it('action 引用的 targetComponentId 不存在 → warning 级 dangling', () => {
    const bp = makeBlueprint(
      [
        makeTrigger('t1'),
        makeAction('a1', {
          type: 'setVisibility',
          targetComponentId: 'missing',
          visible: 'toggle',
        }),
      ],
      [makeEdge('e1', 't1', 'a1')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1']));

    const dangling = result.diagnostics.find(
      (d) => d.code === 'dangling-component' && d.nodeId === 'a1',
    );
    expect(dangling).toBeDefined();
    expect(dangling?.level).toBe('warning');
  });

  it('trigger componentId 为空字符串 → error 级 empty-param', () => {
    const bp = makeBlueprint([makeTrigger('t1', { type: 'componentClick', componentId: '' })], []);

    const result = compileBlueprint(bp, ctxWithComponents([]));

    const empty = result.diagnostics.find((d) => d.code === 'empty-param' && d.nodeId === 't1');
    expect(empty).toBeDefined();
    expect(empty?.level).toBe('error');
    expect(empty?.fieldPath).toEqual(['config', 'componentId']);
  });

  it('setVisibility targetComponentId 为空 → error 级 empty-param', () => {
    const bp = makeBlueprint(
      [
        makeTrigger('t1'),
        makeAction('a1', {
          type: 'setVisibility',
          targetComponentId: '',
          visible: 'toggle',
        }),
      ],
      [makeEdge('e1', 't1', 'a1')],
    );

    const result = compileBlueprint(bp, ctxWithComponents([]));

    const empty = result.diagnostics.find((d) => d.code === 'empty-param' && d.nodeId === 'a1');
    expect(empty).toBeDefined();
    expect(empty?.level).toBe('error');
  });

  it('navigate url 为空 → error 级 empty-param', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1', { type: 'navigate', url: '', target: '_blank' })],
      [makeEdge('e1', 't1', 'a1')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1']));

    const empty = result.diagnostics.find((d) => d.code === 'empty-param' && d.nodeId === 'a1');
    expect(empty).toBeDefined();
    expect(empty?.level).toBe('error');
    expect(empty?.fieldPath).toEqual(['config', 'url']);
  });

  it('scrollToComponent targetComponentId 为空 → error 级 empty-param', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1', { type: 'scrollToComponent', targetComponentId: '' })],
      [makeEdge('e1', 't1', 'a1')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1']));

    const empty = result.diagnostics.find((d) => d.code === 'empty-param');
    expect(empty).toBeDefined();
    expect(empty?.level).toBe('error');
  });

  it('refreshDataSource targetComponentId 为空 → error 级 empty-param', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1', { type: 'refreshDataSource', targetComponentId: '' })],
      [makeEdge('e1', 't1', 'a1')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1']));

    expect(result.diagnostics.some((d) => d.code === 'empty-param')).toBe(true);
  });

  it('诊断消息面向用户可读', () => {
    const bp = makeBlueprint([makeTrigger('t1', { type: 'componentClick', componentId: '' })], []);

    const result = compileBlueprint(bp, ctxWithComponents([]));

    const empty = result.diagnostics.find((d) => d.code === 'empty-param');
    expect(empty?.message).toMatch(/未选择/);
  });
});

// ===== 重复 id 与非法边 =====

describe('compileBlueprint — 索引诊断', () => {
  it('重复节点 id → error 诊断', () => {
    const bp = makeBlueprint([makeTrigger('t1'), makeTrigger('t1')], []);

    const result = compileBlueprint(bp, ctxWithComponents(['c1']));

    expect(result.diagnostics.some((d) => d.code === 'duplicate-node-id')).toBe(true);
  });

  it('重复边 id → error 诊断', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1')],
      [
        makeEdge('e1', 't1', 'a1'),
        makeEdge('e1', 't1', 'a1'), // 重复
      ],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.diagnostics.some((d) => d.code === 'duplicate-edge-id')).toBe(true);
  });

  it('边引用不存在的 source → error 诊断', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1')],
      [makeEdge('e1', 'missing', 'a1')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.diagnostics.some((d) => d.code === 'invalid-edge')).toBe(true);
  });

  it('边引用不存在的 target → error 诊断', () => {
    const bp = makeBlueprint(
      [makeTrigger('t1'), makeAction('a1')],
      [makeEdge('e1', 't1', 'missing')],
    );

    const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

    expect(result.diagnostics.some((d) => d.code === 'invalid-edge')).toBe(true);
  });
});

// ===== 任务 10.1：condition 分支编译 =====

type ConditionConfig = Extract<BlueprintNode, { kind: 'condition' }>['config'];

function makeCondition(
  id: string,
  config: Partial<ConditionConfig> = {},
  position = { x: 100, y: 0 },
): BlueprintNode {
  return {
    id,
    kind: 'condition',
    position,
    config: {
      type: 'condition',
      expression: {
        source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
        operator: 'eq',
        value: '1',
      },
      ...config,
    },
  };
}

function makeBranchEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle: 'then' | 'else',
  targetHandle: string = 'in',
): EventBlueprint['edges'][number] {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
  };
}

describe('compileBlueprint — condition 分支编译（任务 10.1）', () => {
  describe('基础分支拓扑', () => {
    it('condition 直连 trigger：depth=0，then/else 双分支分别展开', () => {
      // t1 → cd1 →(then) a1
      //              (else) a2
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1'), makeAction('a1'), makeAction('a2')],
        [
          makeEdge('e1', 't1', 'cd1'),
          makeBranchEdge('e2', 'cd1', 'a1', 'then'),
          makeBranchEdge('e3', 'cd1', 'a2', 'else'),
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

      expect(result.rules).toHaveLength(1);
      const rule = result.rules[0];
      // trigger 直连 condition：actions 不含 condition，仅 actions 列表为空
      expect(rule.actions).toHaveLength(0);
      // conditions 含 1 个 CompiledCondition
      expect(rule.conditions).toHaveLength(1);
      const cond = rule.conditions[0];
      expect(cond.nodeId).toBe('cd1');
      expect(cond.depth).toBe(0);
      // then 分支：1 个 action
      expect(cond.thenActions).toHaveLength(1);
      expect(cond.thenActions[0].nodeId).toBe('a1');
      expect(cond.thenActions[0].depth).toBe(1);
      // else 分支：1 个 action
      expect(cond.elseActions).toHaveLength(1);
      expect(cond.elseActions[0].nodeId).toBe('a2');
      expect(cond.elseActions[0].depth).toBe(1);
    });

    it('condition 前置 action：condition depth 累加，then/else 子动作 depth 跟随', () => {
      // t1 → a0 → cd1 →(then) a1
      //                  (else) a2
      const bp = makeBlueprint(
        [
          makeTrigger('t1'),
          makeAction('a0'),
          makeCondition('cd1'),
          makeAction('a1'),
          makeAction('a2'),
        ],
        [
          makeEdge('e1', 't1', 'a0'),
          makeEdge('e2', 'a0', 'cd1'),
          makeBranchEdge('e3', 'cd1', 'a1', 'then'),
          makeBranchEdge('e4', 'cd1', 'a2', 'else'),
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const rule = result.rules[0];

      // 主链：a0 (depth 0)
      expect(rule.actions).toHaveLength(1);
      expect(rule.actions[0].nodeId).toBe('a0');
      expect(rule.actions[0].depth).toBe(0);

      // condition 节点 depth 1（a0 之后）
      expect(rule.conditions).toHaveLength(1);
      const cond = rule.conditions[0];
      expect(cond.depth).toBe(1);
      // then/else 子动作 depth 2
      expect(cond.thenActions[0].depth).toBe(2);
      expect(cond.elseActions[0].depth).toBe(2);
    });

    it('condition 后接串联 action：分支内 action 链按顺序展开', () => {
      // t1 → cd1 →(then) a1 → a2
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1'), makeAction('a1'), makeAction('a2')],
        [
          makeEdge('e1', 't1', 'cd1'),
          makeBranchEdge('e2', 'cd1', 'a1', 'then'),
          makeEdge('e3', 'a1', 'a2'),
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const cond = result.rules[0].conditions[0];

      // then 分支：a1 → a2 串联
      expect(cond.thenActions).toHaveLength(2);
      expect(cond.thenActions[0].nodeId).toBe('a1');
      expect(cond.thenActions[0].depth).toBe(1);
      expect(cond.thenActions[1].nodeId).toBe('a2');
      expect(cond.thenActions[1].depth).toBe(2);
      // else 分支：未连接 → 空数组
      expect(cond.elseActions).toHaveLength(0);
    });
  });

  describe('未连接分支与缺省', () => {
    it('condition 仅连 then 分支：elseActions 为空数组', () => {
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1'), makeAction('a1')],
        [makeEdge('e1', 't1', 'cd1'), makeBranchEdge('e2', 'cd1', 'a1', 'then')],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const cond = result.rules[0].conditions[0];

      expect(cond.thenActions).toHaveLength(1);
      expect(cond.elseActions).toHaveLength(0);
    });

    it('condition 仅连 else 分支：thenActions 为空数组', () => {
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1'), makeAction('a1')],
        [makeEdge('e1', 't1', 'cd1'), makeBranchEdge('e2', 'cd1', 'a1', 'else')],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const cond = result.rules[0].conditions[0];

      expect(cond.thenActions).toHaveLength(0);
      expect(cond.elseActions).toHaveLength(1);
    });

    it('condition 两个分支都未连：then/else 都为空，仍产出 CompiledCondition', () => {
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1')],
        [makeEdge('e1', 't1', 'cd1')],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const rule = result.rules[0];

      expect(rule.conditions).toHaveLength(1);
      const cond = rule.conditions[0];
      expect(cond.thenActions).toHaveLength(0);
      expect(cond.elseActions).toHaveLength(0);
    });

    it('非 then/else 的 sourceHandle 被忽略（不参与分支展开）', () => {
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1'), makeAction('a1')],
        [
          makeEdge('e1', 't1', 'cd1'),
          // out handle（非 then/else）应被忽略
          makeBranchEdge('e2', 'cd1', 'a1', 'out' as 'then'),
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const cond = result.rules[0].conditions[0];

      expect(cond.thenActions).toHaveLength(0);
      expect(cond.elseActions).toHaveLength(0);
      // a1 未被任何分支覆盖，触发 orphan 诊断（条件：无入边则算孤立）
      // 但 a1 有入边（来自 cd1 的 e2），故不会触发 orphan
      // 这里仅验证 condition 分支为空
    });
  });

  describe('多分支与多 condition', () => {
    it('then 分支含多目标：按出边顺序入 thenActions', () => {
      // cd1 →(then) a1, a2
      //       (else) a3
      const bp = makeBlueprint(
        [
          makeTrigger('t1'),
          makeCondition('cd1'),
          makeAction('a1'),
          makeAction('a2'),
          makeAction('a3'),
        ],
        [
          makeEdge('e1', 't1', 'cd1'),
          makeBranchEdge('e2', 'cd1', 'a1', 'then'),
          makeBranchEdge('e3', 'cd1', 'a2', 'then'),
          makeBranchEdge('e4', 'cd1', 'a3', 'else'),
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const cond = result.rules[0].conditions[0];

      expect(cond.thenActions).toHaveLength(2);
      expect(cond.thenActions.map((a) => a.nodeId)).toEqual(['a1', 'a2']);
      expect(cond.elseActions).toHaveLength(1);
      expect(cond.elseActions[0].nodeId).toBe('a3');
    });

    it('trigger → cd1 →(then) cd2 嵌套 condition：cd1 进入顶层 conditions，cd2 在 thenActions 之外', () => {
      // t1 → cd1 →(then) cd2 →(then) a1
      //                      (else) a2
      const bp = makeBlueprint(
        [
          makeTrigger('t1'),
          makeCondition('cd1'),
          makeCondition('cd2'),
          makeAction('a1'),
          makeAction('a2'),
        ],
        [
          makeEdge('e1', 't1', 'cd1'),
          makeBranchEdge('e2', 'cd1', 'cd2', 'then'),
          makeBranchEdge('e3', 'cd2', 'a1', 'then'),
          makeBranchEdge('e4', 'cd2', 'a2', 'else'),
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const rule = result.rules[0];

      // 顶层 conditions：仅 cd1（嵌套 cd2 不向顶层透传）
      expect(rule.conditions).toHaveLength(1);
      const cd1 = rule.conditions[0];
      expect(cd1.nodeId).toBe('cd1');
      // cd1.thenActions 不应包含嵌套 condition（仅含 action 节点）
      expect(cd1.thenActions.every((a) => !a.nodeId.startsWith('cd'))).toBe(true);
      // cd1.thenActions 应为空（cd2 是 condition 不入 actions）
      expect(cd1.thenActions).toHaveLength(0);
    });

    it('同链路多个并列 condition：依次产出 CompiledCondition', () => {
      // t1 → cd1 →(then) a1
      //    → cd2 →(then) a2   (并联，从 t1 出发两条出边)
      const bp = makeBlueprint(
        [
          makeTrigger('t1'),
          makeCondition('cd1'),
          makeCondition('cd2'),
          makeAction('a1'),
          makeAction('a2'),
        ],
        [
          makeEdge('e1', 't1', 'cd1'),
          makeEdge('e2', 't1', 'cd2'),
          makeBranchEdge('e3', 'cd1', 'a1', 'then'),
          makeBranchEdge('e4', 'cd2', 'a2', 'then'),
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const rule = result.rules[0];

      // 两个 condition 都进入顶层 conditions（按访问顺序）
      expect(rule.conditions).toHaveLength(2);
      expect(rule.conditions[0].nodeId).toBe('cd1');
      expect(rule.conditions[1].nodeId).toBe('cd2');
      // cd1.then 含 a1，cd2.then 含 a2
      expect(rule.conditions[0].thenActions[0].nodeId).toBe('a1');
      expect(rule.conditions[1].thenActions[0].nodeId).toBe('a2');
    });
  });

  describe('环检测兼容', () => {
    it('condition 分支内形成环 → cycle 诊断产出，环中节点不重复入栈', () => {
      // t1 → cd1 →(then) a1 → cd1（环回到 cd1，环不含 trigger）
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1'), makeAction('a1')],
        [
          makeEdge('e1', 't1', 'cd1'),
          makeBranchEdge('e2', 'cd1', 'a1', 'then'),
          makeEdge('e3', 'a1', 'cd1'), // 回环到 cd1
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

      // 环不含 trigger：trigger 仍产出规则（局部环由 visited 防止无限循环）
      expect(result.rules).toHaveLength(1);
      // cycle 诊断仍然产出（cycle.ts 检测到 cd1 → a1 → cd1）
      expect(result.diagnostics.some((d) => d.code === 'cycle')).toBe(true);
      // cd1 进入 conditions，a1 在 thenActions 中（环回边被 visited 跳过）
      const cond = result.rules[0].conditions[0];
      expect(cond.nodeId).toBe('cd1');
      expect(cond.thenActions).toHaveLength(1);
      expect(cond.thenActions[0].nodeId).toBe('a1');
    });

    it('condition 分支内串联形成环 → cycle 诊断产出', () => {
      // t1 → cd1 →(then) a1 → a2 → cd1（环回到 cd1）
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1'), makeAction('a1'), makeAction('a2')],
        [
          makeEdge('e1', 't1', 'cd1'),
          makeBranchEdge('e2', 'cd1', 'a1', 'then'),
          makeEdge('e3', 'a1', 'a2'),
          makeEdge('e4', 'a2', 'cd1'), // 回环
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

      // 环不含 trigger：trigger 仍产出规则
      expect(result.rules).toHaveLength(1);
      expect(result.diagnostics.some((d) => d.code === 'cycle')).toBe(true);
      // cd1.thenActions 含 a1, a2（a2→cd1 回环被 visited 跳过）
      const cond = result.rules[0].conditions[0];
      expect(cond.thenActions).toHaveLength(2);
      expect(cond.thenActions.map((a) => a.nodeId)).toEqual(['a1', 'a2']);
    });

    it('环含 trigger → trigger 不产出规则（沿用既有环 trigger 语义）', () => {
      // t1 → cd1 →(then) t1（环回到 trigger）
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeCondition('cd1')],
        [makeEdge('e1', 't1', 'cd1'), makeBranchEdge('e2', 'cd1', 't1', 'then')],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));

      // 环含 trigger：跳过规则产出
      expect(result.rules).toHaveLength(0);
      expect(result.diagnostics.some((d) => d.code === 'cycle')).toBe(true);
    });
  });

  describe('config 透传', () => {
    it('CompiledCondition.config 完整保留 condition 配置（含表达式）', () => {
      const expr = {
        source: { kind: 'componentData' as const, componentId: 'c1', path: 'list.0.value' },
        operator: 'gt' as const,
        value: 100,
      };
      const bp = makeBlueprint(
        [
          makeTrigger('t1'),
          makeCondition('cd1', { type: 'condition', expression: expr }),
          makeAction('a1'),
        ],
        [makeEdge('e1', 't1', 'cd1'), makeBranchEdge('e2', 'cd1', 'a1', 'then')],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const cond = result.rules[0].conditions[0];

      expect(cond.config.type).toBe('condition');
      expect(cond.config.expression.source).toEqual(expr.source);
      expect(cond.config.expression.operator).toBe('gt');
      expect(cond.config.expression.value).toBe(100);
    });

    it('condition 节点的 dangling 诊断仍由 validate.ts 处理', () => {
      const bp = makeBlueprint(
        [
          makeTrigger('t1'),
          makeCondition('cd1', {
            type: 'condition',
            expression: {
              source: { kind: 'componentProp', componentId: 'missing-c', key: 'value' },
              operator: 'eq',
              value: '1',
            },
          }),
        ],
        [makeEdge('e1', 't1', 'cd1')],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1']));

      // missing-c 不在 componentIds 中 → dangling-component 诊断
      expect(
        result.diagnostics.some((d) => d.code === 'dangling-component' && d.nodeId === 'cd1'),
      ).toBe(true);
    });
  });

  describe('CompiledRule 结构', () => {
    it('无 condition 节点时 conditions 为空数组', () => {
      const bp = makeBlueprint([makeTrigger('t1'), makeAction('a1')], [makeEdge('e1', 't1', 'a1')]);

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const rule = result.rules[0];

      expect(rule.conditions).toEqual([]);
    });

    it('actions 与 conditions 共存（condition 不阻塞主链 action）', () => {
      // t1 → a0（主链）
      //    → cd1 →(then) a1（分支）
      const bp = makeBlueprint(
        [makeTrigger('t1'), makeAction('a0'), makeCondition('cd1'), makeAction('a1')],
        [
          makeEdge('e1', 't1', 'a0'),
          makeEdge('e2', 't1', 'cd1'),
          makeBranchEdge('e3', 'cd1', 'a1', 'then'),
        ],
      );

      const result = compileBlueprint(bp, ctxWithComponents(['c1', 'c2']));
      const rule = result.rules[0];

      expect(rule.actions).toHaveLength(1);
      expect(rule.actions[0].nodeId).toBe('a0');
      expect(rule.conditions).toHaveLength(1);
      expect(rule.conditions[0].thenActions[0].nodeId).toBe('a1');
    });
  });
});
