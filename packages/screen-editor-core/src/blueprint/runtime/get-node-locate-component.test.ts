/**
 * getNodeLocateComponentId tests
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
  BlueprintNode,
  CommentNodeConfig,
  ConditionNodeConfig,
  GlobalNavigateConfig,
  GlobalRequestApiConfig,
  GlobalScrollToConfig,
} from '@nebula/shared';
import { getNodeLocateComponentId } from './get-node-locate-component';

const basePosition = { x: 0, y: 0 };

function makeComponentNode(
  overrides: Partial<Omit<Extract<BlueprintNode, { kind: 'component' }>, 'kind' | 'position'>> & {
    id?: string;
  } = {},
): Extract<BlueprintNode, { kind: 'component' }> {
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
): Extract<BlueprintNode, { kind: 'condition' }> {
  return { id, kind: 'condition', position: basePosition, config };
}

function makeDelayNode(id: string, delayMs: number): Extract<BlueprintNode, { kind: 'delay' }> {
  return { id, kind: 'delay', position: basePosition, config: { delayMs } };
}

function makeCommentNode(
  id: string,
  config: CommentNodeConfig,
): Extract<BlueprintNode, { kind: 'comment' }> {
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

describe('getNodeLocateComponentId', () => {
  describe('普通组件节点', () => {
    it('返回 componentId', () => {
      const node = makeComponentNode({ id: 'n1', componentId: 'comp-1' });
      expect(getNodeLocateComponentId(node)).toBe('comp-1');
    });

    it('componentId 为空字符串时返回 undefined', () => {
      const node = makeComponentNode({ id: 'n1', componentId: '' });
      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('全局节点', () => {
    it('pageLoad 全局节点返回 undefined', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'pageLoad',
      });
      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });

    it('navigate 全局节点返回 undefined', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'navigate',
        config: navigateConfig('https://example.com'),
      });
      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });

    it('requestApi 全局节点返回 undefined', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'requestApi',
        config: requestApiConfig('https://api.example.com'),
      });
      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });

    it('scrollTo 全局节点返回 config.targetComponentId', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'scrollTo',
        config: scrollToConfig('comp-target'),
      });
      expect(getNodeLocateComponentId(node)).toBe('comp-target');
    });

    it('scrollTo 全局节点 targetComponentId 为空时返回 undefined', () => {
      const node = makeComponentNode({
        id: 'n1',
        componentId: 'global',
        globalType: 'scrollTo',
        config: scrollToConfig(''),
      });
      expect(getNodeLocateComponentId(node)).toBeUndefined();
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
      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('delay 节点', () => {
    it('返回 undefined', () => {
      const node = makeDelayNode('n1', 500);
      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });
  });

  describe('comment 节点', () => {
    it('返回 undefined', () => {
      const node = makeCommentNode('n1', { text: '注释' });
      expect(getNodeLocateComponentId(node)).toBeUndefined();
    });
  });
});
