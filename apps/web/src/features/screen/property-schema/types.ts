/**
 * 属性面板 Schema 类型定义（Phase 2 Slice B）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §4 属性面板目标架构。
 *
 * 三层结构：
 * - PropertySchema → PropertySection[]（按 tab 分组）
 * - PropertySection → 声明式字段列表 | 自定义渲染逃生舱
 * - PropertyField → DeclarativeField（声明式）| CustomField（逃生舱字段）
 *
 * 单向数据流不变：所有写入经 SectionRenderContext.onUpdate → store.updateComponent。
 */

import type { ReactNode } from 'react';
import type { ScreenComponent } from '@nebula/shared';

/** 属性面板 Tab 标识（按组件类型动态显隐） */
export type PropertyTabId = 'appearance' | 'data' | 'interaction' | 'events';

/** Tab 显示标签 */
export const TAB_LABELS: Record<PropertyTabId, string> = {
  appearance: '外观',
  data: '数据',
  interaction: '交互',
  events: '事件',
};

/** 字段控件统一契约：所有控件实现此接口后注册进 FIELD_CONTROLS */
export interface FieldControlProps<T = unknown> {
  /** 当前值（受控） */
  value: T;
  /** 值变更回调 */
  onChange: (v: T) => void;
  /** 标签文本 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /**
   * 同步键（NumberInput draft 重置用）：由渲染器注入 `${componentId}:${path}`，
   * 切换选中对象/字段时丢弃当前 draft，避免把上一对象的草稿带入下一对象。
   */
  syncKey?: string;
}

/** 字段控件组件类型：接受 FieldControlProps + 透传的 controlProps */
export type FieldControlComponent = React.ComponentType<
  FieldControlProps<unknown> & Record<string, unknown>
>;

/** 声明式字段：描述"取哪个路径、用什么控件、控件参数" */
export interface DeclarativeField {
  kind: 'field';
  /** FIELD_CONTROLS 注册名：'number' | 'color' | 'text' | 'textarea' | 'select' | 'switch' */
  control: string;
  /** 标签文本 */
  label: string;
  /** 组件上的取值路径，如 'style.fontSize'、'position.width' */
  path: string;
  /** 读取为空时的兜底值 */
  defaultValue?: unknown;
  /** min/max/step/options 等透传给控件 */
  controlProps?: Record<string, unknown>;
  /** 条件显隐：返回 false 时该字段不渲染 */
  visibleWhen?: (component: ScreenComponent) => boolean;
}

/** 自定义字段逃生舱：用于 KV 编辑器等无法声明式描述的复杂字段 */
export interface CustomField {
  kind: 'custom';
  /** 自定义渲染：返回 ReactNode 插入到所在 PanelSection 内部 */
  render: (ctx: SectionRenderContext) => ReactNode;
}

export type PropertyField = DeclarativeField | CustomField;

/** Section 渲染上下文：传递给 customRender / CustomField.render */
export interface SectionRenderContext {
  /** 当前选中组件 */
  component: ScreenComponent;
  /** 更新回调（写入走 store.updateComponent，单向数据流不变） */
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}

/**
 * 属性分区：一个可折叠的 PanelSection。
 *
 * - `fields` 模式：声明式字段列表，渲染器套 PanelSection + 两栏栅格字段。
 * - `customRender` 模式：逃生舱，返回内容直接插入 tab（不套 PanelSection），
 *   适用于 bar-chart 等内部自行渲染多个 PanelSection 的复杂编辑器。
 *
 * `fields` 与 `customRender` 互斥。
 */
export interface PropertySection {
  /** 分区唯一标识 */
  id: string;
  /** 分区标题（fields 模式下渲染到 PanelSection 标题栏；customRender 模式忽略） */
  title: string;
  /** 所属 Tab */
  tab: PropertyTabId;
  /** 是否可折叠，默认 false */
  collapsible?: boolean;
  /** 可折叠时的初始展开状态，默认 true */
  defaultOpen?: boolean;
  /** 声明式字段列表（与 customRender 互斥） */
  fields?: PropertyField[];
  /** 自定义渲染逃生舱（与 fields 互斥） */
  customRender?: (ctx: SectionRenderContext) => ReactNode;
  /** E2E/单测定位用 data-testid（渲染在 section 根节点上） */
  testId?: string;
  /** 内容区额外 className */
  contentClassName?: string;
}

/** 每类组件一份 Schema；未注册的组件类型回退到通用 Schema（位置尺寸+样式） */
export type PropertySchema = PropertySection[];
