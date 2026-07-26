/**
 * V2 引脚兼容性判定测试
 *
 * 验证点：
 * - evt:* → act:* / in 兼容
 * - out / then / else → act:* / in 兼容
 * - act:* 不能作为源（source-handle-is-input）
 * - evt:* 不能作为目标（target-handle-is-output）
 * - comment 节点隔离
 * - 组件节点自环允许，逻辑节点自环禁止
 * - 重复边检测
 * - 源/目标节点不存在
 * - getCompatibleTargetNodesV2 行为
 */

import { describe, expect, it } from 'vitest';

import {
  getCompatibleTargetNodesV2,
  isConnectionValidV2,
  isInputHandle,
  isOutputHandle,
} from './pin-compatibility-v2';
import type {
  V2ConnectionCandidate,
  V2Edge,
  V2NodeIndex,
  V2NodeIndexEntry,
} from './pin-compatibility-v2';

// ===== 构造器 =====

function makeComponent(id: string, componentId = 'comp-a'): V2NodeIndexEntry {
  return { id, kind: 'component', componentId };
}

function makeCondition(id: string): V2NodeIndexEntry {
  return { id, kind: 'condition' };
}

function makeDelay(id: string): V2NodeIndexEntry {
  return { id, kind: 'delay' };
}

function makeComment(id: string): V2NodeIndexEntry {
  return { id, kind: 'comment' };
}

function makeNodeIndex(...entries: V2NodeIndexEntry[]): V2NodeIndex {
  return new Map(entries.map((e) => [e.id, e]));
}

function makeEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
): V2Edge {
  return { id, source, sourceHandle, target, targetHandle };
}

function makeConn(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
): V2ConnectionCandidate {
  return { source, sourceHandle, target, targetHandle };
}

// ===== isOutputHandle / isInputHandle =====

describe('isOutputHandle / isInputHandle', () => {
  it('evt:click 是输出锚点，不是输入锚点', () => {
    expect(isOutputHandle('evt:click')).toBe(true);
    expect(isInputHandle('evt:click')).toBe(false);
  });

  it('evt:pageLoad 是输出锚点', () => {
    expect(isOutputHandle('evt:pageLoad')).toBe(true);
  });

  it('act:show 是输入锚点，不是输出锚点', () => {
    expect(isInputHandle('act:show')).toBe(true);
    expect(isOutputHandle('act:show')).toBe(false);
  });

  it('act:navigate 是输入锚点', () => {
    expect(isInputHandle('act:navigate')).toBe(true);
  });

  it('out 是输出锚点，不是输入锚点', () => {
    expect(isOutputHandle('out')).toBe(true);
    expect(isInputHandle('out')).toBe(false);
  });

  it('in 是输入锚点，不是输出锚点', () => {
    expect(isInputHandle('in')).toBe(true);
    expect(isOutputHandle('in')).toBe(false);
  });

  it('then / else 是输出锚点', () => {
    expect(isOutputHandle('then')).toBe(true);
    expect(isOutputHandle('else')).toBe(true);
    expect(isInputHandle('then')).toBe(false);
    expect(isInputHandle('else')).toBe(false);
  });

  it('未知 handle 既不是输出也不是输入', () => {
    expect(isOutputHandle('foo')).toBe(false);
    expect(isInputHandle('foo')).toBe(false);
  });
});

// ===== isConnectionValidV2 =====

