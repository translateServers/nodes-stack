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
  return { id, kind: 'trigger', position, config } as BlueprintNode;
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
  } as BlueprintNode;
}

function makeComment(id: string): BlueprintNode {
  return {
    id,
    kind: 'comment',
    position: { x: 400, y: 0 },
    config: { text: '备注' },
  } as BlueprintNode;
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
