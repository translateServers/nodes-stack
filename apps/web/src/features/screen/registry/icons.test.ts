import { describe, expect, it } from 'vitest';
import { Box, Circle, Frame, Image, Minus, Square, Table, Type, BarChart3 } from 'lucide-react';
import { DEFAULT_ICON, getIconByName, getIconForType, ICON_MAP, KNOWN_TYPE_TO_ICON } from './icons';

describe('registry · icons', () => {
  describe('ICON_MAP 单一映射源', () => {
    it('包含全部已注册组件的图标', () => {
      // 名称 → 组件映射必须覆盖所有已注册类型
      expect(ICON_MAP.Type).toBe(Type);
      expect(ICON_MAP.BarChart3).toBe(BarChart3);
      expect(ICON_MAP.Image).toBe(Image);
      expect(ICON_MAP.Frame).toBe(Frame);
      expect(ICON_MAP.Table).toBe(Table);
      expect(ICON_MAP.Box).toBe(Box);
      expect(ICON_MAP.Square).toBe(Square);
      expect(ICON_MAP.Circle).toBe(Circle);
      expect(ICON_MAP.Minus).toBe(Minus);
    });

    it('所有 value 均为有效的 lucide 组件（含 displayName / render 函数）', () => {
      for (const value of Object.values(ICON_MAP)) {
        expect(typeof value).toBe('object');
        // ForwardRefExoticComponent 必有 $$typeof 与 render 函数
        expect(value).toHaveProperty('$$typeof');
        expect(value).toHaveProperty('render');
      }
    });
  });

  describe('KNOWN_TYPE_TO_ICON 组件类型回退映射', () => {
    it('text → Type, bar-chart → BarChart3, rect → Square, ellipse → Circle, image → Image', () => {
      expect(KNOWN_TYPE_TO_ICON.text).toBe('Type');
      expect(KNOWN_TYPE_TO_ICON['bar-chart']).toBe('BarChart3');
      expect(KNOWN_TYPE_TO_ICON.rect).toBe('Square');
      expect(KNOWN_TYPE_TO_ICON.ellipse).toBe('Circle');
      expect(KNOWN_TYPE_TO_ICON.image).toBe('Image');
    });

    it('所有 value 在 ICON_MAP 中有对应图标（无悬挂引用）', () => {
      for (const iconName of Object.values(KNOWN_TYPE_TO_ICON)) {
        expect(ICON_MAP[iconName]).toBeDefined();
      }
    });
  });

  describe('DEFAULT_ICON', () => {
    it('默认兜底图标为 Box', () => {
      expect(DEFAULT_ICON).toBe(Box);
    });
  });

  describe('getIconForType', () => {
    it('已知 type 返回对应的图标组件', () => {
      expect(getIconForType('text')).toBe(Type);
      expect(getIconForType('bar-chart')).toBe(BarChart3);
      expect(getIconForType('rect')).toBe(Square);
      expect(getIconForType('ellipse')).toBe(Circle);
      expect(getIconForType('image')).toBe(Image);
    });

    it('未知 type 回退到 Box', () => {
      expect(getIconForType('unknown-type')).toBe(Box);
      expect(getIconForType('')).toBe(Box);
      expect(getIconForType('shape')).toBe(Box);
    });
  });

  describe('getIconByName', () => {
    it('已知图标名返回对应组件', () => {
      expect(getIconByName('Type')).toBe(Type);
      expect(getIconByName('BarChart3')).toBe(BarChart3);
      expect(getIconByName('Box')).toBe(Box);
    });

    it('undefined 图标名回退到 DEFAULT_ICON', () => {
      expect(getIconByName(undefined)).toBe(DEFAULT_ICON);
    });

    it('未注册的图标名回退到 DEFAULT_ICON', () => {
      expect(getIconByName('NonExistentIcon')).toBe(DEFAULT_ICON);
      expect(getIconByName('')).toBe(DEFAULT_ICON);
    });
  });

  describe('与 COMPONENT_DEFINITIONS 的一致性', () => {
    it('所有 definition.icon 都能在 ICON_MAP 中找到（或为 undefined 走兜底）', async () => {
      const { COMPONENT_DEFINITIONS } = await import('./index');
      for (const def of COMPONENT_DEFINITIONS) {
        if (def.icon !== undefined) {
          expect(ICON_MAP[def.icon]).toBeDefined();
        }
      }
    });
  });
});
