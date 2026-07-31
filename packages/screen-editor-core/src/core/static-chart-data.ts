import { parseChartData, type LogicConfig, type ParseResult } from '@nebula/shared';
import type { StaticDataSourceConfig } from '../contracts/document.js';

export function parseStaticBarChartData(
  dataSource: StaticDataSourceConfig | undefined,
  legacyPropsData: unknown,
  logic?: LogicConfig,
): ParseResult {
  const effectiveDataSource =
    dataSource ??
    (legacyPropsData === undefined
      ? undefined
      : ({ type: 'static', staticData: legacyPropsData } satisfies StaticDataSourceConfig));

  return parseChartData(effectiveDataSource?.staticData, effectiveDataSource, logic);
}
