/**
 * property-schema 模块统一出口（Phase 2 Slice B）
 */

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
