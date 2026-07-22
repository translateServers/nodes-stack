/**
 * 触发器节点（任务 4.2）
 *
 * 配色：琥珀色（amber）
 * 类型：componentClick / pageLoad
 *
 * 引脚约定（schema 注释）：
 * - 仅输出 `out`（无输入引脚）
 *
 * 显示规则：
 * - componentClick：显示 "点击：<componentName>"
 * - pageLoad：显示 "页面加载"
 * - dangling 标记：componentId 在项目中不存在时红色边框
 * - cycle 标记：节点在执行流环中时橙色虚线边框
 */

import type { JSX } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { MousePointerClick, FileText } from 'lucide-react';
import { BaseNodeShell } from './base-node';
import { useBlueprintDiagnosticMap } from '../hooks/blueprint-diagnostic-context';
import type { TriggerNodeData } from './node-data-types';

/** React Flow 触发器节点类型实例 */
export type TriggerNode = Node<TriggerNodeData, 'trigger'>;

/** 触发器节点 React Flow 组件 */
export function TriggerNode({ id, data, selected }: NodeProps<TriggerNode>): JSX.Element {
  const { config, label, dangling, inCycle } = data;

  // 任务 6.1：从诊断上下文获取该节点的诊断等级
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

  // 任务 6.2：定位闪烁标记（由 BlueprintSheet 通过 data 传入）
  const locating = (data as { locating?: boolean }).locating ?? false;

  // 根据触发器类型选择图标与类型标签
  const icon =
    config.type === 'componentClick' ? (
      <MousePointerClick className="size-3.5" />
    ) : (
      <FileText className="size-3.5" />
    );
  const typeLabel = config.type === 'componentClick' ? '点击触发' : '页面加载';

  return (
    <BaseNodeShell
      colorScheme="trigger"
      icon={icon}
      typeLabel={typeLabel}
      label={label}
      selected={selected}
      dangling={dangling}
      inCycle={inCycle}
      diagnosticLevel={diagnosticLevel}
      locating={locating}
      showInputHandle={false}
      showOutputHandle={true}
    />
  );
}
