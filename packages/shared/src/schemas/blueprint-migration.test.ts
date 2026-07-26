/**
 * V1 → V2 蓝图迁移测试
 *
 * 覆盖场景：
 * - 空蓝图迁移
 * - 单个 componentClick trigger + setVisibility action → 组件节点 + 组件节点 + 边
 * - pageLoad trigger → 全局 pageLoad 节点
 * - 多个 pageLoad trigger 合并
 * - navigate action → 全局 navigate 节点
 * - requestApi action → 全局 requestApi 节点
 * - 多个同组件 trigger 合并
 * - condition / comment 节点保留
 * - 边 handle 推导（trigger→action 的 evt:click→act:show）
 * - 无法推导的边产生 warning（action 作为源 / trigger 作为目标）
 */

import { describe, it, expect } from 'vitest';
import { migrateBlueprintV1ToV2 } from './blueprint-migration.js';
import {
  EVENT_BLUEPRINT_VERSION,
  GLOBAL_COMPONENT_ID,
  type EventBlueprint,
} from './blueprint.schema.js';

const basePosition = { x: 0, y: 0 };

function makeV1(overrides: Partial<EventBlueprint> = {}): EventBlueprint {
  return {
    version: EVENT_BLUEPRINT_VERSION,
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe('migrateBlueprintV1ToV2', () => {
  // ===== 空蓝图 =====

  it('空蓝图迁移：返回空 V2 蓝图，无 warning', () => {
    const result = migrateBlueprintV1ToV2(makeV1());
    expect(result.blueprint).toEqual({ version: 2, nodes: [], edges: [] });
    expect(result.warnings).toEqual([]);
  });

  // ===== 组件 trigger + 组件 action =====

  it('componentClick trigger + setVisibility(show) action → 两个组件节点 + 边 evt:click→act:show', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: { x: 100, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toHaveLength(2);
    expect(result.blueprint.nodes).toContainEqual({
      id: 'v2-component-c1',
      kind: 'component',
      componentId: 'c1',
      position: basePosition,
    });
    expect(result.blueprint.nodes).toContainEqual({
      id: 'v2-component-c2',
      kind: 'component',
      componentId: 'c2',
      position: { x: 100, y: 0 },
    });
    expect(result.blueprint.edges).toEqual([
      {
        id: 'e1',
        source: 'v2-component-c1',
        sourceHandle: 'evt:click',
        target: 'v2-component-c2',
        targetHandle: 'act:show',
      },
    ]);
  });

  it('setVisibility visible=hide → act:hide', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'hide' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges[0]?.targetHandle).toBe('act:hide');
  });

  it('setVisibility visible=toggle → act:toggleVisibility', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'toggle' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges[0]?.targetHandle).toBe('act:toggleVisibility');
  });

  it('scrollToComponent action → act:scrollTo', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'scrollToComponent', targetComponentId: 'c2' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges[0]?.targetHandle).toBe('act:scrollTo');
  });

  it('refreshDataSource action → act:refreshData', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'refreshDataSource', targetComponentId: 'c2' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges[0]?.targetHandle).toBe('act:refreshData');
  });

  // ===== 不同 trigger type 的 eventId 映射 =====

  it('componentHover trigger → evt:hover', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentHover', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges[0]?.sourceHandle).toBe('evt:hover');
  });

  it('dataLoaded trigger → evt:dataLoaded', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'dataLoaded', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges[0]?.sourceHandle).toBe('evt:dataLoaded');
  });

  it('dataError trigger → evt:dataError', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'dataError', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges[0]?.sourceHandle).toBe('evt:dataError');
  });

  // ===== 全局 pageLoad 节点 =====

  it('pageLoad trigger → 全局 pageLoad 节点', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'pageLoad' },
        },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toEqual([
      {
        id: 'v2-component-pageLoad',
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'pageLoad',
        position: basePosition,
      },
    ]);
  });

  it('多个 pageLoad trigger 合并为一个全局节点（取第一个位置）', () => {
    const v1 = makeV1({
      nodes: [
        { id: 't1', kind: 'trigger', position: { x: 10, y: 20 }, config: { type: 'pageLoad' } },
        { id: 't2', kind: 'trigger', position: { x: 100, y: 200 }, config: { type: 'pageLoad' } },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toHaveLength(1);
    expect(result.blueprint.nodes[0]).toEqual({
      id: 'v2-component-pageLoad',
      kind: 'component',
      componentId: GLOBAL_COMPONENT_ID,
      globalType: 'pageLoad',
      position: { x: 10, y: 20 },
    });
  });

  // ===== 全局 navigate 节点 =====

  it('navigate action → 全局 navigate 节点', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: {
            type: 'navigate',
            url: 'https://example.com',
            target: '_blank',
          },
        },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toEqual([
      {
        id: 'v2-component-navigate',
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'navigate',
        config: {
          globalType: 'navigate',
          url: 'https://example.com',
          target: '_blank',
        },
        position: basePosition,
      },
    ]);
  });

  it('多个 navigate action 合并为单例（取第一个位置和 config）', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 'a1',
          kind: 'action',
          position: { x: 10, y: 20 },
          config: { type: 'navigate', url: 'https://first.com', target: '_blank' },
        },
        {
          id: 'a2',
          kind: 'action',
          position: { x: 100, y: 200 },
          config: { type: 'navigate', url: 'https://second.com', target: '_self' },
        },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toHaveLength(1);
    expect(result.blueprint.nodes[0]).toEqual({
      id: 'v2-component-navigate',
      kind: 'component',
      componentId: GLOBAL_COMPONENT_ID,
      globalType: 'navigate',
      config: {
        globalType: 'navigate',
        url: 'https://first.com',
        target: '_blank',
      },
      position: { x: 10, y: 20 },
    });
  });

  // ===== 全局 requestApi 节点 =====

  it('requestApi action → 全局 requestApi 节点', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: {
            type: 'requestApi',
            method: 'GET',
            url: 'https://api.example.com',
            headers: { 'X-Auth': 'token' },
            body: '',
            secretHeaderKeys: ['X-Auth'],
            timeoutMs: 5000,
          },
        },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toEqual([
      {
        id: 'v2-component-requestApi',
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'requestApi',
        config: {
          globalType: 'requestApi',
          method: 'GET',
          url: 'https://api.example.com',
          headers: { 'X-Auth': 'token' },
          body: '',
          secretHeaderKeys: ['X-Auth'],
          timeoutMs: 5000,
        },
        position: basePosition,
      },
    ]);
  });

  // ===== 同组件节点合并 =====

  it('同一组件的多个 trigger 合并为一个组件节点', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 't2',
          kind: 'trigger',
          position: { x: 100, y: 100 },
          config: { type: 'componentHover', componentId: 'c1' },
        },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toHaveLength(1);
    expect(result.blueprint.nodes[0]).toEqual({
      id: 'v2-component-c1',
      kind: 'component',
      componentId: 'c1',
      position: { x: 0, y: 0 },
    });
  });

  it('同一组件的 trigger + action 合并为一个组件节点', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: { x: 100, y: 100 },
          config: { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' },
        },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toHaveLength(1);
    expect(result.blueprint.nodes[0]?.id).toBe('v2-component-c1');
  });

  // ===== condition / comment 节点保留 =====

  it('condition 节点保留（结构不变，position 不变）', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 'cd1',
          kind: 'condition',
          position: { x: 50, y: 50 },
          config: {
            type: 'condition',
            expression: {
              source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
              operator: 'eq',
              value: '1',
            },
          },
        },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toEqual([
      {
        id: 'v2-condition-cd1',
        kind: 'condition',
        position: { x: 50, y: 50 },
        config: {
          type: 'condition',
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'eq',
            value: '1',
          },
        },
      },
    ]);
  });

  it('comment 节点保留（结构不变，position 不变）', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 'cm1',
          kind: 'comment',
          position: { x: 50, y: 50 },
          config: { text: '备注' },
        },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.nodes).toEqual([
      {
        id: 'v2-comment-cm1',
        kind: 'comment',
        position: { x: 50, y: 50 },
        config: { text: '备注' },
      },
    ]);
  });

  // ===== 边 handle 推导 =====

  it('condition 节点的边 handle 保留：trigger→condition 输入 in，condition→action 输出 then', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
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
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'show' },
        },
      ],
      edges: [
        { id: 'e1', source: 't1', sourceHandle: 'out', target: 'cd1', targetHandle: 'in' },
        { id: 'e2', source: 'cd1', sourceHandle: 'then', target: 'a1', targetHandle: 'in' },
      ],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges).toEqual([
      {
        id: 'e1',
        source: 'v2-component-c1',
        sourceHandle: 'evt:click',
        target: 'v2-condition-cd1',
        targetHandle: 'in',
      },
      {
        id: 'e2',
        source: 'v2-condition-cd1',
        sourceHandle: 'then',
        target: 'v2-component-c2',
        targetHandle: 'act:show',
      },
    ]);
  });

  it('condition else 分支边保留', () => {
    const v1 = makeV1({
      nodes: [
        {
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
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'hide' },
        },
      ],
      edges: [{ id: 'e1', source: 'cd1', sourceHandle: 'else', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges[0]?.sourceHandle).toBe('else');
  });

  // ===== 无法推导的边产生 warning =====

  it('action 作为源节点产生 warning（保留 out）', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' },
        },
        {
          id: 'a2',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c2', visible: 'hide' },
        },
      ],
      edges: [{ id: 'e1', source: 'a1', sourceHandle: 'out', target: 'a2', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.sourceId).toBe('e1');
    expect(result.warnings[0]?.message).toContain('action');
    expect(result.blueprint.edges).toEqual([
      {
        id: 'e1',
        source: 'v2-component-c1',
        sourceHandle: 'out',
        target: 'v2-component-c2',
        targetHandle: 'act:hide',
      },
    ]);
  });

  it('trigger 作为目标节点产生 warning（保留 in）', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 't1',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentClick', componentId: 'c1' },
        },
        {
          id: 't2',
          kind: 'trigger',
          position: basePosition,
          config: { type: 'componentHover', componentId: 'c2' },
        },
      ],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 't2', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.sourceId).toBe('e1');
    expect(result.warnings[0]?.message).toContain('trigger');
    expect(result.blueprint.edges[0]?.targetHandle).toBe('in');
  });

  it('边引用不存在的节点产生 warning 并跳过', () => {
    const v1 = makeV1({
      nodes: [],
      edges: [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.sourceId).toBe('e1');
    expect(result.blueprint.edges).toEqual([]);
  });

  it('comment 作为源节点产生 warning', () => {
    const v1 = makeV1({
      nodes: [
        {
          id: 'cm1',
          kind: 'comment',
          position: basePosition,
          config: { text: '备注' },
        },
        {
          id: 'a1',
          kind: 'action',
          position: basePosition,
          config: { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' },
        },
      ],
      edges: [{ id: 'e1', source: 'cm1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
    });

    const result = migrateBlueprintV1ToV2(v1);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.sourceId).toBe('e1');
    expect(result.warnings[0]?.message).toContain('comment');
  });

  // ===== V2 蓝图版本号 =====

  it('迁移后蓝图版本号为 2', () => {
    const result = migrateBlueprintV1ToV2(makeV1());
    expect(result.blueprint.version).toBe(2);
  });
});
