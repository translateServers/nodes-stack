/**
 * Mock ScreenComponent 构造辅助（Spec §13.2 Phase 2, Task 2.3）
 *
 * 为 component lab 渲染验证构造合法的 ScreenComponent 实例。
 * 不依赖编辑器 Store，仅用于 renderer harness 验证 model 桥接。
 */

import type { ComponentStyle, ScreenComponent } from '@nebula/shared';
import { INDICATOR_CARD_TYPE, indicatorCardManifest } from '@nebula-example/indicator-card-vanilla';

/**
 * 构造一个指标卡 ScreenComponent mock。
 *
 * - type / defaultProps / defaultSize 来自 manifest（Spec §7.2: manifest 是组件权威数据源）
 * - position / style / status / zIndex 由 lab 自行填充
 * - 不含 dataSource / logic / interaction（外部组件第一版不支持，Spec §7.5）
 *
 * @param overrides 可覆盖 id / props / position 等字段
 */
export function createIndicatorCardComponent(overrides?: {
  id?: string;
  props?: Record<string, unknown>;
  position?: Partial<ScreenComponent['position']>;
  style?: Partial<ComponentStyle>;
}): ScreenComponent {
  const defaultProps = indicatorCardManifest.defaultProps;
  const defaultSize = indicatorCardManifest.defaultSize;

  return {
    id: overrides?.id ?? 'lab-indicator-card-1',
    type: INDICATOR_CARD_TYPE,
    name: '指标卡',
    position: {
      x: 0,
      y: 0,
      width: defaultSize.width,
      height: defaultSize.height,
      ...overrides?.position,
    },
    style: {
      backgroundColor: '#1f2937',
      ...overrides?.style,
    },
    props: {
      ...defaultProps,
      ...overrides?.props,
    },
    status: {
      locked: false,
      hidden: false,
    },
    zIndex: 0,
  };
}
