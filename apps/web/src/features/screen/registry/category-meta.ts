/**
 * 组件库分类元数据（Spec 驱动改造 · Task 4：Category 元数据集中化）
 *
 * 改造前：分类信息分散在两处
 * - `registry/index.ts` 的 `CATEGORY_LABELS`（扁平 label 映射）
 * - `packages/shared/src/schemas/screen.schema.ts` 的 `ComponentCategorySchema`（zod 枚举）
 *
 * 改造后：本文件作为单一数据源，包含 label / icon / order / description。
 * `CATEGORY_LABELS` 仍由 `registry/index.ts` 派生 re-export 以保持向后兼容。
 */

import { BarChart3, Box, Frame, Image, Table, Type, type LucideIcon } from 'lucide-react';

/**
 * 分类元数据项。
 */
export interface CategoryMeta {
  /** 中文显示名 */
  label: string;
  /** lucide 图标组件（用于分类标题/面板等） */
  icon: LucideIcon;
  /** 排序权重（升序，越小越靠前） */
  order: number;
  /** 分类简述（可选） */
  description?: string;
}

/**
 * 所有组件分类的元数据单一数据源。
 *
 * 与 `ComponentCategorySchema` 枚举的 6 个值保持一致：
 * chart / text / media / decoration / table / container。
 */
export const CATEGORY_META: Record<string, CategoryMeta> = {
  chart: { label: '图表', icon: BarChart3, order: 1, description: '数据可视化组件' },
  text: { label: '文本', icon: Type, order: 2, description: '文字与按钮组件' },
  media: { label: '媒体', icon: Image, order: 3, description: '图片与视频组件' },
  decoration: { label: '装饰', icon: Frame, order: 4, description: '形状与装饰元素' },
  table: { label: '表格', icon: Table, order: 5, description: '表格类组件' },
  container: { label: '容器', icon: Box, order: 6, description: '布局容器组件' },
};

/**
 * 取分类中文显示名，未知分类回退为 category 本身。
 */
export function categoryLabel(category: string): string {
  return CATEGORY_META[category]?.label ?? category;
}

/**
 * 取分类图标，未知分类回退为 Box。
 */
export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_META[category]?.icon ?? Box;
}

/**
 * 取分类排序权重，未知分类回退为 99（排在所有已知分类之后）。
 */
export function categoryOrder(category: string): number {
  return CATEGORY_META[category]?.order ?? 99;
}
