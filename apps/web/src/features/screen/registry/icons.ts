/**
 * 图标注册收敛（Phase 2 Slice C）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §5
 *
 * 之前 `component-library.tsx` 与 `layer-panel.tsx` 各存一份 `ICON_MAP`，
 * 演进过程中易出现两侧不同步（如新增组件类型只在一边加图标）。
 * 此文件作为单一映射来源，两个面板同源引用。
 *
 * - `ICON_MAP`：图标名（字符串）→ lucide 组件
 * - `KNOWN_TYPE_TO_ICON`：组件 type → 默认图标名（用于组件未显式声明 icon 时回退）
 * - `getIconForType(type)`：合并上述两层 + Box 兜底
 */

import {
  BarChart3,
  Box,
  Circle,
  Frame,
  Image,
  Minus,
  Square,
  Table,
  Type,
  type LucideIcon,
} from 'lucide-react';

/**
 * 图标名 → lucide 组件 单一映射。
 *
 * 新增组件类型时只需在此注册一次，组件库与图层面板同时生效。
 * 图标名约定：与 lucide-react 的导出名一致（便于 grep）。
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Type,
  BarChart3,
  Image,
  Frame,
  Table,
  Box,
  Square,
  Circle,
  Minus,
};

/**
 * 组件 type → 默认图标名映射（回退逻辑）。
 *
 * 用于 `ComponentDefinition.icon` 字段未显式声明时的兜底。
 * 当组件类型在 ICON_MAP 中有对应图标但 definition 未指定 icon 时使用。
 */
export const KNOWN_TYPE_TO_ICON: Record<string, string> = {
  text: 'Type',
  'bar-chart': 'BarChart3',
  rect: 'Square',
  ellipse: 'Circle',
  image: 'Image',
};

/** 兜底图标：未知类型 / 注册表缺失时使用 */
export const DEFAULT_ICON: LucideIcon = Box;

/**
 * 按组件 type 解析图标组件。
 *
 * 优先级：
 * 1. `ComponentDefinition.icon` 显式声明（需调用方传入）
 * 2. `KNOWN_TYPE_TO_ICON[type]` 回退
 * 3. `DEFAULT_ICON`（Box）
 *
 * 调用方约定：先从 `getDefinitionByType(type).icon` 取显式声明，
 * 未声明时调用本函数走兜底。
 */
export function getIconForType(type: string): LucideIcon {
  const iconName = KNOWN_TYPE_TO_ICON[type];
  if (iconName !== undefined) {
    const icon = ICON_MAP[iconName];
    if (icon !== undefined) return icon;
  }
  return DEFAULT_ICON;
}

/**
 * 按图标名解析图标组件。
 *
 * 用于已知 `ComponentDefinition.icon` 字段值的场景，
 * 未注册的图标名回退到 `DEFAULT_ICON`。
 */
export function getIconByName(iconName: string | undefined): LucideIcon {
  if (iconName === undefined) return DEFAULT_ICON;
  return ICON_MAP[iconName] ?? DEFAULT_ICON;
}
