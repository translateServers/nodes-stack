import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearRecentComponents,
  getRecentComponents,
  recordComponentUsage,
  type RecentComponentEntry,
} from './recent-components';

const STORAGE_KEY = 'nebula:recent-components';

/** localStorage 仅在 jsdom 环境下可用；预清空避免测试间干扰 */
function resetStorage() {
  window.localStorage.clear();
}

describe('registry · recent-components', () => {
  beforeEach(() => {
    resetStorage();
  });

  afterEach(() => {
    resetStorage();
  });

  describe('recordComponentUsage', () => {
    it('首次记录写入 count=1 与 lastUsedAt', () => {
      const t = 1_700_000_000_000;
      recordComponentUsage('text', t);
      const recent = getRecentComponents(10);
      expect(recent).toHaveLength(1);
      expect(recent[0]).toEqual({ type: 'text', count: 1, lastUsedAt: t });
    });

    it('重复记录 count 累加，lastUsedAt 更新为最新时间', () => {
      recordComponentUsage('text', 1000);
      recordComponentUsage('text', 2000);
      recordComponentUsage('text', 3000);
      const recent = getRecentComponents(10);
      expect(recent).toHaveLength(1);
      expect(recent[0]?.count).toBe(3);
      expect(recent[0]?.lastUsedAt).toBe(3000);
    });

    it('不同 type 各自独立计数', () => {
      recordComponentUsage('text', 1000);
      recordComponentUsage('bar-chart', 2000);
      recordComponentUsage('text', 3000);
      const recent = getRecentComponents(10);
      const byType = Object.fromEntries(recent.map((r) => [r.type, r]));
      expect(byType.text?.count).toBe(2);
      expect(byType['bar-chart']?.count).toBe(1);
    });

    it('默认 now = Date.now()', () => {
      const before = Date.now();
      recordComponentUsage('text');
      const after = Date.now();
      const recent = getRecentComponents(10);
      expect(recent[0]?.lastUsedAt).toBeGreaterThanOrEqual(before);
      expect(recent[0]?.lastUsedAt).toBeLessThanOrEqual(after);
    });

    it('超过 MAX_ENTRIES 时按 lastUsedAt 保留最新 20 条', () => {
      // 写入 25 条记录
      for (let i = 0; i < 25; i++) {
        recordComponentUsage(`type-${i}`, 1000 + i);
      }
      const recent = getRecentComponents(50);
      expect(recent).toHaveLength(20);
      // 应保留 type-5 ~ type-24（最近 20 条）
      const types = recent.map((r) => r.type);
      expect(types).toContain('type-24');
      expect(types).toContain('type-5');
      expect(types).not.toContain('type-4');
      expect(types).not.toContain('type-0');
    });
  });

  describe('getRecentComponents', () => {
    it('空存储返回空数组', () => {
      expect(getRecentComponents()).toEqual([]);
    });

    it('按 lastUsedAt 倒序排序', () => {
      recordComponentUsage('old', 1000);
      recordComponentUsage('newest', 5000);
      recordComponentUsage('middle', 3000);
      const recent = getRecentComponents(10);
      expect(recent.map((r) => r.type)).toEqual(['newest', 'middle', 'old']);
    });

    it('limit 参数限制返回数量', () => {
      recordComponentUsage('a', 1000);
      recordComponentUsage('b', 2000);
      recordComponentUsage('c', 3000);
      const recent = getRecentComponents(2);
      expect(recent).toHaveLength(2);
      expect(recent.map((r) => r.type)).toEqual(['c', 'b']);
    });

    it('默认 limit = 5', () => {
      for (let i = 0; i < 10; i++) {
        recordComponentUsage(`type-${i}`, 1000 + i);
      }
      const recent = getRecentComponents();
      expect(recent).toHaveLength(5);
    });
  });

  describe('clearRecentComponents', () => {
    it('清空后 getRecentComponents 返回空数组', () => {
      recordComponentUsage('text', 1000);
      recordComponentUsage('bar-chart', 2000);
      expect(getRecentComponents(10)).toHaveLength(2);

      clearRecentComponents();
      expect(getRecentComponents(10)).toEqual([]);
    });

    it('空存储调用清空不报错', () => {
      expect(() => clearRecentComponents()).not.toThrow();
    });
  });

  describe('存储健壮性', () => {
    it('损坏的 JSON 数据被静默忽略（返回空数组）', () => {
      window.localStorage.setItem(STORAGE_KEY, 'not-a-json');
      expect(getRecentComponents(10)).toEqual([]);
      // 写入新记录后应能恢复正常
      recordComponentUsage('text', 1000);
      expect(getRecentComponents(10)).toHaveLength(1);
    });

    it('非对象 JSON 被静默忽略', () => {
      window.localStorage.setItem(STORAGE_KEY, '[]');
      expect(getRecentComponents(10)).toEqual([]);
      window.localStorage.setItem(STORAGE_KEY, '"string"');
      expect(getRecentComponents(10)).toEqual([]);
      window.localStorage.setItem(STORAGE_KEY, 'null');
      expect(getRecentComponents(10)).toEqual([]);
    });
  });

  describe('RecentComponentEntry 类型契约', () => {
    it('entry 包含 type / count / lastUsedAt 三个字段', () => {
      recordComponentUsage('text', 12345);
      const entry: RecentComponentEntry | undefined = getRecentComponents(1)[0];
      expect(entry).toBeDefined();
      if (entry !== undefined) {
        expect(typeof entry.type).toBe('string');
        expect(typeof entry.count).toBe('number');
        expect(typeof entry.lastUsedAt).toBe('number');
      }
    });
  });
});
