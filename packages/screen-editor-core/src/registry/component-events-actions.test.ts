import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIONS,
  DEFAULT_EVENTS,
  DATASOURCE_ACTIONS,
  DATASOURCE_EVENTS,
  getComponentActions,
  getComponentEvents,
  mergeActions,
  mergeEvents,
} from '../registry';

describe('Component Events & Actions', () => {
  describe('DEFAULT_EVENTS', () => {
    it('包含 click 事件', () => {
      expect(DEFAULT_EVENTS.map((e) => e.id)).toContain('click');
    });

    it('包含 hover 事件', () => {
      expect(DEFAULT_EVENTS.map((e) => e.id)).toContain('hover');
    });
  });

  describe('DEFAULT_ACTIONS', () => {
    it('包含 show 动作', () => {
      expect(DEFAULT_ACTIONS.map((a) => a.id)).toContain('show');
    });

    it('包含 hide 动作', () => {
      expect(DEFAULT_ACTIONS.map((a) => a.id)).toContain('hide');
    });

    it('包含 toggleVisibility 动作', () => {
      expect(DEFAULT_ACTIONS.map((a) => a.id)).toContain('toggleVisibility');
    });
  });

  describe('mergeEvents', () => {
    it('不传额外事件时仅返回默认事件', () => {
      const result = mergeEvents();
      expect(result.map((e) => e.id)).toEqual(['click', 'hover']);
    });

    it('正确合并默认事件与额外事件', () => {
      const result = mergeEvents(DATASOURCE_EVENTS);
      expect(result.map((e) => e.id)).toEqual(['click', 'hover', 'dataLoaded', 'dataError']);
    });

    it('合并多组额外事件', () => {
      const result = mergeEvents([{ id: 'focus', name: '聚焦' }], [{ id: 'blur', name: '失焦' }]);
      expect(result.map((e) => e.id)).toEqual(['click', 'hover', 'focus', 'blur']);
    });
  });

  describe('mergeActions', () => {
    it('不传额外动作时仅返回默认动作', () => {
      const result = mergeActions();
      expect(result.map((a) => a.id)).toEqual(['show', 'hide', 'toggleVisibility']);
    });

    it('正确合并默认动作与额外动作', () => {
      const result = mergeActions(DATASOURCE_ACTIONS);
      expect(result.map((a) => a.id)).toEqual(['show', 'hide', 'toggleVisibility', 'refreshData']);
    });
  });

  describe('getComponentEvents', () => {
    it('bar-chart 返回默认事件 + 数据源事件', () => {
      const result = getComponentEvents('bar-chart');
      expect(result.map((e) => e.id)).toEqual(['click', 'hover', 'dataLoaded', 'dataError']);
    });

    it('text 返回默认事件', () => {
      const result = getComponentEvents('text');
      expect(result.map((e) => e.id)).toEqual(['click', 'hover']);
    });

    it('unknown 组件回退到默认事件', () => {
      const result = getComponentEvents('unknown');
      expect(result.map((e) => e.id)).toEqual(['click', 'hover']);
    });
  });

  describe('getComponentActions', () => {
    it('bar-chart 返回默认动作 + 数据源动作', () => {
      const result = getComponentActions('bar-chart');
      expect(result.map((a) => a.id)).toEqual(['show', 'hide', 'toggleVisibility', 'refreshData']);
    });

    it('unknown 组件回退到默认动作', () => {
      const result = getComponentActions('unknown');
      expect(result.map((a) => a.id)).toEqual(['show', 'hide', 'toggleVisibility']);
    });
  });
});
