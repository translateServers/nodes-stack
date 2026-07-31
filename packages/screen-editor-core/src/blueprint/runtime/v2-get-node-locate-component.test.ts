/**
 * getV2NodeLocateComponentId 测试
 *
 * 覆盖：
 * - 普通组件节点：返回 componentId
 * - 全局 pageLoad / navigate / requestApi 节点：返回 undefined
 * - 全局 scrollTo 节点：返回 config.targetComponentId
 * - condition / delay / comment 节点：返回 undefined
 * - 空字符串视为未配置
 */

import { describe, expect, it } from 'vitest';
import type {
  BlueprintNodeV2,
  CommentNodeConfig,
  ConditionNodeConfig,
  GlobalNavigateConfig,
  GlobalRequestApiConfig,
  GlobalScrollToConfig,
} from '@nebula/shared';
import { getV2NodeLocateComponentId } from './v2-get-node-locate-component';

const basePosition = { x: 0, y: 0 };

function makeComponentNode(
  overrides: Partial<Omit<Extract<BlueprintNodeV2, { kind: 'component' }>, 'kind' | 'position'>> & {
    id?: string;
  } = {},
): Extract<BlueprintNodeV2, { kind: 'component' }> {
  return {
    id: overrides.id ?? 'n1',
    kind: 'component',
    componentId: overrides.componentId ?? '',
    position: basePosition,
    globalType: overrides.globalType,
    config: overrides.config,
  };
}

function makeConditionNode(
  id: string,
  config: ConditionNodeConfig,
): Extract<BlueprintNodeV2, { kind: 'condition' }> {
  return { id, kind: 'condition', position: basePosition, config };
}

function makeDelayNode(id: string, delayMs: number): Extract<BlueprintNodeV2, { kind: 'delay' }> {
  return { id, kind: 'delay', position: basePosition, config: { delayMs } };
}

function makeCommentNode(
  id: string,
  config: CommentNodeConfig,
): Extract<BlueprintNodeV2, { kind: 'comment' }> {
  return { id, kind: 'comment', position: basePosition, config };
}

function navigateConfig(url: string): GlobalNavigateConfig {
  return { globalType: 'navigate', url, target: '_blank' };
}

function requestApiConfig(url: string): GlobalRequestApiConfig {
  return {
    globalType: 'requestApi',
    method: 'GET',
    url,
    headers: {},
    body: '',
    secretHeaderKeys: [],
    timeoutMs: 10_000,
  };
}

function scrollToConfig(targetComponentId: string): GlobalScrollToConfig {
  return { globalType: 'scrollTo', targetComponentId };
}

describe('getV2NodeLocateComponentId', () => {
  describe('普通组件节点', () => {
    it('返回 componentId', () => {
      const node = makeComponentNode({ id: 'n1', componentId: 'comp-1' });
      expect(getV2NodeLocateComponentId(node)).toBe('comp-1');
    });

    it('componentId 为空字符串时返回 undefined', () => {
      const node = makeComponentNode({ id: 'n1', componentId: '' });
      expect(getV2NodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('全局节点', () => {
    it('pageLoad 全局节点返回 undefined', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'pageLoad',
      });
      expect(getV2NodeLocateComponentId(node)).toBeUndefined();
    });

    it('navigate 全局节点返回 undefined', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'navigate',
        config: navigateConfig('https://example.com'),
      });
      expect(getV2NodeLocateComponentId(node)).toBeUndefined();
    });

    it('requestApi 全局节点返回 undefined', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'requestApi',
        config: requestApiConfig('https://api.example.com'),
      });
      expect(getV2NodeLocateComponentId(node)).toBeUndefined();
    });

    it('scrollTo 全局节点返回 config.targetComponentId', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'scrollTo',
        config: scrollToConfig('comp-target'),
      });
      expect(getV2NodeLocateComponentId(node)).toBe('comp-target');
    });

    it('scrollTo 全局节点 targetComponentId 为空时返回 undefined', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'scrollTo',
        config: scrollToConfig(''),
      });
      expect(getV2NodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('condition 节点', () => {
    it('返回 undefined', () => {
      const node = makeConditionNode('n1', {
        type: 'condition',
        expression: {
          source: { kind: 'componentProp', componentId: 'comp-x', key: 'value' },
          operator: 'eq',
          value: 'test',
        },
      });
      expect(getV2NodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('delay 节点', () => {
    it('返回 undefined', () => {
      const node = makeDelayNode('n1', 500);
      expect(getV2NodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('comment 节点', () => {
    it('返回 undefined', () => {
      const node = makeCommentNode('n1', { text: '注释' });
      expect(getV2NodeLocateComponentId(node)).toBeUndefined();
    });
  });
});
