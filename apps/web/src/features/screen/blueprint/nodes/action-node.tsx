/**
 * 动作节点（任务 4.2）
 *
 * 配色：绿色（emerald）
 * 类型：setVisibility / navigate / scrollToComponent / refreshDataSource
 *
 * 引脚约定（schema 注释）：
 * - 输入 `in`，输出 `out`（支持链式触发）
 *
 * 显示规则：
 * - 显示动作类型图标 + 目标组件名
 * - dangling 标记：targetComponentId 在项目中不存在时红色边框
 * - cycle 标记：节点在执行流环中时橙色虚线边框
 */

import type { JSX } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Crosshair, Eye, Globe, Navigation, RefreshCw } from 'lucide-react';
import { BaseNodeShell } from './base-node';
import { useBlueprintDiagnosticMap } from '../hooks/blueprint-diagnostic-context';
import type { ActionNodeData } from './node-data-types';

/** React Flow 动作节点类型实例 */
export type ActionNode = Node<ActionNodeData, 'action'>;

/** 动作类型 → 图标映射 */
function getActionIcon(config: ActionNodeData['config']): { icon: JSX.Element; typeLabel: string } {
  switch (config.type) {
    case 'setVisibility':
      return { icon: <Eye className="size-3.5" />, typeLabel: '设置可见性' };
    case 'navigate':
      return { icon: <Navigation className="size-3.5" />, typeLabel: '导航跳转' };
    case 'scrollToComponent':
      return {
        icon: <Crosshair className="size-3.5" />,
        typeLabel: '滚动定位',
      };
    case 'refreshDataSource':
      return { icon: <RefreshCw className="size-3.5" />, typeLabel: '刷新数据源' };
    case 'requestApi':
      return { icon: <Globe className="size-3.5" />, typeLabel: '请求接口' };
  }
}

/** 动作节点 React Flow 组件 */
export function ActionNode({ id, data, selected }: NodeProps<ActionNode>): JSX.Element {
  const { config, label, dangling, inCycle } = data;
  const { icon, typeLabel } = getActionIcon(config);

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

  const locating = (data as { locating?: boolean }).locating ?? false;

  return (
    <BaseNodeShell
      colorScheme="action"
      nodeId={id}
      icon={icon}
      typeLabel={typeLabel}
      label={label}
      selected={selected}
      dangling={dangling}
      inCycle={inCycle}
      diagnosticLevel={diagnosticLevel}
      locating={locating}
      showInputHandle={true}
      showOutputHandle={true}
    />
  );
}
