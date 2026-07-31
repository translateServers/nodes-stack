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
 * - 数据集数据源：apiRawData 为后端 execute 返回的 parsed（已应用 dataPath +
 *   fieldMapping + filter）；本 Hook 仅应用 overrideFieldMapping / overrideLogic
 *   覆盖语义（见 dataset-management spec §5.1 / §3.1）
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

    // API / 数据集数据源：请求逻辑由调用方传入 apiRawData
    if (apiRawData === undefined) {
      return { status: 'empty' };
    }

    if (dataSource.type === 'dataset') {
      // 后端已应用 shape.dataPath + shape.fieldMapping + shape.filter 产出 parsed。
      // 前端若配置了 overrideFieldMapping，需基于 parsed 重新映射字段；
      // 否则 parsed 已是 [{name, value}] 格式，inferFieldMapping 会自动识别。
      // dataPath 在 dataset 分支无意义（后端已提取），置空避免重复提取。
      const effectiveDataSource = {
        ...dataSource,
        dataPath: undefined,
        fieldMapping: dataSource.overrideFieldMapping ?? dataSource.fieldMapping,
      };
      return parseChartData(apiRawData, effectiveDataSource, logic);
    }

    return parseChartData(apiRawData, dataSource, logic);
  }, [dataSource, logic, apiRawData]);
}
