/**
 * 图标注册收敛（Phase 2 Slice C）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §5
 *
 * 之前 `component-library.tsx` 与 `layer-panel.tsx` 各存一份 `ICON_MAP`，
 * 演进过程中易出现两侧不同步（如新增组件类型只在一边加图标）。
 * 此文件作为单一映射来源，两个面板同源引用。
 *
 * Spec 驱动改造后：
 * - `ICON_MAP`：从注册中心派生（遍历所有已注册 module 的 icon）+ 历史额外图标（Frame/Table/Box/Minus）
 * - `KNOWN_TYPE_TO_ICON`：组件 type → 默认图标名映射（兜底逻辑，保留不变）
 * - `getIconForType(type)`：优先查注册中心的 icon，再查 KNOWN_TYPE_TO_ICON，最后回退 DEFAULT_ICON
 * - `getIconByName(name)`：按图标名查 ICON_MAP，未注册回退 DEFAULT_ICON
 */

import { Box, Frame, Minus, Table, type LucideIcon } from 'lucide-react';
import './registered-components';
import { getAllModules, getIcon } from './registry';

/**
 * 历史额外图标：与具体组件类型无关，仅为组件库 / 图层面板等调用方保留的通用图标。
 *
 * 这些图标不绑定到任何已注册组件，因此无法从注册中心派生，需在此显式声明。
 * - Frame / Table：分别为 container / table 分类预留的图标
 * - Box：作为 DEFAULT_ICON 兜底
 * - Minus：图层面板分隔线等用途
 */
const EXTRA_ICONS: Record<string, LucideIcon> = {
  Frame,
  Table,
  Box,
  Minus,
};

/**
 * 构建图标名 → lucide 组件的单一映射。
 *
 * 数据源：
 * 1. EXTRA_ICONS：历史遗留的额外图标（Frame / Table / Box / Minus），先放入 map
 * 2. 注册中心：遍历所有已注册 module，若 module.icon 存在且 module.definition.icon
 *    字符串非空，则覆盖到 map（key = definition.icon 字符串，value = module.icon 组件）
 *
 * 当注册中心与 EXTRA_ICONS 同名时，注册中心的（组件绑定的图标）覆盖 EXTRA_ICONS。
 * icons.ts 顶部 `import './registered-components'` 确保遍历前 registry 已填充。
 */
function buildIconMap(): Record<string, LucideIcon> {
  const map: Record<string, LucideIcon> = { ...EXTRA_ICONS };
  for (const mod of getAllModules()) {
    if (mod.icon !== undefined && mod.definition.icon !== undefined) {
      map[mod.definition.icon] = mod.icon;
    }
  }
  return map;
}

/**
 * 图标名 → lucide 组件 单一映射。
 *
 * 在模块加载时构建（注册中心已通过 `import './registered-components'` 完成填充）。
 * frozen 防止调用方误改；类型保持 `Record<string, LucideIcon>` 不变以维持向后兼容。
 */
export const ICON_MAP: Record<string, LucideIcon> = Object.freeze(buildIconMap()) as Record<
  string,
  LucideIcon
>;

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
  button: 'MousePointerClick',
};

/** 兜底图标：未知类型 / 注册表缺失时使用 */
export const DEFAULT_ICON: LucideIcon = Box;

/**
 * 按组件 type 解析图标组件。
 *
 * 优先级：
 * 1. 注册中心的 module.icon（Spec 驱动改造后优先）
 * 2. `KNOWN_TYPE_TO_ICON[type]` 回退（取图标名 → 查 ICON_MAP）
 * 3. `DEFAULT_ICON`（Box）
 */
export function getIconForType(type: string): LucideIcon {
  // 1. 优先查注册中心的 icon
  const registeredIcon = getIcon(type);
  if (registeredIcon !== undefined) return registeredIcon;
  // 2. 再查 KNOWN_TYPE_TO_ICON
  const iconName = KNOWN_TYPE_TO_ICON[type];
  if (iconName !== undefined) {
    const icon = ICON_MAP[iconName];
    if (icon !== undefined) return icon;
  }
  // 3. 回退 DEFAULT_ICON
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
