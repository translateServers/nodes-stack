/**
 * Global blueprint node.
 *
 * 全局节点是组件节点的子类型（componentId === 'global'），承载页面级触发与全局动作：
 * - pageLoad：页面加载触发，仅输出 evt:pageLoad 锚点
 * - navigate：全局导航动作，仅输入 act:navigate 锚点
 * - requestApi：全局请求接口动作，仅输入 act:requestApi 锚点
 * - scrollTo：全局滚动定位动作，仅输入 act:scrollTo 锚点
 *
 * 视觉特征：
 * - emerald 配色 + 虚线边框（与普通组件节点区分）
 * - Globe 图标
 * - 配置区显示 URL / method / targetComponentId 摘要
 *
 * 锚点派生策略：
 * - pageLoad：sourceAnchors = [{ id: 'evt:pageLoad', label: '页面加载' }]
 * - navigate：targetAnchors = [{ id: 'act:navigate', label: '导航跳转' }]
 * - requestApi：targetAnchors = [{ id: 'act:requestApi', label: '请求接口' }]
 * - scrollTo：targetAnchors = [{ id: 'act:scrollTo', label: '滚动定位' }]
 */

import type { JSX } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { BaseNodeShell, type AnchorDescriptor } from './base-node';
import { useBlueprintDiagnosticMap } from '../hooks/blueprint-diagnostic-context';
import type { GlobalNodeData } from './node-data-types';

/** React Flow 全局节点类型实例 */
export type GlobalNode = Node<GlobalNodeData, 'global'>;

/** 全局节点子类型标签与锚点配置 */
interface GlobalSubtypeConfig {
  /** 类型标签（显示在节点标题栏） */
  typeLabel: string;
  /** source 锚点列表（pageLoad 有；其他无） */
  sourceAnchors: AnchorDescriptor[];
  /** target 锚点列表（navigate/requestApi/scrollTo 有；pageLoad 无） */
  targetAnchors: AnchorDescriptor[];
}

/** 根据 globalType 返回子类型配置 */
function getGlobalSubtypeConfig(
  globalType: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval',
): GlobalSubtypeConfig {
  switch (globalType) {
    case 'pageLoad':
      return {
        typeLabel: '全局 · 页面加载',
        sourceAnchors: [{ id: 'evt:pageLoad', label: '页面加载' }],
        targetAnchors: [],
      };
    case 'navigate':
      return {
        typeLabel: '全局 · 导航跳转',
        sourceAnchors: [],
        targetAnchors: [{ id: 'act:navigate', label: '导航跳转' }],
      };
    case 'requestApi':
      return {
        typeLabel: '全局 · 请求接口',
        sourceAnchors: [],
        targetAnchors: [{ id: 'act:requestApi', label: '请求接口' }],
      };
    case 'scrollTo':
      return {
        typeLabel: '全局 · 滚动定位',
        sourceAnchors: [],
        targetAnchors: [{ id: 'act:scrollTo', label: '滚动定位' }],
      };
    case 'interval':
      return {
        typeLabel: '全局 · 定时触发',
        sourceAnchors: [{ id: 'evt:interval', label: '定时触发' }],
        targetAnchors: [],
      };
  }
}

/** 全局节点配置摘要（显示在节点正文） */
function GlobalNodeSummary({ data }: { data: GlobalNodeData }): JSX.Element | null {
  const { globalType, config } = data;
  if (globalType === 'pageLoad' || !config) return null;

  switch (config.globalType) {
    case 'navigate':
      return (
        <div className="space-y-0.5 text-[11px] text-muted-foreground" data-summary="navigate">
          <div className="truncate" title={config.url}>
            URL: {config.url || '（未设置）'}
          </div>
          <div>打开: {config.target === '_blank' ? '新标签页' : '当前页'}</div>
        </div>
      );
    case 'requestApi':
      return (
        <div className="space-y-0.5 text-[11px] text-muted-foreground" data-summary="requestApi">
          <div>
            {config.method} {config.url || '（未设置 URL）'}
          </div>
        </div>
      );
    case 'scrollTo':
      return (
        <div className="space-y-0.5 text-[11px] text-muted-foreground" data-summary="scrollTo">
          <div>目标: {config.targetComponentId || '（未设置）'}</div>
        </div>
      );
    case 'interval':
      return (
        <div className="space-y-0.5 text-[11px] text-muted-foreground" data-summary="interval">
          <div>间隔: {config.intervalMs}ms</div>
        </div>
      );
    default:
      return null;
  }
}

/** 全局节点 React Flow 组件 */
export function GlobalNode({ id, data, selected }: NodeProps<GlobalNode>): JSX.Element {
  const { globalType, label, dangling, inCycle } = data;

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

  const subtypeConfig = getGlobalSubtypeConfig(globalType);

  return (
    <BaseNodeShell
      colorScheme="component"
      nodeId={id}
      icon={<Globe className="size-3.5" />}
      typeLabel={subtypeConfig.typeLabel}
      label={label}
      selected={selected}
      dangling={dangling}
      inCycle={inCycle}
      diagnosticLevel={diagnosticLevel}
      locating={locating}
      showInputHandle={false}
      showOutputHandle={false}
      dashed
      dynamicAnchors={{
        sourceAnchors: subtypeConfig.sourceAnchors,
        targetAnchors: subtypeConfig.targetAnchors,
      }}
    >
      <GlobalNodeSummary data={data} />
    </BaseNodeShell>
  );
}
