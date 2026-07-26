/**
 * 组件库统一注册入口（Spec 驱动改造）
 *
 * 改造前：4 处手动同步注册（COMPONENT_DEFINITIONS / RENDERERS / ICON_MAP / PROPERTY_SCHEMAS）
 * 改造后：单一 registerComponent API，各组件文件声明 ComponentModule 后由 registered-components.ts 集中注册。
 *
 * 本文件作为对外 re-export 入口，保持以下 API 签名不变（向后兼容）：
 * - getDefinitionByType / getDefinitionsByCategory / getAllDefinitions
 * - searchComponentDefinitions / createComponentInstance
 * - CATEGORY_LABELS / COMPONENT_DEFINITIONS（派生）
 * - registerComponent / ComponentModule（新增）
 * - CATEGORY_META / categoryLabel / categoryIcon / categoryOrder / CategoryMeta（Task 4 新增，从 category-meta.ts re-export）
 *
 * 副作用导入：触发所有组件的注册。
 */

import type { ComponentDefinition } from '@nebula/shared';
import './registered-components';
import { getAllDefinitions } from './registry';
import { CATEGORY_META } from './category-meta';

/**
 * 兼容常量：派生自注册中心。
 *
 * 现有代码（如 component-library.tsx、icons.test.ts）直接 import 此常量，
 * 改造后通过 getAllDefinitions() 派生以保持 API 兼容。
 *
 * 注意：此常量在模块加载时构建一次，调用方应在 registered-components 加载完成后访问
 * （本文件顶部已 `import './registered-components'`，确保副作用执行完毕）。
 */
export const COMPONENT_DEFINITIONS: ComponentDefinition[] = getAllDefinitions();

/**
 * 兼容常量：派生自 `CATEGORY_META` 的扁平 label 映射。
 *
 * Task 4 改造前此常量在 index.ts 中硬编码；改造后由 `category-meta.ts` 单一数据源派生，
 * 避免分类 label 重复维护。新代码应优先使用 `categoryLabel(category)`。
 */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([k, v]) => [k, v.label]),
);

export {
  createComponentInstance,
  getDefinitionByType,
  getDefinitionsByCategory,
  getAllDefinitions,
  getIcon,
  getRenderer,
  getSchema,
  registerComponent,
  searchComponentDefinitions,
} from './registry';

export type { CreateComponentInstanceOptions } from './registry';
export type { ComponentModule } from './types';

export {
  DEFAULT_ACTIONS,
  DEFAULT_EVENTS,
  DATASOURCE_EVENTS,
  DATASOURCE_ACTIONS,
  CONTAINER_ACTIONS,
  mergeEvents,
  mergeActions,
  getComponentEvents,
  getComponentActions,
} from './component-events-actions';

export {
  CATEGORY_META,
  categoryLabel,
  categoryIcon,
  categoryOrder,
  type CategoryMeta,
} from './category-meta';
