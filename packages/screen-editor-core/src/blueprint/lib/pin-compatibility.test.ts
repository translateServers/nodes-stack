/**
 * 引脚兼容性判定测试（任务 4.3）
 *
 * 验证点（对应 tasks.md 4.3 验证要求）：
 * - 组件测试覆盖兼容判定纯函数
 * - 覆盖所有不兼容原因（源/目标节点不存在、comment 隔离、引脚类型不匹配、自环、重复连线）
 * - getCompatibleTargetPins 返回合法目标引脚集合
 */

import { describe, expect, it } from 'vitest';
import type { BlueprintEdge, BlueprintNode } from '@nebula/shared';
import {
  getCompatibleTargetPins,
  hasDuplicateEdge,
  hasPin,
  INPUT_PINS,
  isConnectionValid,
  OUTPUT_PINS,
} from './pin-compatibility';
import type { NodeIndex, PinId } from './pin-compatibility';

// ===== 构造器 =====

function makeTrigger(id: string): BlueprintNode {
  return {
    id,
    kind: 'trigger',
    position: { x: 0, y: 0 },
    config: { type: 'pageLoad' },
  };
}

function makeAction(id: string): BlueprintNode {
  return {
    id,
    kind: 'action',
    position: { x: 100, y: 0 },
    config: {
      type: 'setVisibility',
      targetComponentId: 'comp-a',
      visible: 'hide',
    },
  };
}

function makeComment(id: string): BlueprintNode {
  return {
    id,
    kind: 'comment',
    position: { x: 200, y: 0 },
    config: { text: '注释' },
  };
}

function makeEdge(
  id: string,
  source: string,
  sourceHandle: PinId,
  target: string,
  targetHandle: PinId,
): BlueprintEdge {
  return { id, source, sourceHandle, target, targetHandle };
}

function makeNodeIndex(...nodes: BlueprintNode[]): NodeIndex {
  return new Map(nodes.map((n) => [n.id, n]));
}

// ===== hasPin =====

describe('hasPin', () => {
  it('trigger 有 out 输出引脚', () => {
    expect(hasPin('trigger', 'out', 'source')).toBe(true);
  });

  it('trigger 无 in 输入引脚', () => {
    expect(hasPin('trigger', 'in', 'target')).toBe(false);
  });

  it('action 有 in 输入与 out 输出引脚', () => {
    expect(hasPin('action', 'in', 'target')).toBe(true);
    expect(hasPin('action', 'out', 'source')).toBe(true);
  });

  it('comment 无任何引脚', () => {
    expect(hasPin('comment', 'out', 'source')).toBe(false);
    expect(hasPin('comment', 'in', 'target')).toBe(false);
  });

  it('condition（M3 契约）有 in/then/else 引脚', () => {
    expect(hasPin('condition', 'in', 'target')).toBe(true);
    expect(hasPin('condition', 'then', 'source')).toBe(true);
    expect(hasPin('condition', 'else', 'source')).toBe(true);
    expect(hasPin('condition', 'out', 'source')).toBe(false);
  });
});

// ===== OUTPUT_PINS / INPUT_PINS 常量 =====

describe('引脚常量', () => {
  it('OUTPUT_PINS 各节点类型的输出引脚集合正确', () => {
    expect(OUTPUT_PINS.trigger).toEqual(['out']);
    expect(OUTPUT_PINS.action).toEqual(['out']);
    expect(OUTPUT_PINS.condition).toEqual(['then', 'else']);
    expect(OUTPUT_PINS.comment).toEqual([]);
  });

  it('INPUT_PINS 各节点类型的输入引脚集合正确', () => {
    expect(INPUT_PINS.trigger).toEqual([]);
    expect(INPUT_PINS.action).toEqual(['in']);
    expect(INPUT_PINS.condition).toEqual(['in']);
    expect(INPUT_PINS.comment).toEqual([]);
  });
});

// ===== isConnectionValid =====

