/**
 * 注释节点（任务 4.2）
 *
 * 配色：灰色（gray）
 *
 * 引脚约定（schema 注释）：
 * - 无引脚（不参与执行流）
 *
 * 显示规则：
 * - 显示注释文本（config.text）
 * - 无 dangling / cycle 标记态
 * - 不参与编译执行（编译器仅产出 info 诊断）
 */

import type { JSX } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { BaseNodeShell } from './base-node';
import { useBlueprintDiagnosticMap } from '../hooks/blueprint-diagnostic-context';
import type { CommentNodeData } from './node-data-types';

/** React Flow 注释节点类型实例 */
export type CommentNode = Node<CommentNodeData, 'comment'>;

/** 注释节点 React Flow 组件 */
export function CommentNode({ id, data, selected }: NodeProps<CommentNode>): JSX.Element {
  const { label } = data;

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
      colorScheme="comment"
      nodeId={id}
      icon={<MessageSquare className="size-3.5" />}
      typeLabel="注释"
      label={label}
      selected={selected}
      diagnosticLevel={diagnosticLevel}
      locating={locating}
      showInputHandle={false}
      showOutputHandle={false}
    />
  );
}
