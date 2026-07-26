/**
 * createTemplateBlueprint 纯函数测试（任务 9.3 / 任务 6.1 V2 重写）
 *
 * 验证点：
 * - 四个模板各自返回结构正确的 EventBlueprintV2（组件节点 / 全局节点 / 逻辑节点 + 边）
 * - 节点 kind 与 V2 schema 对齐（component / delay）
 * - 边使用 V2 语义化 handle 格式（evt:* / act:* / in / out）
 * - 节点位置预设（水平流水线，间距 240px）
 * - 节点 ID 使用语义化固定值
 * - version=2
 */

import { describe, expect, it } from 'vitest';
import { createTemplateBlueprint } from './create-template-blueprint';
import type { EventBlueprintV2 } from '@nebula/shared';

describe('createTemplateBlueprint（任务 6.1 V2）', () => {
  describe('click-navigate 模板', () => {
    it('返回结构正确的蓝图（version=2，2 节点，1 边）', () => {
      const bp: EventBlueprintV2 = createTemplateBlueprint('click-navigate');

      expect(bp.version).toBe(2);
      expect(bp.nodes).toHaveLength(2);
      expect(bp.edges).toHaveLength(1);
    });

    it('源节点为组件节点 A（componentId 为空字符串占位）', () => {
      const bp = createTemplateBlueprint('click-navigate');

      const source = bp.nodes[0];
      expect(source).toBeDefined();
      expect(source?.kind).toBe('component');
      expect(source?.id).toBe('comp-a');
      expect(source?.position).toEqual({ x: 0, y: 0 });

      if (source?.kind === 'component') {
        expect(source.componentId).toBe('');
        expect(source.globalType).toBeUndefined();
        expect(source.config).toBeUndefined();
      }
    });

    it('目标节点为全局 navigate 节点（url 为空字符串占位，target=_blank）', () => {
      const bp = createTemplateBlueprint('click-navigate');

      const target = bp.nodes[1];
      expect(target).toBeDefined();
      expect(target?.kind).toBe('component');
      expect(target?.id).toBe('global-navigate');
      expect(target?.position).toEqual({ x: 240, y: 0 });

      if (target?.kind === 'component') {
        expect(target.componentId).toBe('global');
        expect(target.globalType).toBe('navigate');
        expect(target.config).toEqual({
          globalType: 'navigate',
          url: '',
          target: '_blank',
        });
      }
    });

    it('边连接 comp-a.evt:click → global-navigate.act:navigate', () => {
      const bp = createTemplateBlueprint('click-navigate');

      const edge = bp.edges[0];
      expect(edge).toBeDefined();
      expect(edge?.id).toBe('edge-1');
      expect(edge?.source).toBe('comp-a');
      expect(edge?.sourceHandle).toBe('evt:click');
      expect(edge?.target).toBe('global-navigate');
      expect(edge?.targetHandle).toBe('act:navigate');
    });
  });

  describe('click-toggle-visibility 模板', () => {
    it('源节点为组件节点 A（componentId 为空）', () => {
      const bp = createTemplateBlueprint('click-toggle-visibility');

      const source = bp.nodes[0];
      expect(source?.kind).toBe('component');
      if (source?.kind === 'component') {
        expect(source.componentId).toBe('');
        expect(source.globalType).toBeUndefined();
      }
    });

    it('目标节点为组件节点 B（componentId 为空）', () => {
      const bp = createTemplateBlueprint('click-toggle-visibility');

      const target = bp.nodes[1];
      expect(target?.kind).toBe('component');
      if (target?.kind === 'component') {
        expect(target.componentId).toBe('');
        expect(target.globalType).toBeUndefined();
      }
    });

    it('边使用 evt:click → act:toggleVisibility', () => {
      const bp = createTemplateBlueprint('click-toggle-visibility');

      const edge = bp.edges[0];
      expect(edge?.sourceHandle).toBe('evt:click');
      expect(edge?.targetHandle).toBe('act:toggleVisibility');
    });
  });

  describe('page-load-refresh 模板', () => {
    it('源节点为全局 pageLoad 节点（无 config）', () => {
      const bp = createTemplateBlueprint('page-load-refresh');

      const source = bp.nodes[0];
      expect(source?.kind).toBe('component');
      if (source?.kind === 'component') {
        expect(source.componentId).toBe('global');
        expect(source.globalType).toBe('pageLoad');
        expect(source.config).toBeUndefined();
      }
    });

    it('目标节点为组件节点 B（componentId 为空）', () => {
      const bp = createTemplateBlueprint('page-load-refresh');

      const target = bp.nodes[1];
      expect(target?.kind).toBe('component');
      if (target?.kind === 'component') {
        expect(target.componentId).toBe('');
      }
    });

    it('边使用 evt:pageLoad → act:refreshData', () => {
      const bp = createTemplateBlueprint('page-load-refresh');

      const edge = bp.edges[0];
      expect(edge?.sourceHandle).toBe('evt:pageLoad');
      expect(edge?.targetHandle).toBe('act:refreshData');
    });
  });

  describe('click-delay-show 模板', () => {
    it('返回 3 节点 2 边的延时流水线', () => {
      const bp = createTemplateBlueprint('click-delay-show');

      expect(bp.nodes).toHaveLength(3);
      expect(bp.edges).toHaveLength(2);
    });

    it('中间节点为 delay 节点（delayMs=500）', () => {
      const bp = createTemplateBlueprint('click-delay-show');

      const delay = bp.nodes[1];
      expect(delay?.kind).toBe('delay');
      expect(delay?.id).toBe('delay-1');
      expect(delay?.position).toEqual({ x: 240, y: 0 });
      if (delay?.kind === 'delay') {
        expect(delay.config.delayMs).toBe(500);
      }
    });

    it('第一条边连接 comp-a.evt:click → delay-1.in', () => {
      const bp = createTemplateBlueprint('click-delay-show');

      const edge1 = bp.edges[0];
      expect(edge1?.source).toBe('comp-a');
      expect(edge1?.sourceHandle).toBe('evt:click');
      expect(edge1?.target).toBe('delay-1');
      expect(edge1?.targetHandle).toBe('in');
    });

    it('第二条边连接 delay-1.out → comp-b.act:show', () => {
      const bp = createTemplateBlueprint('click-delay-show');

      const edge2 = bp.edges[1];
      expect(edge2?.source).toBe('delay-1');
      expect(edge2?.sourceHandle).toBe('out');
      expect(edge2?.target).toBe('comp-b');
      expect(edge2?.targetHandle).toBe('act:show');
    });
  });

  describe('公共结构契约', () => {
    it('所有模板 version=2', () => {
      const ids = [
        'click-navigate',
        'click-toggle-visibility',
        'page-load-refresh',
        'click-delay-show',
      ] as const;

      for (const id of ids) {
        const bp = createTemplateBlueprint(id);
        expect(bp.version).toBe(2);
      }
    });

    it('所有模板的起始节点都在 (0,0)', () => {
      const ids = [
        'click-navigate',
        'click-toggle-visibility',
        'page-load-refresh',
        'click-delay-show',
      ] as const;

      for (const id of ids) {
        const bp = createTemplateBlueprint(id);
        expect(bp.nodes[0]?.position).toEqual({ x: 0, y: 0 });
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
