/**
 * getNodeLocateComponentId 纯函数测试（任务 9.1）
 *
 * 验证点：
 * - trigger.componentClick：取 data.componentId
 * - trigger.pageLoad：无关联组件，返回 undefined
 * - action：取 data.targetComponentId
 * - comment：无关联组件，返回 undefined
 * - 空字符串视为未配置，返回 undefined
 */

import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { getNodeLocateComponentId } from './get-node-locate-component';

function makeNode(type: string, data: Record<string, unknown>): Node {
  return {
    id: 'test-node',
    type,
    position: { x: 0, y: 0 },
    data,
  };
}

describe('getNodeLocateComponentId（任务 9.1）', () => {
  describe('trigger 节点', () => {
    it('componentClick 类型：返回 data.componentId', () => {
      const node = makeNode('trigger', {
        config: { type: 'componentClick', componentId: 'comp-1' },
        componentId: 'comp-1',
        label: '点击：comp-1',
      });

      expect(getNodeLocateComponentId(node)).toBe('comp-1');
    });

    it('pageLoad 类型：无关联组件，返回 undefined', () => {
      const node = makeNode('trigger', {
        config: { type: 'pageLoad' },
        label: '页面加载',
      });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });

    it('componentClick 但 componentId 为空字符串：视为未配置', () => {
      const node = makeNode('trigger', {
        config: { type: 'componentClick', componentId: '' },
        componentId: '',
        label: '点击：未配置',
      });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });

    it('componentClick 但 componentId 缺失：返回 undefined', () => {
      const node = makeNode('trigger', {
        config: { type: 'componentClick', componentId: 'comp-x' },
        // componentId 字段缺失
        label: '点击：comp-x',
      });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('action 节点', () => {
    it('setVisibility：返回 data.targetComponentId', () => {
      const node = makeNode('action', {
        config: { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'show' },
        targetComponentId: 'comp-a',
        label: '显示：comp-a',
      });

      expect(getNodeLocateComponentId(node)).toBe('comp-a');
    });

    it('scrollToComponent：返回 data.targetComponentId', () => {
      const node = makeNode('action', {
        config: { type: 'scrollToComponent', targetComponentId: 'comp-b' },
        targetComponentId: 'comp-b',
        label: '滚动至：comp-b',
      });

      expect(getNodeLocateComponentId(node)).toBe('comp-b');
    });

    it('refreshDataSource：返回 data.targetComponentId', () => {
      const node = makeNode('action', {
        config: { type: 'refreshDataSource', targetComponentId: 'comp-c' },
        targetComponentId: 'comp-c',
        label: '刷新数据：comp-c',
      });

      expect(getNodeLocateComponentId(node)).toBe('comp-c');
    });

    it('navigate：无 targetComponentId 字段，返回 undefined', () => {
      const node = makeNode('action', {
        config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
        label: '跳转：https://example.com',
      });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });

    it('targetComponentId 为空字符串：视为未配置', () => {
      const node = makeNode('action', {
        config: { type: 'setVisibility', targetComponentId: '', visible: 'show' },
        targetComponentId: '',
        label: '显示：未配置',
      });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });

    it('targetComponentId 缺失：返回 undefined', () => {
      const node = makeNode('action', {
        config: { type: 'setVisibility', targetComponentId: 'comp-d' },
        label: '显示：comp-d',
      });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('comment 节点', () => {
    it('comment 节点：无关联组件，返回 undefined', () => {
      const node = makeNode('comment', {
        config: { text: '这是一个注释' },
        label: '这是一个注释',
      });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('未知类型', () => {
    it('condition 节点（M3 预留）：返回 undefined', () => {
      const node = makeNode('condition', {
        config: {
          type: 'condition',
          expression: {
            source: { kind: 'componentProp', componentId: 'comp-x', key: 'value' },
            operator: 'eq',
            value: 'test',
          },
        },
        label: '条件判断',
      });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });

    it('未知 type：返回 undefined', () => {
      const node = makeNode('unknown', { label: '未知节点' });

      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });
  });
});
