import { DatasetCacheService } from '@/modules/dataset/dataset-cache.service';

describe('DatasetCacheService', () => {
  let service: DatasetCacheService;

  beforeEach(() => {
    service = new DatasetCacheService();
  });

  describe('get / set', () => {
    it('写入后应能读取', () => {
      service.set('ds-1', { q: 'a' }, { data: 'hello' }, { ttl: 60 });
      expect(service.get('ds-1', { q: 'a' })).toEqual({ data: 'hello' });
    });

    it('不同 params 应有不同缓存', () => {
      service.set('ds-1', { q: 'a' }, 'value-a', { ttl: 60 });
      service.set('ds-1', { q: 'b' }, 'value-b', { ttl: 60 });
      expect(service.get('ds-1', { q: 'a' })).toBe('value-a');
      expect(service.get('ds-1', { q: 'b' })).toBe('value-b');
    });

    it('不同 datasetId 应有不同缓存', () => {
      service.set('ds-1', {}, 'value-1', { ttl: 60 });
      service.set('ds-2', {}, 'value-2', { ttl: 60 });
      expect(service.get('ds-1', {})).toBe('value-1');
      expect(service.get('ds-2', {})).toBe('value-2');
    });

    it('未写入应返回 undefined', () => {
      expect(service.get('ds-1', {})).toBeUndefined();
    });

    it('相同 key 重复写入应覆盖', () => {
      service.set('ds-1', {}, 'old', { ttl: 60 });
      service.set('ds-1', {}, 'new', { ttl: 60 });
      expect(service.get('ds-1', {})).toBe('new');
      expect(service.size).toBe(1);
    });
  });

  describe('TTL 过期', () => {
    it('过期后应返回 undefined', () => {
      jest.useFakeTimers();
      try {
        service.set('ds-1', {}, 'data', { ttl: 1 });
        jest.advanceTimersByTime(999);
        expect(service.get('ds-1', {})).toBe('data');
        jest.advanceTimersByTime(2);
        expect(service.get('ds-1', {})).toBeUndefined();
      } finally {
        jest.useRealTimers();
      }
    });

    it('ttl <= 0 应使用默认 TTL', () => {
      jest.useFakeTimers();
      try {
        service.set('ds-1', {}, 'data', { ttl: 0 });
        jest.advanceTimersByTime(30_000);
        expect(service.get('ds-1', {})).toBe('data');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('invalidateDataset', () => {
    it('应清除指定数据集的所有缓存', () => {
      service.set('ds-1', { q: 'a' }, 'a', { ttl: 60 });
      service.set('ds-1', { q: 'b' }, 'b', { ttl: 60 });
      service.set('ds-2', { q: 'a' }, 'c', { ttl: 60 });

      service.invalidateDataset('ds-1');

      expect(service.get('ds-1', { q: 'a' })).toBeUndefined();
      expect(service.get('ds-1', { q: 'b' })).toBeUndefined();
      expect(service.get('ds-2', { q: 'a' })).toBe('c');
    });
  });

  describe('invalidateByTag', () => {
    it('应按标签批量失效', () => {
      service.set('ds-1', {}, 'a', { ttl: 60, tags: ['sales', 'realtime'] });
      service.set('ds-2', {}, 'b', { ttl: 60, tags: ['sales'] });
      service.set('ds-3', {}, 'c', { ttl: 60, tags: ['inventory'] });

      service.invalidateByTag('sales');

      expect(service.get('ds-1', {})).toBeUndefined();
      expect(service.get('ds-2', {})).toBeUndefined();
      expect(service.get('ds-3', {})).toBe('c');
    });

    it('invalidateByTags 应失效多个标签', () => {
      service.set('ds-1', {}, 'a', { ttl: 60, tags: ['sales'] });
      service.set('ds-2', {}, 'b', { ttl: 60, tags: ['inventory'] });
      service.set('ds-3', {}, 'c', { ttl: 60, tags: ['other'] });

      service.invalidateByTags(['sales', 'inventory']);

      expect(service.get('ds-1', {})).toBeUndefined();
      expect(service.get('ds-2', {})).toBeUndefined();
      expect(service.get('ds-3', {})).toBe('c');
    });

    it('不存在的标签应无副作用', () => {
      service.set('ds-1', {}, 'a', { ttl: 60 });
      service.invalidateByTag('nonexistent');
      expect(service.get('ds-1', {})).toBe('a');
    });
  });

  describe('LRU 淘汰', () => {
    it('超过容量应淘汰最久未使用', () => {
      // 通过私有 maxEntries 限制测试，这里用循环写入大量数据
      // 默认容量 500，写入 510 个条目
      for (let i = 0; i < 510; i++) {
        service.set(`ds-${i}`, { i }, `value-${i}`, { ttl: 60 });
      }

      // 前 10 个应被淘汰
      expect(service.get('ds-0', { i: 0 })).toBeUndefined();
      expect(service.get('ds-9', { i: 9 })).toBeUndefined();

      // 后 500 个应存在
      expect(service.get('ds-10', { i: 10 })).toBe('value-10');
      expect(service.get('ds-509', { i: 509 })).toBe('value-509');
      expect(service.size).toBe(500);
    });

    it('读取应刷新 LRU 位置', () => {
      // 写入 500 个
      for (let i = 0; i < 500; i++) {
        service.set(`ds-${i}`, { i }, `value-${i}`, { ttl: 60 });
      }

      // 读取 ds-0 使其移到头部（最近使用）
      service.get('ds-0', { i: 0 });

      // 再写入 1 个，应淘汰 ds-1 而非 ds-0
      service.set('ds-new', {}, 'new', { ttl: 60 });

      expect(service.get('ds-0', { i: 0 })).toBe('value-0');
      expect(service.get('ds-1', { i: 1 })).toBeUndefined();
    });
  });

  describe('buildKey', () => {
    it('应生成稳定的 key', () => {
      const key1 = DatasetCacheService.buildKey('ds-1', { a: 1, b: 2 });
      const key2 = DatasetCacheService.buildKey('ds-1', { a: 1, b: 2 });
      expect(key1).toBe(key2);
    });

    it('不同 params 应生成不同 key', () => {
      const key1 = DatasetCacheService.buildKey('ds-1', { a: 1 });
      const key2 = DatasetCacheService.buildKey('ds-1', { a: 2 });
      expect(key1).not.toBe(key2);
    });

    it('不同 datasetId 应生成不同 key', () => {
      const key1 = DatasetCacheService.buildKey('ds-1', {});
      const key2 = DatasetCacheService.buildKey('ds-2', {});
      expect(key1).not.toBe(key2);
    });
  });

  describe('clear', () => {
    it('应清空所有缓存', () => {
      service.set('ds-1', {}, 'a', { ttl: 60 });
      service.set('ds-2', {}, 'b', { ttl: 60, tags: ['x'] });
      service.clear();
      expect(service.size).toBe(0);
      expect(service.get('ds-1', {})).toBeUndefined();
    });
  });
});
