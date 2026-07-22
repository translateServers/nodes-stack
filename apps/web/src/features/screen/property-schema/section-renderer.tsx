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

import { Fragment, useMemo, useState, type ComponentType } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
 * - 当 schema 涉及 2+ 个 tab 且无 customRender 分区时 → 使用 Tabs 容器（外观/数据/交互）
 * - 否则 → 平铺渲染所有分区（保留 bar-chart 等复杂组件的当前交互体验）
 *
 * Tabs 仅在纯声明式 schema 下启用，避免 customRender 分区被拆散到不同 tab
 * 导致内部 PanelSection 跨 tab 渲染（Radix TabsContent 仅渲染活跃 tab 内容）。
 */
export function PropertySchemaRenderer({
  schema,
  component,
  onUpdate,
}: {
  schema: PropertySchema;
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const { tabs, hasCustomRender } = useMemo(() => {
    const tabSet = new Set<PropertyTabId>();
    let hasCustom = false;
    for (const section of schema) {
      tabSet.add(section.tab);
      if (section.customRender) hasCustom = true;
    }
    return { tabs: [...tabSet], hasCustomRender: hasCustom };
  }, [schema]);

  const useTabs = tabs.length >= 2 && !hasCustomRender;

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
          {schema
            .filter((s) => s.tab === tab)
            .map((section) => (
              <PropertySectionRenderer
                key={section.id}
                section={section}
                component={component}
                onUpdate={onUpdate}
              />
            ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
