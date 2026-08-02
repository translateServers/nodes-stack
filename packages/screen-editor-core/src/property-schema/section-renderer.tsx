/**
 * 属性 Schema 渲染器（Phase 2 Slice B）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §4.2
 *
 * 三层渲染：
 * 1. PropertySchemaRenderer：按 tab 分组，决定是否使用 Tabs 容器
 * 2. PropertySectionRenderer：单个分区，声明式 fields 套 PanelSection；customRender 直接输出
 * 3. DeclarativeFieldRenderer：单个字段，从 FIELD_CONTROLS 查找控件并注入 value/onChange
 *
 * 单向数据流不变：所有 onChange → buildNestedUpdate → onUpdate → store.updateComponent
 */

import { Fragment, memo, useMemo, useState, type ComponentType, type JSX } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import {
  getPropByPointer,
  updatePropByPointer,
  type ScreenComponentJsonValue,
  type ScreenComponentProps,
} from '@nebula/screen-component-sdk';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nebula/screen-editor-core/internal';
import { PanelSection } from '../components/ui-primitives';
import { FIELD_CONTROLS } from './field-controls';
import { buildNestedUpdate, getByPath } from './path-utils';
import {
  TAB_LABELS,
  type FieldControlProps,
  type PropertyField,
  type PropertySchema,
  type PropertySection,
  type PropertyTabId,
} from './types';

