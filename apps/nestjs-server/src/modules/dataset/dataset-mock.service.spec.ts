import { DatasetMockService } from '@/modules/dataset/dataset-mock.service';
import { BusinessException } from '@/common/exceptions/business.exception';

describe('DatasetMockService', () => {
  let service: DatasetMockService;

  beforeEach(() => {
    service = new DatasetMockService();
  });

  describe('static 生成器', () => {
    it('应返回 mock.data 的深拷贝', () => {
      const mock = {
        enabled: true,
        generator: 'static' as const,
        data: { list: [1, 2, 3], name: 'test' },
      };
      const result = service.generate(mock, {});
      expect(result).toEqual({ list: [1, 2, 3], name: 'test' });

      // 修改返回值不应影响原配置
      (result as { list: number[] }).list.push(4);
      expect(mock.data).toEqual({ list: [1, 2, 3], name: 'test' });
    });

    it('data 为数组时应正确返回', () => {
      const mock = {
        enabled: true,
        generator: 'static' as const,
        data: [{ x: 1 }, { x: 2 }],
      };
      expect(service.generate(mock, {})).toEqual([{ x: 1 }, { x: 2 }]);
    });

    it('data 缺失时应抛出异常（运行时保护）', () => {
      const mock = {
        enabled: true,
        generator: 'static' as const,
        // data 故意缺失（绕过 schema 校验的场景）
      } as { enabled: boolean; generator: 'static'; data?: unknown };
      expect(() => service.generate(mock, {})).toThrow(BusinessException);
    });
  });

  describe('echo-params 生成器', () => {
    it('应回显绑定参数', () => {
      const mock = {
        enabled: true,
        generator: 'echo-params' as const,
      };
      const params = { region: 'east', date: '2026-01-01' };
      const result = service.generate(mock, params) as {
        params: Record<string, unknown>;
        timestamp: string;
      };
      expect(result.params).toEqual(params);
      expect(result.timestamp).toBeDefined();
      // timestamp 应为 ISO 字符串
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('空参数应返回空 params 对象', () => {
      const mock = {
        enabled: true,
        generator: 'echo-params' as const,
      };
      const result = service.generate(mock, {}) as {
        params: Record<string, unknown>;
      };
      expect(result.params).toEqual({});
    });
  });

  describe('faker-template 生成器', () => {
    it('第一阶段应抛出 DATASET_EXECUTION_FAILED', () => {
      const mock = {
        enabled: true,
        generator: 'faker-template' as const,
        template: '{"name": "{{faker.person.fullName}}"}',
      };
      expect(() => service.generate(mock, {})).toThrow(BusinessException);
    });
  });
});
