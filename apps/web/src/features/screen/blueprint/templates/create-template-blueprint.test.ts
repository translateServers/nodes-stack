/**
 * createTemplateBlueprint 纯函数测试（任务 9.3）
 *
 * 验证点：
 * - 三个模板各自返回结构正确的 EventBlueprint（trigger + action + 1 边）
 * - trigger 节点 kind=trigger，config 与模板类型对齐
 * - action 节点 kind=action，config 与模板类型对齐
 * - 边连接 trigger.out → action.in，与节点引脚约定一致
 * - 节点位置预设（trigger 在 (0,0)，action 在 (200,0)）
 * - 节点 ID 使用语义化固定值
 * - version=1
 */

import { describe, expect, it } from 'vitest';
import { createTemplateBlueprint } from './create-template-blueprint';
import type { EventBlueprint } from '@nebula/shared';

describe('createTemplateBlueprint（任务 9.3）', () => {
  describe('click-navigate 模板', () => {
    it('返回结构正确的蓝图（version=1，2 节点，1 边）', () => {
      const bp: EventBlueprint = createTemplateBlueprint('click-navigate');

      expect(bp.version).toBe(1);
      expect(bp.nodes).toHaveLength(2);
      expect(bp.edges).toHaveLength(1);
    });

    it('trigger 节点为 componentClick（componentId 为空字符串占位）', () => {
      const bp = createTemplateBlueprint('click-navigate');

      const trigger = bp.nodes[0];
      expect(trigger).toBeDefined();
      expect(trigger?.kind).toBe('trigger');
      expect(trigger?.id).toBe('trigger-1');
      expect(trigger?.position).toEqual({ x: 0, y: 0 });

      if (trigger?.kind === 'trigger') {
        expect(trigger.config.type).toBe('componentClick');
        expect((trigger.config as { componentId: string }).componentId).toBe('');
      }
    });

    it('action 节点为 navigate（url 为空字符串占位，target=_blank）', () => {
      const bp = createTemplateBlueprint('click-navigate');

      const action = bp.nodes[1];
      expect(action).toBeDefined();
      expect(action?.kind).toBe('action');
      expect(action?.id).toBe('action-1');
      expect(action?.position).toEqual({ x: 200, y: 0 });

      if (action?.kind === 'action') {
        expect(action.config.type).toBe('navigate');
        expect((action.config as { url: string }).url).toBe('');
        expect((action.config as { target: string }).target).toBe('_blank');
      }
    });

    it('边连接 trigger.out → action.in', () => {
      const bp = createTemplateBlueprint('click-navigate');

      const edge = bp.edges[0];
      expect(edge).toBeDefined();
      expect(edge?.id).toBe('edge-1');
      expect(edge?.source).toBe('trigger-1');
      expect(edge?.sourceHandle).toBe('out');
      expect(edge?.target).toBe('action-1');
      expect(edge?.targetHandle).toBe('in');
    });
  });

  describe('click-toggle-visibility 模板', () => {
    it('trigger 为 componentClick', () => {
      const bp = createTemplateBlueprint('click-toggle-visibility');

      const trigger = bp.nodes[0];
      expect(trigger?.kind).toBe('trigger');
      if (trigger?.kind === 'trigger') {
        expect(trigger.config.type).toBe('componentClick');
        expect((trigger.config as { componentId: string }).componentId).toBe('');
      }
    });

    it('action 为 setVisibility，visible=toggle（切换）', () => {
      const bp = createTemplateBlueprint('click-toggle-visibility');

      const action = bp.nodes[1];
      expect(action?.kind).toBe('action');
      if (action?.kind === 'action') {
        expect(action.config.type).toBe('setVisibility');
        expect((action.config as { targetComponentId: string }).targetComponentId).toBe('');
        expect((action.config as { visible: string }).visible).toBe('toggle');
      }
    });
  });

  describe('page-load-refresh 模板', () => {
    it('trigger 为 pageLoad（无关联组件）', () => {
      const bp = createTemplateBlueprint('page-load-refresh');

      const trigger = bp.nodes[0];
      expect(trigger?.kind).toBe('trigger');
      if (trigger?.kind === 'trigger') {
        expect(trigger.config.type).toBe('pageLoad');
      }
    });

    it('action 为 refreshDataSource（targetComponentId 为空）', () => {
      const bp = createTemplateBlueprint('page-load-refresh');

      const action = bp.nodes[1];
      expect(action?.kind).toBe('action');
      if (action?.kind === 'action') {
        expect(action.config.type).toBe('refreshDataSource');
        expect((action.config as { targetComponentId: string }).targetComponentId).toBe('');
      }
    });
  });

  describe('公共结构契约', () => {
    it('三个模板都有 trigger-1 + action-1 + edge-1 的固定 ID', () => {
      const ids = ['click-navigate', 'click-toggle-visibility', 'page-load-refresh'] as const;

      for (const id of ids) {
        const bp = createTemplateBlueprint(id);
        expect(bp.nodes.map((n) => n.id)).toEqual(['trigger-1', 'action-1']);
        expect(bp.edges[0]?.id).toBe('edge-1');
      }
    });

    it('三个模板的 trigger 都在 (0,0)，action 都在 (200,0)', () => {
      const ids = ['click-navigate', 'click-toggle-visibility', 'page-load-refresh'] as const;

      for (const id of ids) {
        const bp = createTemplateBlueprint(id);
        expect(bp.nodes[0]?.position).toEqual({ x: 0, y: 0 });
        expect(bp.nodes[1]?.position).toEqual({ x: 200, y: 0 });
      }
    });

    it('每次调用返回新对象（无单例共享，便于多实例插入）', () => {
      const bp1 = createTemplateBlueprint('click-navigate');
      const bp2 = createTemplateBlueprint('click-navigate');

      expect(bp1).toEqual(bp2);
      expect(bp1).not.toBe(bp2);
      expect(bp1.nodes).not.toBe(bp2.nodes);
      expect(bp1.edges).not.toBe(bp2.edges);
    });
  });
});
