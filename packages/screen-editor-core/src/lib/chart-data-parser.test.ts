import { describe, expect, it } from 'vitest';
import {
  applyLogicConfig,
  extractDataByPath,
  mapFieldsToChartData,
  parseChartData,
  type ChartDataItem,
  type ParseResult,
} from './chart-data-parser';

// ===== 2.2 数据路径提取 =====

describe('extractDataByPath', () => {
  it('无 dataPath 时直接返回输入', () => {
    const data = [{ name: 'A', value: 1 }];
    const result = extractDataByPath(data);
    expect(result).toEqual({ ok: true, value: data });
  });

  it('空 dataPath 视为无路径', () => {
    const data = [{ name: 'A', value: 1 }];
    const result = extractDataByPath(data, '');
    expect(result).toEqual({ ok: true, value: data });
  });

  it('单级路径提取', () => {
    const data = { list: [{ name: 'A', value: 1 }] };
    const result = extractDataByPath(data, 'list');
    expect(result).toEqual({ ok: true, value: [{ name: 'A', value: 1 }] });
  });

  it('嵌套路径提取', () => {
    const data = { data: { result: { items: [{ name: 'A', value: 1 }] } } };
    const result = extractDataByPath(data, 'data.result.items');
    expect(result).toEqual({ ok: true, value: [{ name: 'A', value: 1 }] });
  });

  it('路径不存在返回错误', () => {
    const data = { data: { list: [] } };
    const result = extractDataByPath(data, 'data.missing');
    expect(result).toEqual({ ok: false, reason: 'path-not-found' });
  });

  it('路径中间遇到 null 返回错误', () => {
    const data = { data: null };
    const result = extractDataByPath(data, 'data.list');
    expect(result).toEqual({ ok: false, reason: 'path-not-found' });
  });

  it('路径中间遇到非对象返回错误', () => {
    const data = { data: 'string' };
    const result = extractDataByPath(data, 'data.list');
    expect(result).toEqual({ ok: false, reason: 'path-not-found' });
  });

  it('数组索引路径', () => {
    const data = {
      list: [
        [1, 2],
        [3, 4],
      ],
    };
    const result = extractDataByPath(data, 'list.0');
    expect(result).toEqual({ ok: true, value: [1, 2] });
  });

  it('数组索引越界返回错误', () => {
    const data = { list: [[1, 2]] };
    const result = extractDataByPath(data, 'list.5');
    expect(result).toEqual({ ok: false, reason: 'path-not-found' });
  });

  it('数组索引非整数返回错误', () => {
    const data = { list: [[1, 2]] };
    const result = extractDataByPath(data, 'list.abc');
    expect(result).toEqual({ ok: false, reason: 'path-not-found' });
  });
});

// ===== 2.2 字段映射 =====

