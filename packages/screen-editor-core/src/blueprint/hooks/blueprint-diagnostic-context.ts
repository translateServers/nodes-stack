/**
 * 蓝图诊断上下文（任务 6.1）
 *
 * 将诊断映射（nodeId → BaseDiagnostic[]）通过 React Context 共享给节点组件，
 * 避免修改 ReactFlow nodes 数组触发蓝图同步。
 *
 * 节点组件通过 useBlueprintDiagnosticMap() 获取自身的诊断信息，
 * 渲染问题标记（边框颜色、图标等）。
 *
 * V1 与 V2 诊断结构兼容：均含 level + code + message + 可选 nodeId/edgeId。
 * V1 额外的 fieldPath 不被节点组件消费；V2 缺省 fieldPath。
 * 这里使用 BaseDiagnostic 作为最小公约类型，V1 Diagnostic 与 V2Diagnostic 均可赋值给它。
 */

import { createContext, useContext } from 'react';
import type { Diagnostic } from '../compiler';
import type { V2Diagnostic } from '../compiler/v2-types';

/**
 * 诊断最小公约类型：V1 Diagnostic 与 V2 V2Diagnostic 均可赋值。
 * - level：error / warning / info
 * - code：诊断码（V1 与 V2 的 code 枚举不同，统一为 string）
 * - message：面向用户可读消息
 * - nodeId? / edgeId?：定位到具体节点或边
 */
export interface BaseDiagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

/** nodeId → 该节点关联的诊断列表 */
export type DiagnosticMap = Map<string, BaseDiagnostic[]>;

const BlueprintDiagnosticMapContext = createContext<DiagnosticMap>(new Map());

export const BlueprintDiagnosticMapProvider = BlueprintDiagnosticMapContext.Provider;

export function useBlueprintDiagnosticMap(): DiagnosticMap {
  return useContext(BlueprintDiagnosticMapContext);
}

/**
 * 从 V1 诊断列表构建节点诊断映射。
 * 仅包含 nodeId 的诊断；edgeId 和 fieldPath 的诊断不映射到节点。
 */
export function buildDiagnosticMap(diagnostics: readonly Diagnostic[]): DiagnosticMap {
  const map: DiagnosticMap = new Map();
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

/**
 * 从 V2 诊断列表构建节点诊断映射。
 * 与 buildDiagnosticMap 同语义，仅入参类型不同（V2Diagnostic 缺省 fieldPath）。
 */
export function buildV2DiagnosticMap(diagnostics: readonly V2Diagnostic[]): DiagnosticMap {
  const map: DiagnosticMap = new Map();
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
