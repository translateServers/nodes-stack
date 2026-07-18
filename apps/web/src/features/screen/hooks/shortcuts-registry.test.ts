import { describe, expect, it } from 'vitest';

import {
  SHORTCUTS_REGISTRY,
  formatKeys,
  validateRegistry,
  type ShortcutDefinition,
} from './shortcuts-registry';

describe('validateRegistry（防冲突校验）', () => {
  it('对 browserConflict=overridable + preventDefault=none 报警告', () => {
    const registry: ShortcutDefinition[] = [
      {
        id: 'test-conflict',
        keys: 'mod+s',
        description: 'test',
        category: 'file',
        scope: 'global',
        preventDefault: 'none',
        browserConflict: 'overridable',
      },
    ];
    const warnings = validateRegistry(registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('test-conflict');
    expect(warnings[0]).toContain("browserConflict='overridable'");
  });

  it('对 browserConflict=reserved 报警告', () => {
    const registry: ShortcutDefinition[] = [
      {
        id: 'test-reserved',
        keys: 'f5',
        description: 'test',
        category: 'file',
        scope: 'global',
        preventDefault: 'always',
        browserConflict: 'reserved',
      },
    ];
    const warnings = validateRegistry(registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('test-reserved');
    expect(warnings[0]).toContain("browserConflict='reserved'");
  });

  it('对合规条目不报警告', () => {
    const registry: ShortcutDefinition[] = [
      {
        id: 'test-ok-1',
        keys: 'mod+s',
        description: 'test',
        category: 'file',
        scope: 'global',
        preventDefault: 'always',
        browserConflict: 'overridable',
      },
      {
        id: 'test-ok-2',
        keys: 'v',
        description: 'test',
        category: 'tool',
        scope: 'canvas',
        preventDefault: 'none',
        browserConflict: 'none',
      },
      {
        id: 'test-ok-3',
        keys: 'mod+z',
        description: 'test',
        category: 'edit',
        scope: 'canvas',
        preventDefault: 'callback-only',
        browserConflict: 'overridable',
      },
    ];
    const warnings = validateRegistry(registry);
    expect(warnings).toHaveLength(0);
  });

  it('对空数组返回空警告', () => {
    expect(validateRegistry([])).toHaveLength(0);
  });

  it('同时报告多个违规条目', () => {
    const registry: ShortcutDefinition[] = [
      {
        id: 'bad-1',
        keys: 'mod+s',
        description: 'test',
        category: 'file',
        scope: 'global',
        preventDefault: 'none',
        browserConflict: 'overridable',
      },
      {
        id: 'bad-2',
        keys: 'f5',
        description: 'test',
        category: 'file',
        scope: 'global',
        preventDefault: 'always',
        browserConflict: 'reserved',
      },
    ];
    const warnings = validateRegistry(registry);
    expect(warnings).toHaveLength(2);
  });
});

describe('SHORTCUTS_REGISTRY 合规性（防冲突方法论）', () => {
  it('所有条目都有 preventDefault 与 browserConflict 字段', () => {
    for (const entry of SHORTCUTS_REGISTRY) {
      expect(entry.preventDefault).toBeDefined();
      expect(entry.browserConflict).toBeDefined();
    }
  });

  it('所有 browserConflict=overridable 条目都有 preventDefault !== none', () => {
    const overridableEntries = SHORTCUTS_REGISTRY.filter(
      (e) => e.browserConflict === 'overridable',
    );
    expect(overridableEntries.length).toBeGreaterThan(0);
    for (const entry of overridableEntries) {
      expect(entry.preventDefault).not.toBe('none');
    }
  });

  it('validateRegistry 对 SHORTCUTS_REGISTRY 返回空警告', () => {
    const warnings = validateRegistry(SHORTCUTS_REGISTRY);
    expect(warnings).toHaveLength(0);
  });

  it('zoomIn 有 mod+shift+equal 别名（兼容 Ctrl+Shift+=）', () => {
    const zoomIn = SHORTCUTS_REGISTRY.find((e) => e.id === 'zoomIn');
    expect(zoomIn).toBeDefined();
    expect(zoomIn?.aliases).toContain('mod+shift+equal');
  });

  it('符号快捷键使用 code 名（react-hotkeys-hook 5.x 用 e.code 匹配）', () => {
    const symbolEntries = [
      { id: 'zoomIn', expected: 'mod+equal' },
      { id: 'zoomOut', expected: 'mod+minus' },
      { id: 'toggleGuides', expected: 'mod+semicolon' },
      { id: 'bringToFront', expected: 'mod+bracketright' },
      { id: 'sendToBack', expected: 'mod+bracketleft' },
      { id: 'showHelp', expected: 'mod+slash' },
      { id: 'brushSizeDecrease', expected: 'bracketleft' },
      { id: 'brushSizeIncrease', expected: 'bracketright' },
    ];
    for (const { id, expected } of symbolEntries) {
      const entry = SHORTCUTS_REGISTRY.find((e) => e.id === id);
      expect(entry, `entry ${id} should exist`).toBeDefined();
      expect(entry?.keys, `entry ${id} should use code name`).toBe(expected);
    }
  });

  it('包含 4 个 noop Alt+方向键条目且 hidden=true', () => {
    const noopEntries = SHORTCUTS_REGISTRY.filter((e) => e.id.startsWith('noopAlt'));
    expect(noopEntries).toHaveLength(4);
    for (const entry of noopEntries) {
      expect(entry.hidden).toBe(true);
      expect(entry.preventDefault).toBe('callback-only');
      expect(entry.browserConflict).toBe('overridable');
    }
  });

  it('toggleUI 的 enableOnFormTags 为 false（保留 input Tab 焦点切换）', () => {
    const toggleUI = SHORTCUTS_REGISTRY.find((e) => e.id === 'toggleUI');
    expect(toggleUI).toBeDefined();
    expect(toggleUI?.enableOnFormTags).toBe(false);
  });
});

describe('formatKeys（code 名 → 可读字符映射）', () => {
  // 确保帮助面板对用户友好：code 名（equal/minus/bracketleft 等）应渲染为字面量符号
  it('mod+equal → [Ctrl, =]', () => {
    expect(formatKeys('mod+equal')).toContain('=');
  });

  it('mod+minus → [Ctrl, -]', () => {
    expect(formatKeys('mod+minus')).toContain('-');
  });

  it('mod+semicolon → [Ctrl, ;]', () => {
    expect(formatKeys('mod+semicolon')).toContain(';');
  });

  it('mod+bracketleft → [Ctrl, []', () => {
    expect(formatKeys('mod+bracketleft')).toContain('[');
  });

  it('mod+bracketright → [Ctrl, ]]', () => {
    expect(formatKeys('mod+bracketright')).toContain(']');
  });

  it('mod+slash → [Ctrl, /]', () => {
    expect(formatKeys('mod+slash')).toContain('/');
  });

  it('bracketleft（单键）→ [[]', () => {
    expect(formatKeys('bracketleft')).toEqual(['[']);
  });

  it('bracketright（单键）→ []]', () => {
    expect(formatKeys('bracketright')).toEqual([']']);
  });

  it('保留原有字面量快捷键不变（如 mod+s → [Ctrl, S]）', () => {
    const keys = formatKeys('mod+s');
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe('S');
  });
});
