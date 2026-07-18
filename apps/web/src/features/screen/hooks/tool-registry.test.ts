import { describe, it, expect } from 'vitest';
import {
  TOOL_REGISTRY,
  getToolById,
  getImplementedTools,
  hasCapability,
  type EditorTool,
  type ToolCapabilities,
} from './tool-registry';
import { SHORTCUTS_REGISTRY, getShortcutById } from './shortcuts-registry';

describe('tool-registry', () => {
  describe('工具 ID 唯一性', () => {
    it('所有工具 ID 不重复', () => {
      const ids = TOOL_REGISTRY.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('注册表包含 8 种工具', () => {
      expect(TOOL_REGISTRY).toHaveLength(8);
    });

    it('包含所有预期工具 ID', () => {
      const expectedIds: EditorTool[] = [
        'select',
        'hand',
        'text',
        'rect',
        'ellipse',
        'image',
        'zoom',
        'eyedropper',
      ];
      const actualIds = TOOL_REGISTRY.map((t) => t.id);
      expect(actualIds.sort()).toEqual(expectedIds.sort());
    });
  });

  describe('必需字段', () => {
    it('每个工具都有名称', () => {
      for (const tool of TOOL_REGISTRY) {
        expect(tool.name).toBeTruthy();
        expect(typeof tool.name).toBe('string');
      }
    });

    it('每个工具都有图标组件', () => {
      for (const tool of TOOL_REGISTRY) {
        // lucide-react 图标是 ForwardRefExoticComponent，typeof 为 'object'
        expect(tool.icon).toBeDefined();
        expect(typeof tool.icon === 'object' || typeof tool.icon === 'function').toBe(true);
        // $$typeof 标记确保是合法的 React 组件
        expect((tool.icon as { $$typeof?: symbol }).$$typeof).toBeDefined();
      }
    });

    it('每个工具都有 cursor 值', () => {
      for (const tool of TOOL_REGISTRY) {
        expect(tool.cursor).toBeTruthy();
        expect(typeof tool.cursor).toBe('string');
      }
    });

    it('每个工具都有完整的能力定义', () => {
      const capabilityKeys: (keyof ToolCapabilities)[] = [
        'canSelect',
        'canDrag',
        'canResize',
        'canRotate',
        'canPan',
        'canCreate',
        'canSample',
        'canZoom',
      ];
      for (const tool of TOOL_REGISTRY) {
        for (const key of capabilityKeys) {
          expect(tool.capabilities).toHaveProperty(key);
          expect(typeof tool.capabilities[key]).toBe('boolean');
        }
      }
    });

    it('每个工具都有 implemented 标志', () => {
      for (const tool of TOOL_REGISTRY) {
        expect(typeof tool.implemented).toBe('boolean');
      }
    });
  });

  describe('shortcutId 引用完整性', () => {
    it('非空 shortcutId 均引用有效的 SHORTCUTS_REGISTRY 条目', () => {
      for (const tool of TOOL_REGISTRY) {
        if (tool.shortcutId !== null) {
          const shortcut = getShortcutById(tool.shortcutId);
          expect(
            shortcut,
            `工具 ${tool.id} 的 shortcutId "${tool.shortcutId}" 在 SHORTCUTS_REGISTRY 中不存在`,
          ).toBeDefined();
        }
      }
    });

    it('shortcutId 不重复引用同一快捷键条目', () => {
      const shortcutIds = TOOL_REGISTRY.map((t) => t.shortcutId).filter(
        (id): id is string => id !== null,
      );
      const uniqueIds = new Set(shortcutIds);
      expect(uniqueIds.size).toBe(shortcutIds.length);
    });

    it('快捷键条目的键位不重复', () => {
      const toolShortcutIds = TOOL_REGISTRY.map((t) => t.shortcutId).filter(
        (id): id is string => id !== null,
      );
      const keys = toolShortcutIds.map((id) => getShortcutById(id)!.keys);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('吸管工具没有快捷键（shortcutId 为 null）', () => {
      const eyedropper = getToolById('eyedropper');
      expect(eyedropper?.shortcutId).toBeNull();
    });
  });

  describe('工具能力一致性', () => {
    it('选择工具拥有全部编辑能力', () => {
      const select = getToolById('select');
      expect(select?.capabilities.canSelect).toBe(true);
      expect(select?.capabilities.canDrag).toBe(true);
      expect(select?.capabilities.canResize).toBe(true);
      expect(select?.capabilities.canRotate).toBe(true);
    });

    it('选择工具不能平移、创建、采样或缩放', () => {
      const select = getToolById('select');
      expect(select?.capabilities.canPan).toBe(false);
      expect(select?.capabilities.canCreate).toBe(false);
      expect(select?.capabilities.canSample).toBe(false);
      expect(select?.capabilities.canZoom).toBe(false);
    });

    it('抓手工具只能平移', () => {
      const hand = getToolById('hand');
      expect(hand?.capabilities.canPan).toBe(true);
      expect(hand?.capabilities.canSelect).toBe(false);
      expect(hand?.capabilities.canDrag).toBe(false);
      expect(hand?.capabilities.canCreate).toBe(false);
    });

    it('创建型工具（文字、矩形、椭圆、图片）只能创建', () => {
      const createTools: EditorTool[] = ['text', 'rect', 'ellipse', 'image'];
      for (const id of createTools) {
        const tool = getToolById(id);
        expect(tool?.capabilities.canCreate).toBe(true);
        expect(tool?.capabilities.canSelect).toBe(false);
        expect(tool?.capabilities.canDrag).toBe(false);
        expect(tool?.capabilities.canPan).toBe(false);
      }
    });

    it('缩放工具只能缩放视口', () => {
      const zoom = getToolById('zoom');
      expect(zoom?.capabilities.canZoom).toBe(true);
      expect(zoom?.capabilities.canSelect).toBe(false);
      expect(zoom?.capabilities.canDrag).toBe(false);
      expect(zoom?.capabilities.canCreate).toBe(false);
    });

    it('吸管工具只能采样', () => {
      const eyedropper = getToolById('eyedropper');
      expect(eyedropper?.capabilities.canSample).toBe(true);
      expect(eyedropper?.capabilities.canSelect).toBe(false);
      expect(eyedropper?.capabilities.canDrag).toBe(false);
      expect(eyedropper?.capabilities.canCreate).toBe(false);
    });
  });

  describe('实现状态', () => {
    it('选择工具已标记为实现', () => {
      const select = getToolById('select');
      expect(select?.implemented).toBe(true);
    });

    it('阶段 1 完成后所有工具均标记为实现', () => {
      // 阶段 1 闭环后，TOOL_REGISTRY 中所有工具均 implemented=true。
      // 后续阶段若新增未实现工具，可重新引入"未实现工具"测试。
      const unimplementedTools = TOOL_REGISTRY.filter((t) => !t.implemented);
      expect(unimplementedTools).toEqual([]);
    });

    it('getImplementedTools 返回全部工具', () => {
      const implemented = getImplementedTools();
      for (const tool of implemented) {
        expect(tool.implemented).toBe(true);
      }
      expect(implemented.length).toBe(TOOL_REGISTRY.length);
    });
  });

  describe('查询函数', () => {
    it('getToolById 返回正确的工具定义', () => {
      const hand = getToolById('hand');
      expect(hand?.id).toBe('hand');
      expect(hand?.name).toBe('抓手');
    });

    it('getToolById 对不存在的 ID 返回 undefined', () => {
      const result = getToolById('nonexistent' as EditorTool);
      expect(result).toBeUndefined();
    });

    it('hasCapability 返回正确的能力值', () => {
      expect(hasCapability('select', 'canDrag')).toBe(true);
      expect(hasCapability('hand', 'canPan')).toBe(true);
      expect(hasCapability('hand', 'canDrag')).toBe(false);
      expect(hasCapability('zoom', 'canZoom')).toBe(true);
      expect(hasCapability('eyedropper', 'canSample')).toBe(true);
      expect(hasCapability('select', 'canPan')).toBe(false);
    });

    it('hasCapability 对不存在的工具返回 false', () => {
      expect(hasCapability('nonexistent' as EditorTool, 'canDrag')).toBe(false);
    });
  });

  describe('与 SHORTCUTS_REGISTRY 的一致性', () => {
    it('SHORTCUTS_REGISTRY 中不存在 eyedropperTemp 条目', () => {
      const result = SHORTCUTS_REGISTRY.find((s) => s.id === 'eyedropperTemp');
      expect(result).toBeUndefined();
    });

    it('SHORTCUTS_REGISTRY 中存在所有工具切换快捷键', () => {
      const expectedShortcutIds = [
        'toolSelect',
        'toolHand',
        'toolText',
        'toolRect',
        'toolEllipse',
        'toolImage',
        'toolZoom',
      ];
      for (const id of expectedShortcutIds) {
        const shortcut = getShortcutById(id);
        expect(shortcut, `快捷键 ${id} 不存在`).toBeDefined();
        expect(shortcut?.category).toBe('tool');
      }
    });
  });
});
