/**
 * Blueprint component filter tests
 *
 * 测试用例：
 * 1. 过滤返回相关节点 ID
 * 2. 无关组件节点不返回
 * 3. 通过 condition 连接的节点都返回
 */

import { describe, it, expect } from 'vitest';
import type { BlueprintEdge, BlueprintNode, EventBlueprint } from '@nebula/shared';
import { filterBlueprintByComponent } from './filter-by-component.js';

// ===== 公共构造器 =====

function makeComponentNode(id: string, componentId: string): BlueprintNode {
  return {
    id,
    kind: 'component',
    position: { x: 0, y: 0 },
    componentId,
  };
}

function makeConditionNode(id: string): BlueprintNode {
  return {
    id,
    kind: 'condition',
    position: { x: 0, y: 0 },
    config: {
      type: 'condition',
      expression: {
        source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
        operator: 'eq',
        value: '1',
      },
    },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
): BlueprintEdge {
  return { id, source, target, sourceHandle, targetHandle };
}

function makeBlueprint(nodes: BlueprintNode[], edges: BlueprintEdge[]): EventBlueprint {
  return { version: 2, nodes, edges };
}

// ===== 测试用例 =====

describe('filterBlueprintByComponent', () => {
  it('1. 过滤返回相关节点 ID', () => {
    // c1(comp1) → c2(comp2)，过滤 comp1 应返回 c1 与 c2
    const bp = makeBlueprint(
      [makeComponentNode('c1', 'comp1'), makeComponentNode('c2', 'comp2')],
      [makeEdge('e1', 'c1', 'c2', 'evt:click', 'act:show')],
    );

    const result = filterBlueprintByComponent(bp, 'comp1');

    expect(result.size).toBe(2);
    expect(result.has('c1')).toBe(true);
    expect(result.has('c2')).toBe(true);
  });

  it('2. 无关组件节点不返回', () => {
    // c1(comp1) → c2(comp2)；c3(comp3) → c4(comp4) 两条独立链
    const bp = makeBlueprint(
      [
        makeComponentNode('c1', 'comp1'),
        makeComponentNode('c2', 'comp2'),
        makeComponentNode('c3', 'comp3'),
        makeComponentNode('c4', 'comp4'),
      ],
      [
        makeEdge('e1', 'c1', 'c2', 'evt:click', 'act:show'),
        makeEdge('e2', 'c3', 'c4', 'evt:click', 'act:show'),
      ],
    );

    const result = filterBlueprintByComponent(bp, 'comp1');

    expect(result.size).toBe(2);
    expect(result.has('c1')).toBe(true);
    expect(result.has('c2')).toBe(true);
    expect(result.has('c3')).toBe(false);
    expect(result.has('c4')).toBe(false);
  });

  it('3. 通过 condition 连接的节点都返回', () => {
    // c1(comp1) → cond.in, cond.then → c2(comp2)，过滤 comp1 应返回 c1, cond, c2
    const bp = makeBlueprint(
      [
        makeComponentNode('c1', 'comp1'),
        makeConditionNode('cond'),
        makeComponentNode('c2', 'comp2'),
      ],
      [
        makeEdge('e1', 'c1', 'cond', 'evt:click', 'in'),
        makeEdge('e2', 'cond', 'c2', 'then', 'act:show'),
      ],
    );

    const result = filterBlueprintByComponent(bp, 'comp1');

    expect(result.size).toBe(3);
    expect(result.has('c1')).toBe(true);
    expect(result.has('cond')).toBe(true);
    expect(result.has('c2')).toBe(true);
  });
});
