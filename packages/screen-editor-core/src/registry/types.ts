/**
 * 组件模块统一接口（Spec 驱动改造：组件库统一注册接口）
 *
 * 一个 ComponentModule 聚合组件的 4 类元信息：
 * - definition：组件定义（type/name/category/defaultProps/defaultStyle/events/actions 等）
 * - renderer：渲染组件（接收 props/style 等渲染所需数据）
 * - schema：属性面板 Schema（可选；未注册时回退 DEFAULT_SCHEMA）
 * - icon：lucide 图标组件（可选；未注册时回退 DEFAULT_ICON）
 *
 * 设计目的：将原本散落在 4 处的手动同步注册
 * （COMPONENT_DEFINITIONS / RENDERERS / ICON_MAP / PROPERTY_SCHEMAS）
 * 收敛为单一 ComponentModule 声明，内置组件由固定模块清单派生。
 */

import type { ComponentDefinition, ComponentStyle } from '@nebula/shared';
import type { PropertySchema } from '../property-schema/types';
import type { LucideIcon } from 'lucide-react';

export interface ComponentModule {
  /** 组件定义（type 唯一） */
  definition: ComponentDefinition;
  /**
   * 渲染组件。
   *
   * renderer 统一入参的最小子集（与 registry/renderer.tsx 的 RendererComponentProps 保持一致）：
   * - componentId：组件运行时身份标识（事件蓝图修复：用于派发 dataLoaded / dataError 等事件）
   * - props：组件业务属性（如 text 的 content、bar-chart 的 title）
   * - style：组件样式（与 @nebula/shared 的 ComponentStyle 对齐）
   *
   * 图表类组件的 renderer 实际接收更多字段（dataSource / logic / interaction / apiRawDataOverride），
   * 这些字段在 RendererComponentProps 中均为 optional，因此图表 renderer 仍可赋值给此类型。
   */
  renderer: React.ComponentType<{
    componentId: string;
    props: Record<string, unknown>;
    style: ComponentStyle;
  }>;
  /** 内部 Custom Element constructor；用于逐步迁移内置组件到组件 ABI。 */
  customElementConstructor?: CustomElementConstructor;
  /** 属性面板 Schema（可选；未注册时回退 DEFAULT_SCHEMA） */
  schema?: PropertySchema;
  /** lucide 图标组件（可选；未注册时回退 DEFAULT_ICON） */
  icon?: LucideIcon;
}
