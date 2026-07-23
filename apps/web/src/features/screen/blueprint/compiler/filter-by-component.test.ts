/**
 * filterBlueprintByComponent 纯函数测试（任务 9.2）
 *
 * 验证点：
 * - trigger.componentClick 节点匹配 componentId
 * - trigger.pageLoad 不涉及任何组件
 * - action 节点匹配 targetComponentId
 * - navigate 动作不涉及组件（无 targetComponentId）
 * - comment 节点不涉及组件
 * - 边仅保留两端都是涉及节点的边
 * - 无涉及节点时返回空
 * - componentId 为空/null/undefined 时返回空
 */

import { describe, expect, it } from 'vitest';
import { filterBlueprintByComponent } from './filter-by-component';
import type { EventBlueprint } from '@nebula/shared';

function makeBlueprint(
  nodes: EventBlueprint['nodes'],
  edges: EventBlueprint['edges'] = [],
): EventBlueprint {
  return { version: 1, nodes, edges };
}

describe('filterBlueprintByComponent（任务 9.2）', () => {
  describe('componentId 边界', () => {
    it('componentId 为 undefined：返回空', () => {
      const blueprint = makeBlueprint([
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'c1' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, undefined);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('componentId 为空字符串：返回空', () => {
      const blueprint = makeBlueprint([
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'c1' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, '');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('componentId 为 null：返回空', () => {
      const blueprint = makeBlueprint([
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'c1' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, null);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe('trigger 节点过滤', () => {
    it('componentClick 节点匹配 componentId', () => {
      const blueprint = makeBlueprint([
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 't2',
          kind: 'trigger',
          position: { x: 100, y: 0 },
          config: { type: 'componentClick', componentId: 'c2' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, 'c1');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.id).toBe('t1');
    });

    it('pageLoad 节点不涉及任何组件', () => {
      const blueprint = makeBlueprint([
        {
          id: 't-page',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'pageLoad' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, 'any-comp');

      expect(result.nodes).toEqual([]);
    });
  });

  describe('action 节点过滤', () => {
    it('setVisibility 匹配 targetComponentId', () => {
      const blueprint = makeBlueprint([
        {
          id: 'a1',
          kind: 'action',
          position: { x: 0, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' },
        },
        {
          id: 'a2',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'hide' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, 'c1');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.id).toBe('a1');
    });

    it('scrollToComponent 匹配 targetComponentId', () => {
      const blueprint = makeBlueprint([
        {
          id: 'a1',
          kind: 'action',
          position: { x: 0, y: 0 },
          config: { type: 'scrollToComponent', targetComponentId: 'c1' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, 'c1');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.id).toBe('a1');
    });

    it('refreshDataSource 匹配 targetComponentId', () => {
      const blueprint = makeBlueprint([
        {
          id: 'a1',
          kind: 'action',
          position: { x: 0, y: 0 },
          config: { type: 'refreshDataSource', targetComponentId: 'c1' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, 'c1');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.id).toBe('a1');
    });

    it('navigate 动作不涉及组件（无 targetComponentId）', () => {
      const blueprint = makeBlueprint([
        {
          id: 'a1',
          kind: 'action',
          position: { x: 0, y: 0 },
          config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, 'any-comp');

      expect(result.nodes).toEqual([]);
    });
  });

  describe('comment 节点过滤', () => {
    it('comment 节点不涉及组件', () => {
      const blueprint = makeBlueprint([
        {
          id: 'cm1',
          kind: 'comment',
          position: { x: 0, y: 0 },
          config: { text: '注释内容' },
        },
      ]);

      const result = filterBlueprintByComponent(blueprint, 'any-comp');

      expect(result.nodes).toEqual([]);
    });
  });

  describe('边过滤', () => {
    it('保留两端都是涉及节点的边', () => {
      const blueprint = makeBlueprint(
        [
          {
            id: 't1',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'c1' },
          },
          {
            id: 'a1',
            kind: 'action',
            position: { x: 100, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' },
          },
          {
            id: 'a2',
            kind: 'action',
            position: { x: 200, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'hide' },
          },
        ],
        [
          { id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' },
          { id: 'e2', source: 't1', sourceHandle: 'out', target: 'a2', targetHandle: 'in' },
          { id: 'e3', source: 'a1', sourceHandle: 'out', target: 'a2', targetHandle: 'in' },
        ],
      );

      const result = filterBlueprintByComponent(blueprint, 'c1');

      // 涉及节点：t1, a1（a2 不涉及）
      expect(result.nodes.map((n) => n.id)).toEqual(['t1', 'a1']);
      // 仅 e1 两端都是涉及节点；e2/e3 涉及 a2（不涉及）
      expect(result.edges.map((e) => e.id)).toEqual(['e1']);
    });

    it('无涉及节点时边也为空', () => {
      const blueprint = makeBlueprint(
        [
          {
            id: 't1',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'c1' },
          },
        ],
        [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 't1', targetHandle: 'in' }],
      );

      const result = filterBlueprintByComponent(blueprint, 'non-existent');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('涉及节点之间无直接边时边为空', () => {
      const blueprint = makeBlueprint(
        [
          {
            id: 't1',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'c1' },
          },
          {
            id: 'a1',
            kind: 'action',
            position: { x: 100, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' },
          },
          // a2 涉及 c1 但不与 t1/a1 直接连线
          {
            id: 'a2',
            kind: 'action',
            position: { x: 200, y: 0 },
            config: { type: 'refreshDataSource', targetComponentId: 'c1' },
          },
        ],
        [
          // 只有 t1 -> a1 的边
          { id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' },
        ],
      );

      const result = filterBlueprintByComponent(blueprint, 'c1');

      // 三个涉及节点
      expect(result.nodes.map((n) => n.id)).toEqual(['t1', 'a1', 'a2']);
      // 仅 t1->a1 一条边
      expect(result.edges.map((e) => e.id)).toEqual(['e1']);
    });
  });

  describe('多组件混合场景', () => {
    it('同一组件被多个节点引用：全部返回', () => {
      const blueprint = makeBlueprint(
        [
          {
            id: 't1',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'shared-comp' },
          },
          {
            id: 'a1',
            kind: 'action',
            position: { x: 100, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'shared-comp', visible: 'show' },
          },
          {
            id: 'a2',
            kind: 'action',
            position: { x: 200, y: 0 },
            config: { type: 'scrollToComponent', targetComponentId: 'shared-comp' },
          },
          {
            id: 'a3',
            kind: 'action',
            position: { x: 300, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'other-comp', visible: 'hide' },
          },
        ],
        [
          { id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' },
          { id: 'e2', source: 'a1', sourceHandle: 'out', target: 'a2', targetHandle: 'in' },
          { id: 'e3', source: 'a2', sourceHandle: 'out', target: 'a3', targetHandle: 'in' },
        ],
      );

      const result = filterBlueprintByComponent(blueprint, 'shared-comp');

      // t1, a1, a2 涉及 shared-comp；a3 涉及 other-comp
      expect(result.nodes.map((n) => n.id)).toEqual(['t1', 'a1', 'a2']);
      // e1, e2 两端都是涉及节点；e3 涉及 a3（不涉及）
      expect(result.edges.map((e) => e.id)).toEqual(['e1', 'e2']);
    });

    it('保留节点与边按 blueprint 原顺序', () => {
      const blueprint = makeBlueprint(
        [
          {
            id: 'b-node',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'c1' },
          },
          {
            id: 'a-node',
            kind: 'action',
            position: { x: 0, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' },
          },
        ],
        [
          {
            id: 'e-a',
            source: 'b-node',
            sourceHandle: 'out',
            target: 'a-node',
            targetHandle: 'in',
          },
        ],
      );

      const result = filterBlueprintByComponent(blueprint, 'c1');

      // 按原顺序返回（b-node 在前）
      expect(result.nodes.map((n) => n.id)).toEqual(['b-node', 'a-node']);
      expect(result.edges.map((e) => e.id)).toEqual(['e-a']);
    });
  });
});
