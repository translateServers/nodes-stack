/**
 * Delay blueprint node.
 *
 * 配色：amber（琥珀色）
 *
 * 引脚约定：
 * - 输入 `in`，输出 `out`（单输出）
 *
 * 显示规则：
 * - 显示延时时长（如 "延时 500ms"）
 * - 配置区可编辑 delayMs（由属性面板完成，节点本身不嵌入编辑器）
 * - cycle 标记：节点在执行流环中时橙色虚线边框
 *
 * delay 节点不参与 dangling 诊断（无 componentId 引用）。
 */

import type { JSX } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { BaseNodeShell } from './base-node';
import { useBlueprintDiagnosticMap } from '../hooks/blueprint-diagnostic-context';
import type { DelayNodeData } from './node-data-types';

/** React Flow 延时节点类型实例 */
export type DelayNode = Node<DelayNodeData, 'delay'>;

/** 延时节点 React Flow 组件 */
export function DelayNode({ id, data, selected }: NodeProps<DelayNode>): JSX.Element {
  const { config, label, inCycle } = data;

  // 从诊断上下文获取该节点的诊断等级（delay 节点仅有 invalid-delay 诊断）
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
      colorScheme="delay"
      nodeId={id}
      icon={<Clock className="size-3.5" />}
      typeLabel="延时"
      label={label}
      selected={selected}
      inCycle={inCycle}
      diagnosticLevel={diagnosticLevel}
      locating={locating}
      showInputHandle
      showOutputHandle
      outputHandleMode="single"
    >
      <div
        className="text-[11px] text-muted-foreground"
        data-delay-ms={config.delayMs}
        data-summary="delay"
      >
        {config.delayMs}ms
      </div>
    </BaseNodeShell>
  );
}
