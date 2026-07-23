/**
 * 条件节点（任务 10.2）
 *
 * 配色：紫色（purple）
 *
 * 引脚约定（schema 注释）：
 * - 输入 `in`，输出 `then` / `else` 双输出引脚
 *
 * 显示规则：
 * - 显示条件表达式摘要：<source.kind> <operator> <value>
 * - 节点正文右侧渲染两个输出引脚标签（THEN / ELSE）
 * - dangling 标记：condition 引用的 componentId 在项目中不存在时红色边框
 * - cycle 标记：节点在执行流环中时橙色虚线边框
 *
 * 节点本身不嵌入表达式构建器（避免节点高度膨胀）：
 * - 表达式编辑通过属性面板（InspectorPanel）完成，任务 10.2 仅提供节点视图与引脚
 */

import type { JSX } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { ConditionNodeConfig, ConditionOperator } from '@nebula/shared';
import { BaseNodeShell } from './base-node';
import { useBlueprintDiagnosticMap } from '../hooks/blueprint-diagnostic-context';
import type { ConditionNodeData } from './node-data-types';

/** React Flow 条件节点类型实例 */
export type ConditionNode = Node<ConditionNodeData, 'condition'>;

/** 操作符中文标签 */
const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: '等于',
  ne: '不等于',
  gt: '大于',
  gte: '大于等于',
  lt: '小于',
  lte: '小于等于',
  contains: '包含',
  empty: '为空',
  notEmpty: '非空',
};

/** 字段来源中文标签 */
function describeSource(source: ConditionNodeConfig['expression']['source']): string {
  if (source.kind === 'componentProp') {
    return `属性 ${source.key || '?'}`;
  }
  return `数据 ${source.path || '?'}`;
}

/** 格式化比较值为字符串展示 */
function formatValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === '') return '∅';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/** 生成条件表达式摘要 */
export function summarizeCondition(config: ConditionNodeConfig): string {
  const { expression } = config;
  const sourceLabel = describeSource(expression.source);
  const opLabel = OPERATOR_LABELS[expression.operator];
  // empty / notEmpty 无需比较值
  if (expression.operator === 'empty' || expression.operator === 'notEmpty') {
    return `${sourceLabel} ${opLabel}`;
  }
  return `${sourceLabel} ${opLabel} ${formatValue(expression.value)}`;
}

/** 条件节点 React Flow 组件 */
export function ConditionNode({ id, data, selected }: NodeProps<ConditionNode>): JSX.Element {
  const { config, dangling, inCycle } = data;
  const label = summarizeCondition(config);

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
      colorScheme="condition"
      nodeId={id}
      icon={<GitBranch className="size-3.5" />}
      typeLabel="条件分支"
      label={label}
      selected={selected}
      dangling={dangling}
      inCycle={inCycle}
      diagnosticLevel={diagnosticLevel}
      locating={locating}
      showInputHandle={true}
      showOutputHandle={true}
      outputHandleMode="then-else"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="font-medium text-emerald-600 dark:text-emerald-400">THEN</span>
        <span className="font-medium text-rose-600 dark:text-rose-400">ELSE</span>
      </div>
    </BaseNodeShell>
  );
}
