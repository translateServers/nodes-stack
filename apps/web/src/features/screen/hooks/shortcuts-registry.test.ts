import { describe, expect, it } from 'vitest';

import {
  SHORTCUTS_REGISTRY,
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

  it('zoomIn 有 mod+shift+= 别名', () => {
    const zoomIn = SHORTCUTS_REGISTRY.find((e) => e.id === 'zoomIn');
    expect(zoomIn).toBeDefined();
    expect(zoomIn?.aliases).toContain('mod+shift+=');
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
