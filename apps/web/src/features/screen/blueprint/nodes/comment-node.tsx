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
import type { CommentNodeData } from './node-data-types';

/** React Flow 注释节点类型实例 */
export type CommentNode = Node<CommentNodeData, 'comment'>;

/** 注释节点 React Flow 组件 */
export function CommentNode({ data, selected }: NodeProps<CommentNode>): JSX.Element {
  const { label } = data;

  return (
    <BaseNodeShell
      colorScheme="comment"
      icon={<MessageSquare className="size-3.5" />}
      typeLabel="注释"
      label={label}
      selected={selected}
      showInputHandle={false}
      showOutputHandle={false}
    />
  );
}