describe('isConnectionValidV2', () => {
  it('evt:click → act:show 兼容（跨组件节点）', () => {
    const nodes = makeNodeIndex(makeComponent('c1', 'comp-a'), makeComponent('c2', 'comp-b'));
    const result = isConnectionValidV2(makeConn('c1', 'evt:click', 'c2', 'act:show'), nodes, []);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('evt:click → in 兼容（组件 → 逻辑节点）', () => {
    const nodes = makeNodeIndex(makeComponent('c1'), makeCondition('cond1'));
    const result = isConnectionValidV2(makeConn('c1', 'evt:click', 'cond1', 'in'), nodes, []);
    expect(result.valid).toBe(true);
  });

  it('out → act:show 兼容（逻辑节点 → 组件）', () => {
    const nodes = makeNodeIndex(makeDelay('d1'), makeComponent('c1'));
    const result = isConnectionValidV2(makeConn('d1', 'out', 'c1', 'act:show'), nodes, []);
    expect(result.valid).toBe(true);
  });

  it('then → in 兼容（condition → 逻辑节点）', () => {
    const nodes = makeNodeIndex(makeCondition('cond1'), makeDelay('d1'));
    const result = isConnectionValidV2(makeConn('cond1', 'then', 'd1', 'in'), nodes, []);
    expect(result.valid).toBe(true);
  });

  it('else → in 兼容（condition → 逻辑节点）', () => {
    const nodes = makeNodeIndex(makeCondition('cond1'), makeDelay('d1'));
    const result = isConnectionValidV2(makeConn('cond1', 'else', 'd1', 'in'), nodes, []);
    expect(result.valid).toBe(true);
  });

  it('out → in 兼容（delay → condition）', () => {
    const nodes = makeNodeIndex(makeDelay('d1'), makeCondition('cond1'));
    const result = isConnectionValidV2(makeConn('d1', 'out', 'cond1', 'in'), nodes, []);
    expect(result.valid).toBe(true);
  });

  it('act:show → act:hide 不兼容（源是输入锚点）', () => {
    const nodes = makeNodeIndex(makeComponent('c1'), makeComponent('c2'));
    const result = isConnectionValidV2(makeConn('c1', 'act:show', 'c2', 'act:hide'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('source-handle-is-input');
  });

  it('in → act:show 不兼容（源是输入锚点）', () => {
    const nodes = makeNodeIndex(makeCondition('cond1'), makeComponent('c1'));
    const result = isConnectionValidV2(makeConn('cond1', 'in', 'c1', 'act:show'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('source-handle-is-input');
  });

  it('evt:click → evt:hover 不兼容（目标是输出锚点）', () => {
    const nodes = makeNodeIndex(makeComponent('c1'), makeComponent('c2'));
    const result = isConnectionValidV2(makeConn('c1', 'evt:click', 'c2', 'evt:hover'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('target-handle-is-output');
  });

  it('evt:click → out 不兼容（目标是输出锚点）', () => {
    const nodes = makeNodeIndex(makeComponent('c1'), makeDelay('d1'));
    const result = isConnectionValidV2(makeConn('c1', 'evt:click', 'd1', 'out'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('target-handle-is-output');
  });

  it('源为 comment 节点时返回 comment-node-disconnected', () => {
    const nodes = makeNodeIndex(makeComment('cm1'), makeComponent('c1'));
    const result = isConnectionValidV2(makeConn('cm1', 'evt:click', 'c1', 'act:show'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('comment-node-disconnected');
  });

  it('目标为 comment 节点时返回 comment-node-disconnected', () => {
    const nodes = makeNodeIndex(makeComponent('c1'), makeComment('cm1'));
    const result = isConnectionValidV2(makeConn('c1', 'evt:click', 'cm1', 'act:show'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('comment-node-disconnected');
  });

  it('组件节点自环（evt:click → act:show 同节点）兼容', () => {
    const nodes = makeNodeIndex(makeComponent('c1'));
    const result = isConnectionValidV2(makeConn('c1', 'evt:click', 'c1', 'act:show'), nodes, []);
    expect(result.valid).toBe(true);
  });

  it('逻辑节点自环（condition.out → condition.in 同节点）不兼容', () => {
    const nodes = makeNodeIndex(makeCondition('cond1'));
    const result = isConnectionValidV2(makeConn('cond1', 'out', 'cond1', 'in'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('self-loop-logic');
  });

  it('逻辑节点自环（delay.out → delay.in 同节点）不兼容', () => {
    const nodes = makeNodeIndex(makeDelay('d1'));
    const result = isConnectionValidV2(makeConn('d1', 'out', 'd1', 'in'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('self-loop-logic');
  });

  it('逻辑节点自环（condition.then → condition.in 同节点）不兼容', () => {
    const nodes = makeNodeIndex(makeCondition('cond1'));
    const result = isConnectionValidV2(makeConn('cond1', 'then', 'cond1', 'in'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('self-loop-logic');
  });

  it('重复边不兼容', () => {
    const nodes = makeNodeIndex(makeComponent('c1'), makeComponent('c2'));
    const existing = [makeEdge('e1', 'c1', 'evt:click', 'c2', 'act:show')];
    const result = isConnectionValidV2(
      makeConn('c1', 'evt:click', 'c2', 'act:show'),
      nodes,
      existing,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('duplicate-edge');
  });

  it('不同 sourceHandle 不视为重复（then 与 else 可同时连到同一 in）', () => {
    const nodes = makeNodeIndex(makeCondition('cond1'), makeDelay('d1'));
    const existing = [makeEdge('e1', 'cond1', 'then', 'd1', 'in')];
    const result = isConnectionValidV2(makeConn('cond1', 'else', 'd1', 'in'), nodes, existing);
    expect(result.valid).toBe(true);
  });

  it('源节点不存在时返回 source-node-not-found', () => {
    const nodes = makeNodeIndex(makeComponent('c1'));
    const result = isConnectionValidV2(
      makeConn('missing', 'evt:click', 'c1', 'act:show'),
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('source-node-not-found');
  });

  it('目标节点不存在时返回 target-node-not-found', () => {
    const nodes = makeNodeIndex(makeComponent('c1'));
    const result = isConnectionValidV2(
      makeConn('c1', 'evt:click', 'missing', 'act:show'),
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('target-node-not-found');
  });

  it('检查顺序：源节点不存在优先于目标节点不存在', () => {
    const nodes = makeNodeIndex();
    const result = isConnectionValidV2(
      makeConn('missing-source', 'evt:click', 'missing-target', 'act:show'),
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('source-node-not-found');
  });

  it('检查顺序：comment 检查优先于 handle 类型检查', () => {
    // 源是 comment 且 handle 也是输入锚点，应先报 comment-node-disconnected
    const nodes = makeNodeIndex(makeComment('cm1'), makeComponent('c1'));
    const result = isConnectionValidV2(makeConn('cm1', 'act:show', 'c1', 'act:show'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('comment-node-disconnected');
  });

  it('检查顺序：handle 类型检查优先于自环检查', () => {
    // 逻辑节点自环，但源 handle 是输入锚点，应先报 source-handle-is-input
    const nodes = makeNodeIndex(makeCondition('cond1'));
    const result = isConnectionValidV2(makeConn('cond1', 'act:show', 'cond1', 'in'), nodes, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('source-handle-is-input');
  });

  it('检查顺序：自环检查优先于重复边检查', () => {
    // 逻辑节点自环，且边已存在，应先报 self-loop-logic
    const nodes = makeNodeIndex(makeCondition('cond1'));
    const existing = [makeEdge('e1', 'cond1', 'out', 'cond1', 'in')];
    const result = isConnectionValidV2(makeConn('cond1', 'out', 'cond1', 'in'), nodes, existing);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('self-loop-logic');
  });
});

// ===== getCompatibleTargetNodesV2 =====

describe('getCompatibleTargetNodesV2', () => {
  it('组件源返回所有非 comment 节点（包含自身，因为组件允许自环）', () => {
    const nodes = makeNodeIndex(
      makeComponent('c1'),
      makeComponent('c2'),
      makeCondition('cond1'),
      makeDelay('d1'),
      makeComment('cm1'),
    );
    const result = getCompatibleTargetNodesV2('c1', 'evt:click', nodes);
    expect(result).toContain('c1');
    expect(result).toContain('c2');
    expect(result).toContain('cond1');
    expect(result).toContain('d1');
    expect(result).not.toContain('cm1');
  });

  it('逻辑节点源排除自身（避免自环）', () => {
    const nodes = makeNodeIndex(makeCondition('cond1'), makeComponent('c1'), makeDelay('d1'));
    const result = getCompatibleTargetNodesV2('cond1', 'then', nodes);
    expect(result).toContain('c1');
    expect(result).toContain('d1');
    expect(result).not.toContain('cond1');
  });

  it('delay 节点源排除自身', () => {
    const nodes = makeNodeIndex(makeDelay('d1'), makeComponent('c1'));
    const result = getCompatibleTargetNodesV2('d1', 'out', nodes);
    expect(result).toContain('c1');
    expect(result).not.toContain('d1');
  });

  it('排除 comment 节点', () => {
    const nodes = makeNodeIndex(
      makeComponent('c1'),
      makeComment('cm1'),
      makeComment('cm2'),
      makeCondition('cond1'),
    );
    const result = getCompatibleTargetNodesV2('c1', 'evt:click', nodes);
    expect(result).toContain('c1');
    expect(result).toContain('cond1');
    expect(result).not.toContain('cm1');
    expect(result).not.toContain('cm2');
  });

  it('源节点不存在时返回空数组', () => {
    const nodes = makeNodeIndex(makeComponent('c1'));
    const result = getCompatibleTargetNodesV2('missing', 'evt:click', nodes);
    expect(result).toEqual([]);
  });

  it('源为 comment 时返回空数组', () => {
    const nodes = makeNodeIndex(makeComment('cm1'), makeComponent('c1'));
    const result = getCompatibleTargetNodesV2('cm1', 'evt:click', nodes);
    expect(result).toEqual([]);
  });

  it('源 handle 是输入锚点时返回空数组', () => {
    const nodes = makeNodeIndex(makeComponent('c1'), makeComponent('c2'));
    const result = getCompatibleTargetNodesV2('c1', 'act:show', nodes);
    expect(result).toEqual([]);
  });

  it('源 handle 是未知 handle 时返回空数组', () => {
    const nodes = makeNodeIndex(makeComponent('c1'), makeComponent('c2'));
    const result = getCompatibleTargetNodesV2('c1', 'foo', nodes);
    expect(result).toEqual([]);
  });
});