describe('isConnectionValid', () => {
  it('trigger.out → action.in 兼容', () => {
    const nodes = makeNodeIndex(makeTrigger('t1'), makeAction('a1'));
    const result = isConnectionValid(
      { sourceNodeId: 't1', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'in' },
      nodes,
      [],
    );
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('action.out → action.in 兼容（链式触发）', () => {
    const nodes = makeNodeIndex(makeAction('a1'), makeAction('a2'));
    const result = isConnectionValid(
      { sourceNodeId: 'a1', sourceHandle: 'out', targetNodeId: 'a2', targetHandle: 'in' },
      nodes,
      [],
    );
    expect(result.valid).toBe(true);
  });

  it('源节点不存在时返回 source-node-not-found', () => {
    const nodes = makeNodeIndex(makeAction('a1'));
    const result = isConnectionValid(
      { sourceNodeId: 'missing', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'in' },
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('source-node-not-found');
  });

  it('目标节点不存在时返回 target-node-not-found', () => {
    const nodes = makeNodeIndex(makeTrigger('t1'));
    const result = isConnectionValid(
      { sourceNodeId: 't1', sourceHandle: 'out', targetNodeId: 'missing', targetHandle: 'in' },
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('target-node-not-found');
  });

  it('源为 comment 节点时返回 comment-node-disconnected', () => {
    const nodes = makeNodeIndex(makeComment('c1'), makeAction('a1'));
    const result = isConnectionValid(
      { sourceNodeId: 'c1', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'in' },
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('comment-node-disconnected');
  });

  it('目标为 comment 节点时返回 comment-node-disconnected', () => {
    const nodes = makeNodeIndex(makeTrigger('t1'), makeComment('c1'));
    const result = isConnectionValid(
      { sourceNodeId: 't1', sourceHandle: 'out', targetNodeId: 'c1', targetHandle: 'in' },
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('comment-node-disconnected');
  });

  it('源引脚不是输出引脚时返回 source-pin-not-output（trigger 用 in 作为源）', () => {
    const nodes = makeNodeIndex(makeTrigger('t1'), makeAction('a1'));
    const result = isConnectionValid(
      { sourceNodeId: 't1', sourceHandle: 'in', targetNodeId: 'a1', targetHandle: 'in' },
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('source-pin-not-output');
  });

  it('目标引脚不是输入引脚时返回 target-pin-not-input（action 用 out 作为目标）', () => {
    const nodes = makeNodeIndex(makeTrigger('t1'), makeAction('a1'));
    const result = isConnectionValid(
      { sourceNodeId: 't1', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'out' },
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('target-pin-not-input');
  });

  it('自环连线返回 self-loop', () => {
    const nodes = makeNodeIndex(makeAction('a1'));
    const result = isConnectionValid(
      { sourceNodeId: 'a1', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'in' },
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('self-loop');
  });

  it('重复连线返回 duplicate-edge', () => {
    const nodes = makeNodeIndex(makeTrigger('t1'), makeAction('a1'));
    const existing = [makeEdge('e1', 't1', 'out', 'a1', 'in')];
    const result = isConnectionValid(
      { sourceNodeId: 't1', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'in' },
      nodes,
      existing,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('duplicate-edge');
  });

  it('不同引脚组合不视为重复（同一源节点不同输出引脚到同一目标）', () => {
    // condition.then 与 condition.else 都可连到同一 action.in
    const condition: BlueprintNode = {
      id: 'cond1',
      kind: 'condition',
      position: { x: 0, y: 0 },
      config: {
        type: 'condition',
        expression: {
          source: { kind: 'componentProp', componentId: 'comp-a', key: 'value' },
          operator: 'eq',
          value: '1',
        },
      },
    };
    const action = makeAction('a1');
    const nodes = makeNodeIndex(condition, action);
    const existing = [makeEdge('e1', 'cond1', 'then', 'a1', 'in')];

    const result = isConnectionValid(
      { sourceNodeId: 'cond1', sourceHandle: 'else', targetNodeId: 'a1', targetHandle: 'in' },
      nodes,
      existing,
    );
    expect(result.valid).toBe(true);
  });
});

// ===== hasDuplicateEdge =====

describe('hasDuplicateEdge', () => {
  it('相同 source/target/handle 视为重复', () => {
    const existing = [makeEdge('e1', 't1', 'out', 'a1', 'in')];
    expect(
      hasDuplicateEdge(
        { sourceNodeId: 't1', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'in' },
        existing,
      ),
    ).toBe(true);
  });

  it('不同 source 不视为重复', () => {
    const existing = [makeEdge('e1', 't1', 'out', 'a1', 'in')];
    expect(
      hasDuplicateEdge(
        { sourceNodeId: 't2', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'in' },
        existing,
      ),
    ).toBe(false);
  });

  it('不同 sourceHandle 不视为重复', () => {
    const existing = [makeEdge('e1', 'cond1', 'then', 'a1', 'in')];
    expect(
      hasDuplicateEdge(
        { sourceNodeId: 'cond1', sourceHandle: 'else', targetNodeId: 'a1', targetHandle: 'in' },
        existing,
      ),
    ).toBe(false);
  });

  it('空 existingEdges 时永远不重复', () => {
    expect(
      hasDuplicateEdge(
        { sourceNodeId: 't1', sourceHandle: 'out', targetNodeId: 'a1', targetHandle: 'in' },
        [],
      ),
    ).toBe(false);
  });
});

// ===== getCompatibleTargetPins =====

describe('getCompatibleTargetPins', () => {
  it('trigger.out 返回所有 action 的 in 引脚', () => {
    const nodes = makeNodeIndex(
      makeTrigger('t1'),
      makeAction('a1'),
      makeAction('a2'),
      makeComment('c1'),
    );
    const result = getCompatibleTargetPins('t1', 'out', nodes, []);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ nodeId: 'a1', handle: 'in' });
    expect(result).toContainEqual({ nodeId: 'a2', handle: 'in' });
    // comment 不在结果中
    expect(result.find((p) => p.nodeId === 'c1')).toBeUndefined();
  });

  it('源节点不存在时返回空数组', () => {
    const nodes = makeNodeIndex(makeAction('a1'));
    const result = getCompatibleTargetPins('missing', 'out', nodes, []);
    expect(result).toEqual([]);
  });

  it('源为 comment 时返回空数组', () => {
    const nodes = makeNodeIndex(makeComment('c1'), makeAction('a1'));
    const result = getCompatibleTargetPins('c1', 'out', nodes, []);
    expect(result).toEqual([]);
  });

  it('源引脚不是输出引脚时返回空数组', () => {
    const nodes = makeNodeIndex(makeTrigger('t1'), makeAction('a1'));
    // trigger 没有 'in' 输出引脚
    const result = getCompatibleTargetPins('t1', 'in', nodes, []);
    expect(result).toEqual([]);
  });

  it('排除自环目标', () => {
    const nodes = makeNodeIndex(makeAction('a1'));
    const result = getCompatibleTargetPins('a1', 'out', nodes, []);
    expect(result).toEqual([]);
  });

  it('排除已连线的目标（避免重复）', () => {
    const nodes = makeNodeIndex(makeTrigger('t1'), makeAction('a1'));
    const existing = [makeEdge('e1', 't1', 'out', 'a1', 'in')];
    const result = getCompatibleTargetPins('t1', 'out', nodes, existing);
    expect(result).toEqual([]);
  });

  it('condition.then 可连到 action.in', () => {
    const condition: BlueprintNode = {
      id: 'cond1',
      kind: 'condition',
      position: { x: 0, y: 0 },
      config: {
        type: 'condition',
        expression: {
          source: { kind: 'componentProp', componentId: 'comp-a', key: 'value' },
          operator: 'eq',
          value: '1',
        },
      },
    };
    const action = makeAction('a1');
    const nodes = makeNodeIndex(condition, action);
    const result = getCompatibleTargetPins('cond1', 'then', nodes, []);
    expect(result).toContainEqual({ nodeId: 'a1', handle: 'in' });
  });
});
