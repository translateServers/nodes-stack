/**
 * getNodeLabel 纯函数测试（任务 9.2 标签跟随）
 *
 * 验证点：
 * - trigger.componentClick：显示"点击：<componentName>"
 * - trigger.pageLoad：显示"页面加载"
 * - action.setVisibility：显示"显示/隐藏：<componentName>"
 * - action.scrollToComponent：显示"滚动至：<componentName>"
 * - action.refreshDataSource：显示"刷新数据：<componentName>"
 * - action.navigate：显示"跳转：<url>"
 * - comment：显示 config.text
 * - 未配置 componentId：显示"未配置"
 * - **标签跟随**：组件重命名后 label 实时跟随（同节点 config，不同 components 产生不同 label）
 * - dangling 引用（componentId 在 components 中不存在）：回退为 componentId
 */

import { describe, expect, it } from 'vitest';
import { getNodeLabel } from './blueprint-sheet';
import type { ScreenComponent } from '@nebula/shared';

function makeComponent(id: string, name: string): ScreenComponent {
  return {
    id,
    type: 'rect',
    name,
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    props: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
  };
}

describe('getNodeLabel（任务 9.2 标签跟随）', () => {
  describe('trigger 节点', () => {
    it('componentClick：显示"点击：<componentName>"', () => {
      const components = [makeComponent('c1', '按钮 A')];
      const label = getNodeLabel(
        'trigger',
        { type: 'componentClick', componentId: 'c1' },
        components,
      );
      expect(label).toBe('点击：按钮 A');
    });

    it('pageLoad：显示"页面加载"', () => {
      const label = getNodeLabel('trigger', { type: 'pageLoad' }, []);
      expect(label).toBe('页面加载');
    });

    it('componentId 未配置（空字符串）：显示"点击：未配置"', () => {
      const label = getNodeLabel('trigger', { type: 'componentClick', componentId: '' }, []);
      expect(label).toBe('点击：未配置');
    });

    it('dangling 引用（componentId 不存在）：回退为 componentId', () => {
      const label = getNodeLabel('trigger', { type: 'componentClick', componentId: 'missing-id' }, [
        makeComponent('other', '其他'),
      ]);
      expect(label).toBe('点击：missing-id');
    });
  });

  describe('action 节点', () => {
    it('setVisibility show：显示"显示：<componentName>"', () => {
      const components = [makeComponent('c1', '图表')];
      const label = getNodeLabel(
        'action',
        { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' },
        components,
      );
      expect(label).toBe('显示：图表');
    });

    it('setVisibility hide：显示"隐藏：<componentName>"', () => {
      const components = [makeComponent('c1', '图表')];
      const label = getNodeLabel(
        'action',
        { type: 'setVisibility', targetComponentId: 'c1', visible: 'hide' },
        components,
      );
      expect(label).toBe('隐藏：图表');
    });

    it('scrollToComponent：显示"滚动至：<componentName>"', () => {
      const components = [makeComponent('c1', '目标区块')];
      const label = getNodeLabel(
        'action',
        { type: 'scrollToComponent', targetComponentId: 'c1' },
        components,
      );
      expect(label).toBe('滚动至：目标区块');
    });

    it('refreshDataSource：显示"刷新数据：<componentName>"', () => {
      const components = [makeComponent('c1', '数据源')];
      const label = getNodeLabel(
        'action',
        { type: 'refreshDataSource', targetComponentId: 'c1' },
        components,
      );
      expect(label).toBe('刷新数据：数据源');
    });

    it('navigate：显示"跳转：<url>"', () => {
      const label = getNodeLabel(
        'action',
        { type: 'navigate', url: 'https://example.com', target: '_blank' },
        [],
      );
      expect(label).toBe('跳转：https://example.com');
    });

    it('navigate 空 url：显示"跳转：未设置"', () => {
      const label = getNodeLabel('action', { type: 'navigate', url: '', target: '_blank' }, []);
      expect(label).toBe('跳转：未设置');
    });

    it('targetComponentId 未配置（空字符串）：显示"显示：未配置"', () => {
      const label = getNodeLabel(
        'action',
        { type: 'setVisibility', targetComponentId: '', visible: 'show' },
        [],
      );
      expect(label).toBe('显示：未配置');
    });
  });

  describe('comment 节点', () => {
    it('comment：显示 config.text', () => {
      const label = getNodeLabel('comment', { text: '一段注释' }, []);
      expect(label).toBe('一段注释');
    });

    it('comment 空 text：显示"注释"', () => {
      const label = getNodeLabel('comment', { text: '' }, []);
      expect(label).toBe('注释');
    });
  });

  describe('标签跟随（任务 9.2 核心）', () => {
    it('组件重命名后 label 实时跟随：同节点 config，不同 components 产生不同 label', () => {
      const config = { type: 'componentClick', componentId: 'c1' };

      // 初始：组件名 "按钮 A"
      const componentsBefore = [makeComponent('c1', '按钮 A')];
      const labelBefore = getNodeLabel('trigger', config, componentsBefore);
      expect(labelBefore).toBe('点击：按钮 A');

      // 重命名后：组件名 "提交按钮"
      const componentsAfter = [makeComponent('c1', '提交按钮')];
      const labelAfter = getNodeLabel('trigger', config, componentsAfter);
      expect(labelAfter).toBe('点击：提交按钮');

      // config 未变，仅 components 引用变化即产生不同 label
      expect(labelBefore).not.toBe(labelAfter);
    });

    it('action 节点标签跟随组件重命名', () => {
      const config = { type: 'setVisibility', targetComponentId: 'c1', visible: 'show' };

      // 初始：组件名 "原始名"
      const labelBefore = getNodeLabel('action', config, [makeComponent('c1', '原始名')]);
      expect(labelBefore).toBe('显示：原始名');

      // 重命名后：组件名 "重命名后"
      const labelAfter = getNodeLabel('action', config, [makeComponent('c1', '重命名后')]);
      expect(labelAfter).toBe('显示：重命名后');

      // config 未变，仅 components 引用变化即产生不同 label
      expect(labelBefore).not.toBe(labelAfter);
    });

    it('多组件同时存在时正确匹配目标组件名', () => {
      const components = [
        makeComponent('c1', '按钮 A'),
        makeComponent('c2', '图表 B'),
        makeComponent('c3', '文本 C'),
      ];

      const label = getNodeLabel(
        'action',
        { type: 'refreshDataSource', targetComponentId: 'c2' },
        components,
      );

      // 从多组件中正确匹配 c2 的名称
      expect(label).toBe('刷新数据：图表 B');
    });

    it('同一组件被多个节点引用时标签都正确跟随', () => {
      const components = [makeComponent('shared', '共享组件')];

      // trigger 节点引用 shared
      const triggerLabel = getNodeLabel(
        'trigger',
        { type: 'componentClick', componentId: 'shared' },
        components,
      );
      expect(triggerLabel).toBe('点击：共享组件');

      // action 节点引用 shared
      const actionLabel = getNodeLabel(
        'action',
        { type: 'setVisibility', targetComponentId: 'shared', visible: 'hide' },
        components,
      );
      expect(actionLabel).toBe('隐藏：共享组件');

      // 重命名后两个节点标签都跟随
      const componentsRenamed = [makeComponent('shared', '共享组件（已重命名）')];
      const triggerLabelRenamed = getNodeLabel(
        'trigger',
        { type: 'componentClick', componentId: 'shared' },
        componentsRenamed,
      );
      const actionLabelRenamed = getNodeLabel(
        'action',
        { type: 'setVisibility', targetComponentId: 'shared', visible: 'hide' },
        componentsRenamed,
      );

      expect(triggerLabelRenamed).toBe('点击：共享组件（已重命名）');
      expect(actionLabelRenamed).toBe('隐藏：共享组件（已重命名）');
    });
  });
});
