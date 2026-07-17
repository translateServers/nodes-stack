import { describe, expect, it } from 'vitest';

import { buildHotkeysOptions } from './use-keyboard-shortcuts';
import type { ShortcutDefinition } from './shortcuts-registry';

/** 构造一个最小可用 entry 的工厂函数 */
function makeEntry(overrides: Partial<ShortcutDefinition> = {}): ShortcutDefinition {
  return {
    id: 'test',
    keys: 'mod+s',
    description: 'test',
    category: 'file',
    scope: 'global',
    preventDefault: 'always',
    browserConflict: 'overridable',
    ...overrides,
  };
}

describe('buildHotkeysOptions（统一生成 useHotkeys 选项）', () => {
  describe('preventDefault 映射', () => {
    it("preventDefault='always' → preventDefault: true", () => {
      const options = buildHotkeysOptions(makeEntry({ preventDefault: 'always' }), true);
      expect(options.preventDefault).toBe(true);
    });

    it("preventDefault='callback-only' → preventDefault: false", () => {
      const options = buildHotkeysOptions(makeEntry({ preventDefault: 'callback-only' }), true);
      expect(options.preventDefault).toBe(false);
    });

    it("preventDefault='none' → preventDefault: false", () => {
      const options = buildHotkeysOptions(makeEntry({ preventDefault: 'none' }), true);
      expect(options.preventDefault).toBe(false);
    });
  });

  describe('enableOnFormTags 推断', () => {
    it("scope='global' 且未声明 enableOnFormTags → 默认 true", () => {
      const options = buildHotkeysOptions(
        makeEntry({ scope: 'global', enableOnFormTags: undefined }),
        true,
      );
      expect(options.enableOnFormTags).toBe(true);
    });

    it("scope='canvas' 且未声明 enableOnFormTags → 默认 false", () => {
      const options = buildHotkeysOptions(
        makeEntry({ scope: 'canvas', enableOnFormTags: undefined }),
        true,
      );
      expect(options.enableOnFormTags).toBe(false);
    });

    it('显式声明 enableOnFormTags=true 时优先使用显式值', () => {
      const options = buildHotkeysOptions(
        makeEntry({ scope: 'canvas', enableOnFormTags: true }),
        true,
      );
      expect(options.enableOnFormTags).toBe(true);
    });

    it('显式声明 enableOnFormTags=false 时优先使用显式值', () => {
      const options = buildHotkeysOptions(
        makeEntry({ scope: 'global', enableOnFormTags: false }),
        true,
      );
      expect(options.enableOnFormTags).toBe(false);
    });
  });

  describe('enabled 传递', () => {
    it('布尔值 enabled 正确传递', () => {
      const options = buildHotkeysOptions(makeEntry(), true);
      expect(options.enabled).toBe(true);
    });

    it('函数 enabled 正确传递（用于 canvasEnabled 等动态判断）', () => {
      const canvasEnabled = () => false;
      const options = buildHotkeysOptions(makeEntry(), canvasEnabled);
      expect(options.enabled).toBe(canvasEnabled);
    });
  });
});
