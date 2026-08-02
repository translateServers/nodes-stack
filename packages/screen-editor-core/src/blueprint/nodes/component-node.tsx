/**
 * Component blueprint node.
 *
 * 配色：emerald（绿色），体现"组件即节点"理念
 *
 * 动态锚点约定：
 * - source 锚点（左侧）：每个事件一个 Handle，id=`evt:{eventId}`
 * - target 锚点（右侧）：每个动作一个 Handle，id=`act:{actionId}`
 * - 锚点列表从组件注册表派生（getComponentEvents / getComponentActions）
 * - 未声明组件类型的回退到 DEFAULT_EVENTS / DEFAULT_ACTIONS
 *
 * 显示规则：
 * - 节点标题栏：组件图标 + 组件类型标签 + 组件实例名（label）
 * - 节点正文：事件/动作锚点标签列表（彩色 chip）
 * - dangling 标记：componentId 不存在于项目中时红色边框
 * - cycle 标记：节点在执行流环中时橙色虚线边框
 *
 * 普通组件节点不渲染虚线边框（仅全局节点启用虚线）。
 */

import type { JSX } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Component } from 'lucide-react';
import { BaseNodeShell, type AnchorDescriptor } from './base-node';
import { useBlueprintDiagnosticMap } from '../hooks/blueprint-diagnostic-context';
import type { ComponentNodeData } from './node-data-types';
// Spec §13.2 Phase 1, Task 1.5：从实例注册表派生 events/actions，
// registry 为 null（测试或无 Provider）时回退到模块级 getComponentEvents/getComponentActions。
import {
  getComponentActionsFromRegistry,
  getComponentEventsFromRegistry,
} from '../../registry/registry-derive';
import { useOptionalRegistry } from '../../registry/registry-context';
import { useOptionalScreenEditorEnvironment } from '../../components/screen-editor-environment';

/** React Flow 组件节点类型实例 */
export type ComponentNode = Node<ComponentNodeData, 'component'>;

/**
 * 从组件类型派生事件/动作锚点列表。
 *
 * - componentType 缺省时回退到空锚点列表
 * - registry 非空时从实例注册表派生，registry 为 null 时回退到模块级 legacy 函数
 * - staticOnly=true 时仅保留 click/hover 事件与 show/hide/toggleVisibility 动作
 *   （静态预览模式裁剪）
 */
function deriveAnchors(
  componentType: string | undefined,
  staticOnly: boolean,
  registry: ReturnType<typeof useOptionalRegistry>,
): {
  events: AnchorDescriptor[];
  actions: AnchorDescriptor[];
} {
  if (!componentType) {
    return { events: [], actions: [] };
  }
  const componentEvents = getComponentEventsFromRegistry(registry, componentType);
  const componentActions = getComponentActionsFromRegistry(registry, componentType);
  const events = componentEvents
    .filter((event) => !staticOnly || event.id === 'click' || event.id === 'hover')
    .map((e) => ({
      id: `evt:${e.id}`,
      label: e.name,
    }));
  const actions = componentActions
    .filter((action) => !staticOnly || ['show', 'hide', 'toggleVisibility'].includes(action.id))
    .map((a) => ({
      id: `act:${a.id}`,
      label: a.name,
    }));
  return { events, actions };
}

/** 组件节点 React Flow 组件 */
export function ComponentNode({ id, data, selected }: NodeProps<ComponentNode>): JSX.Element {
  const { componentType, label, dangling, inCycle } = data;
  const staticOnly = useOptionalScreenEditorEnvironment()?.capabilityProfile === 'static';
  // Spec §13.2 Phase 1, Task 1.5：读取实例注册表，未在 Provider 内时为 null（回退到 legacy）
  const registry = useOptionalRegistry();

  // 从诊断上下文获取该节点的诊断等级
  const diagnosticMap = useBlueprintDiagnosticMap();
  const nodeDiagnostics = diagnosticMap.get(id);
  const diagnosticLevel = nodeDiagnostics
    ? nodeDiagnostics.reduce<'error' | 'warning' | 'info' | null>((highest, d) => {
        if (d.level === 'error') return 'error';
        if (d.level === 'warning' && highest !== 'error') return 'warning';
        if (d.level === 'info' && highest == null) return 'info';
        return highest;
      }, null)
    : null;

  const locating = (data as { locating?: boolean }).locating ?? false;

  // 派生事件/动作锚点
  const { events, actions } = deriveAnchors(componentType, staticOnly, registry);

  return (
    <BaseNodeShell
      colorScheme="component"
      nodeId={id}
      icon={<Component className="size-3.5" />}
      typeLabel={componentType ? `组件 · ${componentType}` : '组件'}
      label={label}
      selected={selected}
      dangling={dangling}
      inCycle={inCycle}
      diagnosticLevel={diagnosticLevel}
      locating={locating}
      showInputHandle={false}
      showOutputHandle={false}
      dynamicAnchors={{ sourceAnchors: events, targetAnchors: actions }}
    />
  );
}
