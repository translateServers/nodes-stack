/**
 * XJ 契约 fixture 注册表。
 *
 * 使用 editor-core experimental 的 createScreenComponentRegistry 注册
 * `xj.metric-card/v1` 与 `xj.chart.bar/v1`（组件 API v2，dataCapability=host-metric）。
 * A2 由 XJ 生产注册表替换。
 */

import {
  createScreenComponentRegistry,
  type ScreenComponentInstanceRegistry,
} from '@nebula/screen-editor-core/experimental';
import type { ScreenComponentManifest, ScreenComponentPlugin } from '@nebula/screen-component-sdk';
import { XJ_CHART_BAR_MANIFEST, XjChartBarElement } from './xj-chart-bar.js';
import { XJ_METRIC_CARD_MANIFEST, XjMetricCardElement } from './xj-metric-card.js';

export interface CreateXjContractFixtureRegistryOptions {
  readonly includeChartBar?: boolean;
  readonly includeMetricCard?: boolean;
}

export async function createXjContractFixtureRegistry(
  options: CreateXjContractFixtureRegistryOptions = {},
): Promise<ScreenComponentInstanceRegistry> {
  const components: ScreenComponentPlugin[] = [];
  if (options.includeMetricCard !== false) {
    components.push({
      manifest: XJ_METRIC_CARD_MANIFEST as unknown as ScreenComponentManifest,
      define: () => XjMetricCardElement,
    });
  }
  if (options.includeChartBar !== false) {
    components.push({
      manifest: XJ_CHART_BAR_MANIFEST as unknown as ScreenComponentManifest,
      define: () => XjChartBarElement,
    });
  }
  // 动态 SDK 不加载内置 legacy 组件（text/bar-chart 等保留给静态 SDK）
  const result: unknown = await createScreenComponentRegistry({
    builtInComponents: [],
    components,
  });
  return result as ScreenComponentInstanceRegistry;
}

export { XJ_CHART_BAR_MANIFEST, XJ_CHART_BAR_TAG_NAME } from './xj-chart-bar.js';
export { XJ_METRIC_CARD_MANIFEST, XJ_METRIC_CARD_TAG_NAME } from './xj-metric-card.js';
