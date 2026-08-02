/**
 * 蓝图模板元数据。
 *
 * 定义空蓝图可用的一键模板元信息。
 * 实际蓝图构造由 `create-template-blueprint.ts` 完成；Schema 校验由
 * `build-validated-template.ts` 完成。
 *
 * 四个内置模板：
 * - click-navigate：组件 A 的 evt:click → 全局 navigate 节点的 act:navigate
 * - click-toggle-visibility：组件 A 的 evt:click → 组件 B 的 act:toggleVisibility
 * - page-load-refresh：全局 pageLoad 节点的 evt:pageLoad → 组件 B 的 act:refreshData
 * - click-delay-show：组件 A 的 evt:click → delay 节点 → 组件 B 的 act:show
 *
 * 设计理由：将模板元数据与构造分离，便于 UI 直接消费元数据列表渲染卡片，
 * 而不需要在渲染时构造完整蓝图（懒构造）。
 */

import type { LucideIcon } from 'lucide-react';
import { MousePointerClick, Navigation, RefreshCw, Timer } from 'lucide-react';

/** 模板唯一标识 */
export type BlueprintTemplateId =
  | 'click-navigate'
  | 'click-toggle-visibility'
  | 'page-load-refresh'
  | 'click-delay-show';

/** 模板元数据（UI 渲染用） */
export interface BlueprintTemplateMeta {
  /** 模板唯一标识 */
  id: BlueprintTemplateId;
  /** 模板名称（中文，显示在卡片标题） */
  name: string;
  /** 模板描述（中文，显示在卡片副标题，说明触发 → 动作链路） */
  description: string;
  /** 卡片图标 */
  icon: LucideIcon;
}

/**
 * 模板列表（顺序即 UI 渲染顺序）。
 * 顺序约定：从最常见到最特殊（点击跳转 > 显隐切换 > 页面加载刷新 > 延时执行）。
 */
export const BLUEPRINT_TEMPLATES: readonly BlueprintTemplateMeta[] = [
  {
    id: 'click-navigate',
    name: '点击跳转',
    description: '组件 A 的点击事件 → 跳转指定 URL',
    icon: Navigation,
  },
  {
    id: 'click-toggle-visibility',
    name: '显隐切换',
    description: '组件 A 的点击事件 → 切换组件 B 的显隐',
    icon: MousePointerClick,
  },
  {
    id: 'page-load-refresh',
    name: '页面加载刷新',
    description: '页面加载 → 刷新指定数据源组件',
    icon: RefreshCw,
  },
  {
    id: 'click-delay-show',
    name: '延时执行',
    description: '组件 A 的点击事件 → 延时后显示组件 B',
    icon: Timer,
  },
] as const;

/** 模板 ID → 元数据查找（O(n)，n=4 常量级） */
export function getTemplateMeta(id: BlueprintTemplateId): BlueprintTemplateMeta | undefined {
  return BLUEPRINT_TEMPLATES.find((t) => t.id === id);
}
