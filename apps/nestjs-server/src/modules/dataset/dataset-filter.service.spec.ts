import { DatasetFilterService } from '@/modules/dataset/dataset-filter.service';

describe('DatasetFilterService', () => {
  let service: DatasetFilterService;

  beforeEach(() => {
    service = new DatasetFilterService();
  });

  describe('applyFilter', () => {
    it('应正确求值路径提取表达式', async () => {
      const data = { data: { list: [1, 2, 3] } };
      const result = await service.applyFilter('data.list', data);
      expect(result).toEqual([1, 2, 3]);
    });

    it('应正确求值过滤表达式', async () => {
      const data = {
        items: [
          { name: 'a', value: 15 },
          { name: 'b', value: 20 },
          { name: 'c', value: 5 },
        ],
      };
      const result = await service.applyFilter('items[value > 10].name', data);
      // JSONata 返回的数组 prototype 与普通数组不同，
      // 通过 JSON 序列化归一化后再比较
      expect(JSON.parse(JSON.stringify(result))).toEqual(['a', 'b']);
    });

    it('应正确求值聚合表达式', async () => {
      const data = { items: [1, 2, 3, 4, 5] };
      const result = await service.applyFilter('$sum(items)', data);
      expect(result).toBe(15);
    });

    it('应正确求值排序 + 限制表达式', async () => {
      const data = {
        items: [
          { name: 'a', value: 3 },
          { name: 'b', value: 1 },
          { name: 'c', value: 2 },
        ],
      };
      // JSONata 2.x 无 $slice，[0:2] 也非有效语法；
      // 用 $sort 降序 + $filter 按 index 过滤实现"取前 2 个"
      const result = await service.applyFilter(
        '$filter($sort(items, function($a, $b) { $a.value < $b.value }), function($v, $i) { $i < 2 }).name',
        data,
      );
      expect(JSON.parse(JSON.stringify(result))).toEqual(['a', 'c']);
    });

    it('空表达式应返回原始数据', async () => {
      const data = { hello: 'world' };
      const result = await service.applyFilter('', data);
      // JSONata 空表达式返回输入本身
      expect(result).toEqual(data);
    });

    it('语法错误应降级返回原始数据', async () => {
      const data = { hello: 'world' };
      const result = await service.applyFilter('$$$invalid{{{', data);
      expect(result).toEqual(data);
    });

    it('求值异常应降级返回原始数据', async () => {
      const data = { hello: 'world' };
      // 引用不存在的函数会触发求值错误
      const result = await service.applyFilter('$nonExistentFunction(data)', data);
      expect(result).toEqual(data);
    });

    it('应处理数组输入', async () => {
      const data = [1, 2, 3, 4, 5];
      const result = await service.applyFilter('$sum($)', data);
      expect(result).toBe(15);
    });

    it('应处理 null / undefined 输入', async () => {
      const result1 = await service.applyFilter('$', null);
      expect(result1).toBeNull();

      const result2 = await service.applyFilter('$', undefined);
      // undefined 在 JSONata 中会被当作 null 处理
      expect(result2).toBeUndefined();
    });

    it('表达式可对对象做字段重组', async () => {
      const data = {
        users: [
          { id: 1, name: 'Alice', age: 30 },
          { id: 2, name: 'Bob', age: 25 },
        ],
      };
      const result = await service.applyFilter('users.{ "name": name, "age": age }', data);
      // JSONata 返回的对象 prototype 与普通对象不同，
      // 通过 JSON 序列化归一化后再比较
      expect(JSON.parse(JSON.stringify(result))).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);
    });
  });
});
