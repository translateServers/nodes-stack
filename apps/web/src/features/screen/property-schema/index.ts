/**
 * property-schema 模块统一出口（Phase 2 Slice B）
 *
 * 副作用导入 registered-components.ts 确保组件注册在任何 schema 查询前完成。
 * property-panel 等消费者只 import 本模块（不直接 import ../registry），
 * 若不在此触发注册，PROPERTY_SCHEMAS 会保持空对象导致属性面板回退到 DEFAULT_SCHEMA。
 *
 * 加载顺序安全分析：
 * 1. 本模块 import registered-components.ts
 * 2. registered-components.ts import 各组件文件（如 text-component.tsx）
 * 3. 组件文件 import schemas.tsx 的 TEXT_SCHEMA 等常量
 * 4. schemas.tsx 不反向 import 本模块，无循环
 * 5. schemas.tsx 定义常量 → 组件文件拿到值 → registered-components 注册 + buildPropertySchemas
 * 6. 本模块继续 re-export schemas.tsx 的内容
 */
import '../registry/registered-components';

export type {
  FieldControlComponent,
  FieldControlProps,
  PropertyField,
  PropertySchema,
  PropertySection,
  PropertyTabId,
  SectionRenderContext,
} from './types';
export { TAB_LABELS } from './types';
export { buildNestedUpdate, getByPath } from './path-utils';
export { FIELD_CONTROLS } from './field-controls';
export {
  BAR_CHART_SCHEMA,
  BUTTON_SCHEMA,
  DEFAULT_SCHEMA,
  getSchemaForComponentType,
  POSITION_SECTION,
  PROPERTY_SCHEMAS,
  STYLE_SECTION,
  TEXT_PROPS_SECTION,
  TEXT_SCHEMA,
  TRANSFORM_SECTION,
} from './schemas';
export { PropertySchemaRenderer } from './section-renderer';
