import { StaticExecutor } from '@/modules/dataset/executors/static.executor';

describe('StaticExecutor', () => {
  let executor: StaticExecutor;

  beforeEach(() => {
    executor = new StaticExecutor();
  });

  describe('execute', () => {
    it('应返回 staticData 的深拷贝', async () => {
      const config = {
        type: 'static' as const,
        staticData: { list: [1, 2, 3], name: '测试' },
      };
      const result = await executor.execute(config, {});
      expect(result).toEqual({ list: [1, 2, 3], name: '测试' });

      // 修改返回值不应影响原配置
      (result as { list: number[] }).list.push(4);
      expect(config.staticData).toEqual({ list: [1, 2, 3], name: '测试' });
    });

    it('应处理数组类型 staticData', async () => {
      const config = {
        type: 'static' as const,
        staticData: [{ name: 'a', value: 1 }],
      };
      const result = await executor.execute(config, {});
      expect(result).toEqual([{ name: 'a', value: 1 }]);
    });

    it('应处理基本类型 staticData', async () => {
      const config = {
        type: 'static' as const,
        staticData: 42,
      };
      const result = await executor.execute(config, {});
      expect(result).toBe(42);
    });
  });

  describe('test', () => {
    it('应返回 raw 和 parsed（相同）+ meta', async () => {
      const config = {
        type: 'static' as const,
        staticData: { data: 'hello' },
      };
      const result = await executor.test(config, {});
      expect(result.raw).toEqual({ data: 'hello' });
      expect(result.parsed).toEqual({ data: 'hello' });
      expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
