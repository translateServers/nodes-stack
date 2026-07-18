import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPersistedState, clearPersistedState } from './state-persistence';
import type { StatePersistenceConfig } from '../types';

// ── localStorage mock（jsdom 提供但我们要追踪调用）────────────
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(localStorageStore)) {
      delete localStorageStore[key];
    }
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

function setUrl(search: string): void {
  window.history.replaceState(null, '', search ? `/${search}` : '/');
}

describe('loadPersistedState', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    setUrl('');
  });

  describe('config 缺失', () => {
    it('config 为 undefined 时返回空对象', () => {
      expect(loadPersistedState(undefined)).toEqual({});
    });
  });

  describe('localStorage 存储', () => {
    const config: StatePersistenceConfig = {
      storage: 'localStorage',
      key: 'table-state',
    };

    it('读取并解析完整状态', () => {
      const state = {
        sorting: [{ id: 'name', desc: true }],
        columnVisibility: { name: true },
        columnSizing: { name: 100 },
        columnOrder: ['name', 'age'],
        pagination: { pageIndex: 1, pageSize: 20 },
      };
      localStorageMock.setItem('table-state', JSON.stringify(state));

      const result = loadPersistedState(config);

      expect(result.sorting).toEqual(state.sorting);
      expect(result.columnVisibility).toEqual(state.columnVisibility);
      expect(result.columnSizing).toEqual(state.columnSizing);
      expect(result.columnOrder).toEqual(state.columnOrder);
      expect(result.pagination).toEqual(state.pagination);
    });

    it('key 不存在时返回空对象', () => {
      expect(loadPersistedState(config)).toEqual({});
    });

    it('JSON 解析失败时返回空对象（容错降级）', () => {
      localStorageMock.setItem('table-state', 'not-json');
      expect(loadPersistedState(config)).toEqual({});
    });

    it('include 限制只返回指定切片', () => {
      const state = {
        sorting: [{ id: 'name', desc: true }],
        columnVisibility: { name: false },
        columnSizing: { name: 200 },
        columnOrder: ['name'],
        pagination: { pageIndex: 0, pageSize: 10 },
      };
      localStorageMock.setItem('table-state', JSON.stringify(state));

      const result = loadPersistedState({
        ...config,
        include: ['sorting', 'pagination'],
      });

      expect(result.sorting).toEqual(state.sorting);
      expect(result.pagination).toEqual(state.pagination);
      expect(result).not.toHaveProperty('columnVisibility');
      expect(result).not.toHaveProperty('columnSizing');
      expect(result).not.toHaveProperty('columnOrder');
    });

    it('include 排除切片时不返回该切片（即使存储中存在）', () => {
      const state = {
        sorting: [{ id: 'name', desc: true }],
        pagination: { pageIndex: 0, pageSize: 10 },
      };
      localStorageMock.setItem('table-state', JSON.stringify(state));

      const result = loadPersistedState({
        ...config,
        include: ['sorting'],
      });

      expect(result.sorting).toBeDefined();
      expect(result).not.toHaveProperty('pagination');
    });

    it('存储中只包含部分切片时只返回存在的切片', () => {
      const state = { sorting: [{ id: 'name', desc: true }] };
      localStorageMock.setItem('table-state', JSON.stringify(state));

      const result = loadPersistedState(config);

      expect(result.sorting).toEqual(state.sorting);
      expect(result).not.toHaveProperty('columnVisibility');
      expect(result).not.toHaveProperty('pagination');
    });

    it('默认 include 包含全部 5 个切片', () => {
      const state = {
        sorting: [],
        columnVisibility: {},
        columnSizing: {},
        columnOrder: [],
        pagination: { pageIndex: 0, pageSize: 10 },
      };
      localStorageMock.setItem('table-state', JSON.stringify(state));

      const result = loadPersistedState(config);

      expect(result).toHaveProperty('sorting');
      expect(result).toHaveProperty('columnVisibility');
      expect(result).toHaveProperty('columnSizing');
      expect(result).toHaveProperty('columnOrder');
      expect(result).toHaveProperty('pagination');
    });
  });

  describe('URL 存储', () => {
    const config: StatePersistenceConfig = {
      storage: 'url',
      key: 't',
    };

    it('从 URLSearchParams 读取并解析状态', () => {
      const state = { pagination: { pageIndex: 2, pageSize: 50 } };
      setUrl(`?t=${encodeURIComponent(JSON.stringify(state))}`);

      const result = loadPersistedState(config);

      expect(result.pagination).toEqual(state.pagination);
    });

    it('URL 中无 key 时返回空对象', () => {
      setUrl('');
      expect(loadPersistedState(config)).toEqual({});
    });

    it('URL 中 JSON 解析失败时返回空对象（容错降级）', () => {
      setUrl('?t=not-json');
      expect(loadPersistedState(config)).toEqual({});
    });
  });

  describe('未知 storage 类型', () => {
    it('返回空对象', () => {
      const config = { storage: 'unknown', key: 'k' } as unknown as StatePersistenceConfig;
      expect(loadPersistedState(config)).toEqual({});
    });
  });
});

describe('clearPersistedState', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    setUrl('');
  });

  describe('localStorage', () => {
    it('调用 localStorage.removeItem', () => {
      localStorageMock.setItem('table-state', '{}');
      clearPersistedState({ storage: 'localStorage', key: 'table-state' });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('table-state');
    });
  });

  describe('URL', () => {
    it('从 URL 删除 key 并 replaceState（保留其他参数）', () => {
      setUrl('?t=keep&t2=remove');
      // 在 setUrl 之后创建 spy，避免捕获 setUrl 自身的 replaceState 调用
      const replaceSpy = vi.spyOn(window.history, 'replaceState');

      clearPersistedState({ storage: 'url', key: 't2' });

      expect(replaceSpy).toHaveBeenCalled();
      const newUrl = replaceSpy.mock.calls[0]?.[2];
      expect(newUrl).toBe('?t=keep');
    });

    it('删除后无剩余参数时 replaceState 为 pathname（不带 ?）', () => {
      setUrl('?t=remove');
      const replaceSpy = vi.spyOn(window.history, 'replaceState');

      clearPersistedState({ storage: 'url', key: 't' });

      const newUrl = replaceSpy.mock.calls[0]?.[2];
      expect(newUrl).toBe(window.location.pathname);
      expect(newUrl).not.toContain('?');
    });
  });
});
