import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setFavoritesForTest,
  clearFavorites,
  getFavoriteComponents,
  isFavorite,
  toggleFavorite,
  type FavoriteEntry,
} from './favorite-components';

const STORAGE_KEY = 'nebula:screen-sdk:v1:favorite-components';
const UPDATED_EVENT = 'nebula:screen-sdk:v1:favorite-components:updated';

/** localStorage 仅在 jsdom 环境下可用；预清空避免测试间干扰 */
function resetStorage() {
  window.localStorage.clear();
}

describe('registry · favorite-components', () => {
  beforeEach(() => {
    resetStorage();
  });

  afterEach(() => {
    resetStorage();
    vi.restoreAllMocks();
  });

  describe('toggleFavorite', () => {
    it('添加新收藏：写入 localStorage 并派发事件', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const t = 1_700_000_000_000;

      toggleFavorite('text', t);

      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? '{}') as Record<string, FavoriteEntry>;
      expect(parsed.text).toEqual({ type: 'text', favoritedAt: t });

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(CustomEvent);
      expect((event as CustomEvent).type).toBe(UPDATED_EVENT);
    });

    it('取消已有收藏：从 localStorage 移除并派发事件', () => {
      __setFavoritesForTest({ text: { type: 'text', favoritedAt: 1000 } });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      toggleFavorite('text');

      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? '{}') as Record<string, FavoriteEntry>;
      expect(parsed.text).toBeUndefined();

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(CustomEvent);
      expect((event as CustomEvent).type).toBe(UPDATED_EVENT);
    });

    it('切换多次后状态在收藏 / 未收藏间交替', () => {
      toggleFavorite('text', 1000);
      expect(isFavorite('text')).toBe(true);
      toggleFavorite('text', 2000);
      expect(isFavorite('text')).toBe(false);
      toggleFavorite('text', 3000);
      expect(isFavorite('text')).toBe(true);
    });

    it('默认 now = Date.now()', () => {
      const before = Date.now();
      toggleFavorite('text');
      const after = Date.now();
      const favorites = getFavoriteComponents();
      expect(favorites[0]?.favoritedAt).toBeGreaterThanOrEqual(before);
      expect(favorites[0]?.favoritedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('isFavorite', () => {
    it('已收藏返回 true', () => {
      __setFavoritesForTest({ text: { type: 'text', favoritedAt: 1000 } });
      expect(isFavorite('text')).toBe(true);
    });

    it('未收藏返回 false', () => {
      expect(isFavorite('text')).toBe(false);
      __setFavoritesForTest({ text: { type: 'text', favoritedAt: 1000 } });
      expect(isFavorite('bar-chart')).toBe(false);
    });
  });

  describe('getFavoriteComponents', () => {
    it('空存储返回空数组', () => {
      expect(getFavoriteComponents()).toEqual([]);
    });

    it('按 favoritedAt 倒序排序（最近收藏在前）', () => {
      __setFavoritesForTest({
        old: { type: 'old', favoritedAt: 1000 },
        newest: { type: 'newest', favoritedAt: 5000 },
        middle: { type: 'middle', favoritedAt: 3000 },
      });
      const favorites = getFavoriteComponents();
      expect(favorites.map((f) => f.type)).toEqual(['newest', 'middle', 'old']);
    });
  });

  describe('clearFavorites', () => {
    it('清空 localStorage 并派发事件', () => {
      __setFavoritesForTest({
        text: { type: 'text', favoritedAt: 1000 },
        'bar-chart': { type: 'bar-chart', favoritedAt: 2000 },
      });
      expect(getFavoriteComponents()).toHaveLength(2);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      clearFavorites();

      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(getFavoriteComponents()).toEqual([]);

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(CustomEvent);
      expect((event as CustomEvent).type).toBe(UPDATED_EVENT);
    });

    it('空存储调用清空不报错', () => {
      expect(() => clearFavorites()).not.toThrow();
    });
  });

  describe('存储健壮性', () => {
    it('损坏的 JSON 数据被清空并返回空数组', () => {
      window.localStorage.setItem(STORAGE_KEY, 'not-a-json');
      expect(getFavoriteComponents()).toEqual([]);
      // 损坏数据应被清空
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('非对象 JSON 被静默忽略（返回空数组）', () => {
      window.localStorage.setItem(STORAGE_KEY, '[]');
      expect(getFavoriteComponents()).toEqual([]);
      window.localStorage.setItem(STORAGE_KEY, '"string"');
      expect(getFavoriteComponents()).toEqual([]);
      window.localStorage.setItem(STORAGE_KEY, 'null');
      expect(getFavoriteComponents()).toEqual([]);
    });

    it('损坏数据后写入新收藏能恢复正常', () => {
      window.localStorage.setItem(STORAGE_KEY, 'not-a-json');
      toggleFavorite('text', 1000);
      expect(getFavoriteComponents()).toHaveLength(1);
    });
  });

  describe('__setFavoritesForTest', () => {
    it('直接覆写存储内容', () => {
      const entries: Record<string, FavoriteEntry> = {
        text: { type: 'text', favoritedAt: 1000 },
        'bar-chart': { type: 'bar-chart', favoritedAt: 2000 },
      };
      __setFavoritesForTest(entries);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? '{}') as Record<string, FavoriteEntry>;
      expect(parsed).toEqual(entries);
    });

    it('空对象写入空映射', () => {
      __setFavoritesForTest({ text: { type: 'text', favoritedAt: 1000 } });
      __setFavoritesForTest({});
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).toBe('{}');
    });
  });

  describe('FavoriteEntry 类型契约', () => {
    it('entry 包含 type / favoritedAt 两个字段', () => {
      toggleFavorite('text', 12345);
      const entry: FavoriteEntry | undefined = getFavoriteComponents()[0];
      expect(entry).toBeDefined();
      if (entry !== undefined) {
        expect(typeof entry.type).toBe('string');
        expect(typeof entry.favoritedAt).toBe('number');
      }
    });
  });
});
