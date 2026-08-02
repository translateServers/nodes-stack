/**
 * useChartData Hook 测试（阶段 2 任务 3.1）
 *
 * 验证点（对应 tasks.md 3.1 验证要求）：
 * - 无数据源时返回约定未配置状态（empty）
 * - 配置变更触发重新解析
 * - 不引入请求逻辑（API 数据源仅消费调用方传入的响应）
 */

import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DataSourceConfig, LogicConfig } from '@nebula/shared';
import { useChartData } from './use-chart-data';

const STATIC_DATA = [
  { name: 'A', value: 1 },
  { name: 'B', value: 2 },
];

function makeStaticDataSource(staticData: unknown = STATIC_DATA): DataSourceConfig {
  return { type: 'static', staticData };
}

describe('useChartData', () => {
  it('无数据层配置返回 empty（约定未配置状态）', () => {
    const { result } = renderHook(() => useChartData(undefined, undefined));
    expect(result.current).toEqual({ status: 'empty' });
  });

  it('静态数据源正常解析返回 success', () => {
    const { result } = renderHook(() => useChartData(makeStaticDataSource(), undefined));
    expect(result.current).toEqual({ status: 'success', data: STATIC_DATA });
  });

  it('静态空数组返回 empty 而非错误', () => {
    const { result } = renderHook(() => useChartData(makeStaticDataSource([]), undefined));
    expect(result.current).toEqual({ status: 'empty' });
  });

  it('非法静态数据返回结构化错误', () => {
    const { result } = renderHook(() => useChartData(makeStaticDataSource('not-array'), undefined));
    expect(result.current.status).toBe('error');
  });

  it('应用逻辑层配置（排序 + 限制）', () => {
    const logic: LogicConfig = { sortField: 'value', sortDirection: 'desc', limit: 1 };
    const { result } = renderHook(() => useChartData(makeStaticDataSource(), logic));
    expect(result.current).toEqual({ status: 'success', data: [{ name: 'B', value: 2 }] });
  });

  it('数据层配置变更触发重新解析', () => {
    const { result, rerender } = renderHook(
      ({ dataSource }: { dataSource: DataSourceConfig | undefined }) =>
        useChartData(dataSource, undefined),
      { initialProps: { dataSource: makeStaticDataSource() } },
    );
    expect(result.current).toEqual({ status: 'success', data: STATIC_DATA });

    const nextData = [
      { name: 'C', value: 3 },
      { name: 'D', value: 4 },
    ];
    rerender({ dataSource: makeStaticDataSource(nextData) });
    expect(result.current).toEqual({ status: 'success', data: nextData });
  });

  it('逻辑层配置变更触发重新解析', () => {
    const dataSource = makeStaticDataSource();
    const { result, rerender } = renderHook(
      ({ logic }: { logic: LogicConfig | undefined }) => useChartData(dataSource, logic),
      { initialProps: { logic: undefined as LogicConfig | undefined } },
    );
    expect(result.current).toEqual({ status: 'success', data: STATIC_DATA });

    rerender({ logic: { sortField: 'value', sortDirection: 'desc' } });
    expect(result.current).toEqual({
      status: 'success',
      data: [
        { name: 'B', value: 2 },
        { name: 'A', value: 1 },
      ],
    });
  });

  it('API 数据源未传入响应数据时返回 empty，不发起请求', () => {
    const dataSource: DataSourceConfig = {
      type: 'api',
      apiConfig: { url: 'https://example.com/api', method: 'GET' },
    };
    const { result } = renderHook(() => useChartData(dataSource, undefined));
    expect(result.current).toEqual({ status: 'empty' });
  });

  it('API 数据源消费调用方传入的响应数据，复用同一解析管线', () => {
    const dataSource: DataSourceConfig = {
      type: 'api',
      apiConfig: { url: 'https://example.com/api', method: 'GET' },
      dataPath: 'data.list',
    };
    const apiRawData = { data: { list: STATIC_DATA } };
    const { result } = renderHook(() => useChartData(dataSource, undefined, apiRawData));
    expect(result.current).toEqual({ status: 'success', data: STATIC_DATA });
  });

  it('apiRawData 变更触发重新解析', () => {
    const dataSource: DataSourceConfig = {
      type: 'api',
      apiConfig: { url: 'https://example.com/api', method: 'GET' },
    };
    const { result, rerender } = renderHook(
      ({ apiRawData }: { apiRawData?: unknown }) => useChartData(dataSource, undefined, apiRawData),
      { initialProps: { apiRawData: undefined as unknown } },
    );
    expect(result.current).toEqual({ status: 'empty' });

    rerender({ apiRawData: STATIC_DATA });
    expect(result.current).toEqual({ status: 'success', data: STATIC_DATA });
  });

  it('字段映射配置生效', () => {
    const dataSource: DataSourceConfig = {
      type: 'static',
      staticData: [{ city: '北京', sales: 100 }],
      fieldMapping: { dimension: 'city', value: 'sales' },
    };
    const { result } = renderHook(() => useChartData(dataSource, undefined));
    expect(result.current).toEqual({ status: 'success', data: [{ name: '北京', value: 100 }] });
  });
});
