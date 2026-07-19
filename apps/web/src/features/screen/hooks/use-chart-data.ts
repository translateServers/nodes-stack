/**
 * 组件级图表数据解析 Hook（阶段 2 任务 3.1）
 *
 * 读取数据层（dataSource）与逻辑层（logic）配置，同步产出解析结果。
 *
 * 契约：
 * - 无数据层配置：返回 empty（约定未配置状态；3.3 由调用方据此回退 props.data）
 * - 静态数据源：直接解析 dataSource.staticData
 * - API 数据源：本 Hook 不发起请求（5.x 才接入请求闭环），
 *   由调用方将响应数据经 apiRawData 传入；未传入时返回 empty
 * - 配置变更（引用变化）触发重新解析
 */

import { useMemo } from 'react';
import type { DataSourceConfig, LogicConfig } from '@nebula/shared';
import { parseChartData, type ParseResult } from '../lib/chart-data-parser';

export function useChartData(
  dataSource: DataSourceConfig | undefined,
  logic: LogicConfig | undefined,
  apiRawData?: unknown,
): ParseResult {
  return useMemo((): ParseResult => {
    if (dataSource === undefined) {
      return { status: 'empty' };
    }

    if (dataSource.type === 'static') {
      return parseChartData(dataSource.staticData, dataSource, logic);
    }

    // API 数据源：请求逻辑由 5.x 交付，此处仅消费调用方传入的响应数据
    if (apiRawData === undefined) {
      return { status: 'empty' };
    }
    return parseChartData(apiRawData, dataSource, logic);
  }, [dataSource, logic, apiRawData]);
}
