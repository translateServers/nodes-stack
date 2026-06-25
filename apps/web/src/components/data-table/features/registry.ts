import type { ColumnDef, TableOptions, TableState } from '@tanstack/react-table';
import type { DataTableFeature, DataTableSlots, FeatureContext } from '../types';
import { mergeSlots } from '../slots/slot-helpers';

/**
 * Feature 插件工厂函数。
 * 提供类型安全的插件创建方式，支持依赖声明。
 */
export function createDataTableFeature<TData>(
  config: DataTableFeature<TData>,
): DataTableFeature<TData> {
  return config;
}

/**
 * 验证 feature 插件列表。
 * 检测重复 id 和依赖是否满足。
 * 在开发环境下输出警告。
 */
export function validateFeatures<TData>(features: DataTableFeature<TData>[]): void {
  const ids = new Set<string>();

  for (const feature of features) {
    // 检测重复 id
    if (ids.has(feature.id)) {
      console.warn(`[DataTable] 重复的 feature 插件 id: "${feature.id}"`);
    }
    ids.add(feature.id);

    // 检测依赖
    if (feature.deps) {
      for (const dep of feature.deps) {
        if (!ids.has(dep)) {
          console.warn(
            `[DataTable] feature 插件 "${feature.id}" 依赖的 "${dep}" 未找到或未在它之前注册`,
          );
        }
      }
    }
  }
}

/**
 * 合并所有 feature 插件的 tableOptions。
 * 后注册的插件覆盖先注册的插件（浅合并）。
 */
export function mergeFeatureTableOptions<TData>(
  features: DataTableFeature<TData>[],
  ctx: FeatureContext<TData>,
): Partial<TableOptions<TData>> {
  const merged: Partial<TableOptions<TData>> = {};

  for (const feature of features) {
    if (feature.tableOptions) {
      const options = feature.tableOptions(ctx);
      Object.assign(merged, options);
    }
  }

  return merged;
}

/**
 * 合并所有 feature 插件的 columnEnhancers。
 * 返回需要追加到列列表前面的增强列。
 */
export function mergeFeatureColumnEnhancers<TData>(
  features: DataTableFeature<TData>[],
  ctx: FeatureContext<TData>,
): ColumnDef<TData, unknown>[] {
  const enhancers: ColumnDef<TData, unknown>[] = [];

  for (const feature of features) {
    if (feature.columnEnhancers) {
      enhancers.push(...feature.columnEnhancers(ctx));
    }
  }

  return enhancers;
}

/**
 * 合并所有 feature 插件的 renderSlots。
 */
export function mergeFeatureSlots<TData>(
  features: DataTableFeature<TData>[],
  userSlots?: Partial<DataTableSlots<TData>>,
): Partial<DataTableSlots<TData>> {
  const featureSlots = features
    .map((f) => f.renderSlots)
    .filter((s): s is Partial<DataTableSlots<TData>> => s !== undefined);

  return mergeSlots(userSlots, featureSlots);
}

/**
 * 合并所有 feature 插件的 initialState。
 */
export function mergeFeatureInitialState<TData>(
  features: DataTableFeature<TData>[],
): Partial<TableState> {
  const merged: Partial<TableState> = {};

  for (const feature of features) {
    if (feature.initialState) {
      Object.assign(merged, feature.initialState);
    }
  }

  return merged;
}
