/**
 * props.data 一次性迁移（阶段 2 任务 3.3）
 *
 * 契约：
 * - 首次通过数据层 UI 提交时，遗留 `props.data` 迁移为数据层静态数据，
 *   并从 props 中清除其数据真值身份
 * - 迁移与新数据层配置合并为一次 updateComponent 调用（一条本地编辑历史）
 * - 未经过数据层 UI 的组件不受影响，`props.data` 原样保留
 */

import type { DataSourceConfig, ScreenComponent } from '@nebula/shared';

/**
 * 构造一次性迁移的组件更新负载。
 *
 * 返回的 updates 供 `updateComponent(id, updates)` 一次调用完成：
 * - `dataSource`：数据层 UI 提交的新配置（staticData 由 UI 预填生效数据后编辑产生）
 * - `props`：剔除 `data` 键后的剩余 props，清除遗留数据真值身份
 *
 * 组件本无 `props.data` 时，props 原样透传，不产生多余写入。
 */
export function buildDataSourceMigration(
  component: ScreenComponent,
  dataSource: DataSourceConfig,
): Pick<ScreenComponent, 'dataSource' | 'props'> {
  if (!('data' in component.props)) {
    return { dataSource, props: component.props };
  }

  const { data: _legacyData, ...restProps } = component.props;
  return { dataSource, props: restProps };
}
