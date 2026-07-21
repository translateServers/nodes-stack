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
import { Crosshair, Eye, Navigation, RefreshCw } from 'lucide-react';
import { BaseNodeShell } from './base-node';
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
  }
}

/** 动作节点 React Flow 组件 */
export function ActionNode({ data, selected }: NodeProps<ActionNode>): JSX.Element {
  const { config, label, dangling, inCycle } = data;
  const { icon, typeLabel } = getActionIcon(config);

  return (
    <BaseNodeShell
      colorScheme="action"
      icon={icon}
      typeLabel={typeLabel}
      label={label}
      selected={selected}
      dangling={dangling}
      inCycle={inCycle}
      showInputHandle={true}
      showOutputHandle={true}
    />
  );
}
