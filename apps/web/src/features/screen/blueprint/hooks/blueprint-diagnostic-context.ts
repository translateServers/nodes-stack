/**
 * 蓝图诊断上下文（任务 6.1）
 *
 * 将诊断映射（nodeId → Diagnostic[]）通过 React Context 共享给节点组件，
 * 避免修改 ReactFlow nodes 数组触发蓝图同步。
 *
 * 节点组件通过 useBlueprintDiagnosticMap() 获取自身的诊断信息，
 * 渲染问题标记（边框颜色、图标等）。
 */

import { createContext, useContext } from 'react';
import type { Diagnostic } from '../compiler';

/** nodeId → 该节点关联的诊断列表 */
export type DiagnosticMap = Map<string, Diagnostic[]>;

const BlueprintDiagnosticMapContext = createContext<DiagnosticMap>(new Map());

export const BlueprintDiagnosticMapProvider = BlueprintDiagnosticMapContext.Provider;

export function useBlueprintDiagnosticMap(): DiagnosticMap {
  return useContext(BlueprintDiagnosticMapContext);
}

/**
 * 从诊断列表构建节点诊断映射。
 * 仅包含 nodeId 的诊断；edgeId 和 fieldPath 的诊断不映射到节点。
 */
export function buildDiagnosticMap(diagnostics: Diagnostic[]): DiagnosticMap {
  const map = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    if (d.nodeId) {
      const existing = map.get(d.nodeId);
      if (existing) {
        existing.push(d);
      } else {
        map.set(d.nodeId, [d]);
      }
    }
  }
  return map;
}