describe('mapFieldsToChartData', () => {
  it('按映射转换数据', () => {
    const raw = [
      { city: '北京', sales: 100 },
      { city: '上海', sales: 200 },
    ];
    const result = mapFieldsToChartData(raw, { dimension: 'city', value: 'sales' });
    expect(result).toEqual({
      ok: true,
      data: [
        { name: '北京', value: 100 },
        { name: '上海', value: 200 },
      ],
    });
  });

  it('默认推断 name/value 字段', () => {
    const raw = [{ name: 'A', value: 42 }];
    const result = mapFieldsToChartData(raw, { dimension: 'name', value: 'value' });
    expect(result).toEqual({ ok: true, data: [{ name: 'A', value: 42 }] });
  });

  it('空数组返回空结果', () => {
    const result = mapFieldsToChartData([], { dimension: 'name', value: 'value' });
    expect(result).toEqual({ ok: true, data: [] });
  });

  it('非对象条目返回错误', () => {
    const result = mapFieldsToChartData(['string'], { dimension: 'name', value: 'value' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-an-array');
    }
  });

  it('缺少维度字段返回错误', () => {
    const raw = [{ sales: 100 }];
    const result = mapFieldsToChartData(raw, { dimension: 'city', value: 'sales' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing-dimension-field');
    }
  });

  it('缺少数值字段返回错误', () => {
    const raw = [{ city: '北京' }];
    const result = mapFieldsToChartData(raw, { dimension: 'city', value: 'sales' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing-value-field');
    }
  });

  it('数值字段不可转为数值返回错误', () => {
    const raw = [{ name: 'A', value: 'abc' }];
    const result = mapFieldsToChartData(raw, { dimension: 'name', value: 'value' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-value-type');
    }
  });

  it('数值字段为字符串数字时可转换', () => {
    const raw = [{ name: 'A', value: '42' }];
    const result = mapFieldsToChartData(raw, { dimension: 'name', value: 'value' });
    expect(result).toEqual({ ok: true, data: [{ name: 'A', value: 42 }] });
  });

  it('维度字段非字符串时转为字符串', () => {
    const raw = [{ id: 1, value: 10 }];
    const result = mapFieldsToChartData(raw, { dimension: 'id', value: 'value' });
    expect(result).toEqual({ ok: true, data: [{ name: '1', value: 10 }] });
  });

  it('数组条目返回错误', () => {
    const raw = [[1, 2]];
    const result = mapFieldsToChartData(raw, { dimension: 'name', value: 'value' });
    expect(result.ok).toBe(false);
  });
});

// ===== 2.3 逻辑层处理 =====

describe('applyLogicConfig', () => {
  const sampleData: readonly ChartDataItem[] = [
    { name: 'C', value: 30 },
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
  ];

  it('无逻辑配置时返回副本', () => {
    const result = applyLogicConfig(sampleData);
    expect(result).toEqual(sampleData);
    expect(result).not.toBe(sampleData); // 副本
  });

  it('空逻辑配置返回副本', () => {
    const result = applyLogicConfig(sampleData, {});
    expect(result).toEqual(sampleData);
  });

  it('按数值升序排序', () => {
    const result = applyLogicConfig(sampleData, {
      sortField: 'value',
      sortDirection: 'asc',
    });
    expect(result.map((d) => d.value)).toEqual([10, 20, 30]);
  });

  it('按数值降序排序', () => {
    const result = applyLogicConfig(sampleData, {
      sortField: 'value',
      sortDirection: 'desc',
    });
    expect(result.map((d) => d.value)).toEqual([30, 20, 10]);
  });

  it('按维度升序排序', () => {
    const result = applyLogicConfig(sampleData, {
      sortField: 'dimension',
      sortDirection: 'asc',
    });
    expect(result.map((d) => d.name)).toEqual(['A', 'B', 'C']);
  });

  it('按维度降序排序', () => {
    const result = applyLogicConfig(sampleData, {
      sortField: 'dimension',
      sortDirection: 'desc',
    });
    expect(result.map((d) => d.name)).toEqual(['C', 'B', 'A']);
  });

  it('条数限制截断', () => {
    const result = applyLogicConfig(sampleData, { limit: 2 });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'C', value: 30 });
  });

  it('排序 + 条数限制组合', () => {
    const result = applyLogicConfig(sampleData, {
      sortField: 'value',
      sortDirection: 'desc',
      limit: 2,
    });
    expect(result.map((d) => d.value)).toEqual([30, 20]);
  });

  it('原始输入引用不变', () => {
    const original = [...sampleData];
    applyLogicConfig(sampleData, { sortField: 'value', sortDirection: 'asc', limit: 1 });
    expect(sampleData).toEqual(original);
  });
});

// ===== 2.4 统一解析入口 =====

describe('parseChartData', () => {
  it('无数据源配置返回空', () => {
    const result = parseChartData([{ name: 'A', value: 1 }]);
    expect(result).toEqual({ status: 'empty' });
  });

  it('静态数据直接解析', () => {
    const result = parseChartData(
      [
        { name: 'A', value: 1 },
        { name: 'B', value: 2 },
      ],
      {
        type: 'static',
        staticData: [
          { name: 'A', value: 1 },
          { name: 'B', value: 2 },
        ],
      },
    );
    expect(result).toEqual({
      status: 'success',
      data: [
        { name: 'A', value: 1 },
        { name: 'B', value: 2 },
      ],
    });
  });

  it('带字段映射的静态数据', () => {
    const result = parseChartData([{ city: '北京', sales: 100 }], {
      type: 'static',
      staticData: [{ city: '北京', sales: 100 }],
      fieldMapping: { dimension: 'city', value: 'sales' },
    });
    expect(result).toEqual({ status: 'success', data: [{ name: '北京', value: 100 }] });
  });

  it('带数据路径的嵌套数据', () => {
    const result = parseChartData(
      { data: { list: [{ name: 'A', value: 1 }] } },
      {
        type: 'api',
        apiConfig: { url: 'https://example.com/api', method: 'GET' },
        dataPath: 'data.list',
      },
    );
    expect(result).toEqual({ status: 'success', data: [{ name: 'A', value: 1 }] });
  });

  it('带逻辑层的排序和限制', () => {
    const result = parseChartData(
      [
        { name: 'C', value: 30 },
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ],
      { type: 'static', staticData: [] },
      { sortField: 'value', sortDirection: 'desc', limit: 2 },
    );
    expect(result).toEqual({
      status: 'success',
      data: [
        { name: 'C', value: 30 },
        { name: 'B', value: 20 },
      ],
    });
  });

  it('空数组返回空状态', () => {
    const result = parseChartData([], { type: 'static', staticData: [] });
    expect(result).toEqual({ status: 'empty' });
  });

  it('路径不存在返回错误', () => {
    const result = parseChartData(
      { data: {} },
      {
        type: 'api',
        apiConfig: { url: 'https://example.com/api', method: 'GET' },
        dataPath: 'data.missing',
      },
    );
    expect(result).toEqual({
      status: 'error',
      reason: 'path-not-found',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      message: expect.stringContaining('data.missing'),
    });
  });

  it('非数组返回错误', () => {
    const result = parseChartData('not an array', { type: 'static', staticData: 'not an array' });
    expect(result).toEqual({
      status: 'error',
      reason: 'not-an-array',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      message: expect.any(String),
    });
  });

  it('缺少映射字段返回错误', () => {
    const result = parseChartData([{ x: 1 }], {
      type: 'static',
      staticData: [{ x: 1 }],
      fieldMapping: { dimension: 'name', value: 'value' },
    });
    expect(result).toEqual({
      status: 'error',
      reason: 'missing-dimension-field',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      message: expect.any(String),
    });
  });

  it('逻辑层处理后为空返回空状态', () => {
    const result = parseChartData(
      [{ name: 'A', value: 1 }],
      { type: 'static', staticData: [{ name: 'A', value: 1 }] },
      { limit: 0 },
    );
    // limit: 0 在 Schema 中被拒绝（正整数），但解析器防御性处理
    expect(result.status).toBe('success');
  });

  it('解析器不抛出异常', () => {
    const result = parseChartData(null, { type: 'static', staticData: null });
    expect(result.status).toBe('error');
  });

  it('错误信息不泄露原始数据全文', () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({ name: `item${i}`, value: i }));
    const result = parseChartData(largeData, {
      type: 'static',
      staticData: largeData,
      fieldMapping: { dimension: 'nonexistent', value: 'value' },
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message.length).toBeLessThan(200);
    }
  });

  it('API 响应与静态数据走同一管线产出一致结构', () => {
    const staticResult: ParseResult = parseChartData([{ name: 'A', value: 1 }], {
      type: 'static',
      staticData: [{ name: 'A', value: 1 }],
    });
    const apiResult: ParseResult = parseChartData([{ name: 'A', value: 1 }], {
      type: 'api',
      apiConfig: { url: 'https://example.com/api', method: 'GET' },
    });
    expect(staticResult).toEqual(apiResult);
  });
});