/** 单个声明式字段渲染器 */
function DeclarativeFieldRenderer({
  field,
  component,
  onUpdate,
}: {
  field: Extract<PropertyField, { kind: 'field' }>;
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  // visibleWhen=false 时该字段不渲染
  if (field.visibleWhen && !field.visibleWhen(component)) {
    return null;
  }

  const Control = FIELD_CONTROLS[field.control] as
    | ComponentType<FieldControlProps<unknown> & Record<string, unknown>>
    | undefined;
  if (!Control) {
    // 未注册的控件名：开发期错误提示，不抛（避免整个面板崩溃）
    return <div className="text-xs text-red-400">未知控件: {field.control}</div>;
  }

  const rawValue = getByPath(component, field.path);
  const value = rawValue ?? field.defaultValue;

  const controlProps = field.controlProps ?? {};

  return (
    <Control
      value={value}
      onChange={(v: unknown) => {
        const update = buildNestedUpdate(
          component as unknown as Record<string, unknown>,
          field.path,
          v,
        ) as Partial<ScreenComponent>;
        onUpdate(update);
      }}
      label={field.label}
      syncKey={`${component.id}:${field.path}`}
      {...controlProps}
    />
  );
}

/**
 * Manifest 驱动字段渲染器（Task 3.2：Spec §7.4）
 *
 * 与 DeclarativeFieldRenderer 的区别：
 * - 使用 RFC 6901 JSON Pointer（相对 `component.props`）取值/更新
 * - 读取从 `component.props` 取值，而非从 component 顶层
 * - 更新通过 `updatePropByPointer` 产生新 props，提交 `{ props: newProps }`
 * - prototype pollution / 非法 pointer 在 updatePropByPointer 内抛错，此处 catch 静默忽略
 */
function ManifestFieldRenderer({
  field,
  component,
  onUpdate,
}: {
  field: Extract<PropertyField, { kind: 'manifest-field' }>;
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const Control = FIELD_CONTROLS[field.control] as
    | ComponentType<FieldControlProps<unknown> & Record<string, unknown>>
    | undefined;
  if (!Control) {
    return <div className="text-xs text-red-400">未知控件: {field.control}</div>;
  }

  const rawValue = getPropByPointer(component.props as ScreenComponentProps, field.pointer);
  // manifest 没有 field-level defaultValue；默认值由 manifest.defaultProps 提供，
  // 在组件创建时已写入 component.props。若 pointer 不存在则 rawValue 为 undefined，
  // 由各控件自行处理（NumberInput → 0, ColorInput/TextInput → '', Switch → false）。
  const value = rawValue;

  const controlProps = field.controlProps ?? {};

  return (
    <Control
      value={value}
      onChange={(v: unknown) => {
        try {
          const newProps = updatePropByPointer(
            component.props as ScreenComponentProps,
            field.pointer,
            v as ScreenComponentJsonValue,
          );
          onUpdate({ props: newProps });
        } catch {
          // pointer 非法或 prototype pollution：静默忽略，不写入 Store
        }
      }}
      label={field.label}
      syncKey={`${component.id}:props${field.pointer}`}
      {...controlProps}
    />
  );
}

/** 单个分区渲染器 */
function PropertySectionRenderer({
  section,
  component,
  onUpdate,
}: {
  section: PropertySection;
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const ctx = { component, onUpdate };

  // customRender 逃生舱：返回内容直接输出，不套 PanelSection
  // 适用于 bar-chart 等内部自行渲染多个 PanelSection 的复杂编辑器
  if (section.customRender) {
    return <>{section.customRender(ctx)}</>;
  }

  return (
    <PanelSection
      title={section.title}
      collapsible={section.collapsible}
      defaultOpen={section.defaultOpen}
      testId={section.testId}
      contentClassName={section.contentClassName}
    >
      {(section.fields ?? []).map((field, idx) => {
        if (field.kind === 'custom') {
          return <Fragment key={idx}>{field.render(ctx)}</Fragment>;
        }
        if (field.kind === 'manifest-field') {
          return (
            <ManifestFieldRenderer
              key={`manifest:${field.pointer}`}
              field={field}
              component={component}
              onUpdate={onUpdate}
            />
          );
        }
        return (
          <DeclarativeFieldRenderer
            key={field.path}
            field={field}
            component={component}
            onUpdate={onUpdate}
          />
        );
      })}
    </PanelSection>
  );
}

/**
 * 属性 Schema 渲染器入口。
 *
 * 渲染策略：
 * - 当 schema 涉及 2+ 个 tab 时 → 始终使用 Tabs 容器（外观/数据/交互/事件）
 * - 否则 → 平铺渲染所有分区（单 tab 无需切换）
 *
 * customRender 分区按其 `tab` 字段归入对应 tab；其内部自行渲染的 PanelSection
 * 随分区整体挂载到该 tab 的 TabsContent 下（Radix TabsContent 仅渲染活跃 tab 内容）。
 */
/**
 * 性能优化（2026-07-26）：memo 化 PropertySchemaRenderer。
 *
 * 配合 PropertyPanel 的 useState + useEffect 推迟渲染策略：
 * - 切换选中时，PropertyPanel 第一次渲染用旧 renderedIds，派生的 selectedComponent
 *   引用未变（components 数组未变，find 返回同引用）→ memo bail out → 跳过渲染（开销小）
 * - useEffect 触发第二次渲染，用新 renderedIds，selectedComponent 引用变化
 *   → memo 触发渲染 → 渲染新组件字段（开销大，但只渲染一次，且在下一个 macrotask）
 *
 * 默认 Object.is 比较即可满足需求（schema / component / onUpdate 引用稳定时跳过）。
 * - schema 在 PropertyPanel 中由 useMemo 派生（依赖 selectedComponent），引用稳定
 * - onUpdate 由 useCallback 包装，引用稳定
 * - component 引用每次 find 调用都返回数组元素引用，引用稳定（除非 components 数组变化）
 */
export const PropertySchemaRenderer = memo(function PropertySchemaRenderer({
  schema,
  component,
  onUpdate,
}: {
  schema: PropertySchema;
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const tabs = useMemo(() => {
    const tabSet = new Set<PropertyTabId>();
    for (const section of schema) {
      tabSet.add(section.tab);
    }
    return [...tabSet];
  }, [schema]);

  const useTabs = tabs.length >= 2;

  const [activeTab, setActiveTab] = useState<PropertyTabId>(tabs[0] ?? 'appearance');

  if (!useTabs) {
    return (
      <>
        {schema.map((section) => (
          <PropertySectionRenderer
            key={section.id}
            section={section}
            component={component}
            onUpdate={onUpdate}
          />
        ))}
      </>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as PropertyTabId)}
      className="flex h-full min-w-0 flex-1 flex-col"
    >
      <div className="border-b border-border p-1.5">
        <TabsList className="h-8 w-full">
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="text-xs">
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab} value={tab}>
          {schema.reduce<JSX.Element[]>((acc, section) => {
            if (section.tab === tab) {
              acc.push(
                <PropertySectionRenderer
                  key={section.id}
                  section={section}
                  component={component}
                  onUpdate={onUpdate}
                />,
              );
            }
            return acc;
          }, [])}
        </TabsContent>
      ))}
    </Tabs>
  );
});
