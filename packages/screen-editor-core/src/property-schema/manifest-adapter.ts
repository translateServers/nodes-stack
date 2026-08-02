/**
 * Manifest 属性面板适配器（Task 3.2：Spec §7.4 声明式属性面板）
 *
 * 将 manifest 的 `ScreenComponentPropertySection[]` 转换为编辑器内部的
 * `PropertySection[]`（使用 ManifestField kind），插入到 appearance tab。
 *
 * 转换规则：
 * - manifest section.id → PropertySection.id
 * - manifest section.title → PropertySection.title
 * - manifest section.defaultOpen → PropertySection.defaultOpen
 * - manifest field.control → ManifestField.control（复用 FIELD_CONTROLS）
 * - manifest field.pointer → ManifestField.pointer（RFC 6901）
 * - manifest number 控件的 min/max/step → controlProps
 * - manifest select 控件的 options → controlProps
 *
 * 组件专属 section 固定进入 appearance tab（Spec §7.4）。
 * 位置/样式/图层/事件 section 由编辑器组合（不在此处生成）。
 */

import type {
  ScreenComponentPropertyField,
  ScreenComponentPropertySection,
} from '@nebula/screen-component-sdk';
import type { ManifestField, PropertySchema, PropertySection } from './types';
import {
  DEFAULT_DATA_EMPTY_SECTION,
  DEFAULT_INTERACTION_EMPTY_SECTION,
  EVENTS_SECTION,
  FILTER_SECTION,
  LAYER_STATUS_SECTION,
  POSITION_SECTION,
  STYLE_SECTION,
  TRANSFORM_SECTION,
} from './schemas';

/**
 * 将 manifest field 的 control-specific 属性提取为 controlProps。
 *
 * - number: { min, max, step }
 * - select: { options }
 * - text/textarea/color/switch: 无额外属性
 */
function extractControlProps(
  field: ScreenComponentPropertyField,
): Record<string, unknown> | undefined {
  if (field.control === 'number') {
    const props: Record<string, unknown> = {};
    if (field.min !== undefined) props.min = field.min;
    if (field.max !== undefined) props.max = field.max;
    if (field.step !== undefined) props.step = field.step;
    return Object.keys(props).length > 0 ? props : undefined;
  }
  if (field.control === 'select') {
    return { options: field.options };
  }
  return undefined;
}

/**
 * 将单个 manifest field 转换为 ManifestField。
 */
function convertManifestField(field: ScreenComponentPropertyField): ManifestField {
  return {
    kind: 'manifest-field',
    control: field.control,
    label: field.label,
    pointer: field.pointer,
    controlProps: extractControlProps(field),
    description: field.description,
  };
}

/**
 * 将 manifest 的 propertyPanel sections 转换为编辑器 PropertySection[]。
 *
 * 所有 section 固定进入 appearance tab（Spec §7.4: 组件专属 section 进入属性 tab）。
 * section 默认可折叠，defaultOpen 由 manifest 声明决定（缺省为 true）。
 *
 * @param manifestSections manifest.propertyPanel
 * @returns 转换后的 PropertySection[]（用于插入到 appearance tab）
 */
export function manifestToPropertySections(
  manifestSections: readonly ScreenComponentPropertySection[],
): PropertySection[] {
  return manifestSections.map((section) => ({
    id: section.id,
    title: section.title,
    tab: 'appearance' as const,
    collapsible: true,
    defaultOpen: section.defaultOpen ?? true,
    fields: section.fields.map(convertManifestField),
  }));
}

/**
 * 为外部组件（source='host'）构建完整的属性面板 Schema（Spec §7.4 + §13.3 Task 3.2）。
 *
 * 组合顺序（appearance tab）：
 *   位置尺寸 → 样式 → **manifest 组件专属 sections** → 变换 → 层级状态 → 滤镜
 * 外部组件不支持数据源/交互（Spec §4.2 Non-Goals），data/interaction tab 显示空状态提示。
 * events tab 复用 QuickEventEditor（Phase 4 接入 manifest events 后由蓝图处理）。
 *
 * @param manifestSections manifest.propertyPanel（可能为 undefined）
 * @returns 完整的 PropertySchema（含编辑器通用 sections + manifest sections）
 */
export function buildHostComponentSchema(
  manifestSections: readonly ScreenComponentPropertySection[] | undefined,
): PropertySchema {
  const manifestSectionsConverted = manifestSections
    ? manifestToPropertySections(manifestSections)
    : [];

  return [
    POSITION_SECTION,
    STYLE_SECTION,
    ...manifestSectionsConverted,
    TRANSFORM_SECTION,
    LAYER_STATUS_SECTION,
    FILTER_SECTION,
    DEFAULT_DATA_EMPTY_SECTION,
    DEFAULT_INTERACTION_EMPTY_SECTION,
    EVENTS_SECTION,
  ];
}
