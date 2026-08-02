/**
 * V2 蓝图沙盒链路高亮状态机 Hook
 *
 * 基于 V2 沙盒运行时产出的 executionLogs 驱动链路高亮动画。
 *
 * 与 V1 useBlueprintSandboxHighlight 的差异：
 * - 输入为 V2RuleExecutionLog[]（多条规则，每条含 triggerNodeId + results）
 * - 派生执行路径合并所有规则的节点与边序列
 * - 边匹配沿用 V2 BlueprintEdgeV2 结构（source/target/sourceHandle/targetHandle）
 *
 * 状态机：
 *   idle ── executionLogs 变化 ──▶ animating
 *     (逐步推进 currentStep，每步亮起一个节点 + 对应边)
 *   animating ── 全部亮起后保持 HOLD_MS ──▶ idle（清空高亮）
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlueprintEdgeV2, EventBlueprintV2 } from '@nebula/shared';
import type { V2RuleExecutionLog } from './v2-types.js';

/** 单步间隔：每个节点亮起的间隔毫秒数 */
const STEP_INTERVAL_MS = 300;
/** 全部亮起后的保持时间，之后自动复位 */
const HOLD_MS = 1200;

/** V2 执行路径：节点 id 序列 + 边 id 序列（按执行顺序） */
export interface V2ExecutionPath {
  nodes: string[];
  edges: string[];
}

/**
 * 从 V2 执行日志派生执行路径。
 *
 * 合并多条规则的执行序列：每条规则的 nodes = [triggerNodeId, ...results.nodeIds]，
 * 边为相邻节点对在 blueprint.edges 中查到的边 id。
 *
 * 注意：V2 中相邻节点对可能通过 evt:* → act:* 直连（同节点对接，
 * source 和 target 不同节点），通过 in/then/else → act:* 经过逻辑节点中转。
 * 这里仅按 source/target 节点对匹配，不区分 handle。
 */
export function deriveV2ExecutionPath(
  logs: readonly V2RuleExecutionLog[],
  edges: readonly BlueprintEdgeV2[],
): V2ExecutionPath {
  if (logs.length === 0) return { nodes: [], edges: [] };

  const nodes: string[] = [];
  const edgeIds: string[] = [];

  for (const log of logs) {
    const logNodes = [log.triggerNodeId, ...log.results.map((r) => r.nodeId)];
    for (let i = 0; i < logNodes.length; i++) {
      nodes.push(logNodes[i]);
      if (i > 0) {
        const source = logNodes[i - 1];
        const target = logNodes[i];
        if (source !== undefined && target !== undefined) {
          const edge = edges.find((e) => e.source === source && e.target === target);
          if (edge) edgeIds.push(edge.id);
        }
      }
    }
  }

  return { nodes, edges: edgeIds };
}

/** V2 链路高亮状态机对外 API */
export interface BlueprintSandboxHighlightV2 {
  /** 当前亮起的节点 id 集合 */
  highlightedNodeIds: Set<string>;
  /** 当前亮起的边 id 集合 */
  highlightedEdgeIds: Set<string>;
  /** 是否正在执行高亮动画 */
  isAnimating: boolean;
  /** 当前动画步数：0=idle，N=已亮起 N 个节点 */
  currentStep: number;
  /** 总步数（路径节点数） */
  totalSteps: number;
}

/**
 * 构造 V2 链路高亮状态机。
 *
 * @param executionLogs  V2 沙盒运行时产出的执行日志
 * @param blueprint  当前 V2 蓝图（用于查找执行路径上的边）
 */
export function useBlueprintSandboxHighlightV2(
  executionLogs: readonly V2RuleExecutionLog[],
  blueprint: EventBlueprintV2 | undefined,
): BlueprintSandboxHighlightV2 {
  const edges = blueprint?.edges ?? [];

  // 派生执行路径
  const path = useMemo(() => deriveV2ExecutionPath(executionLogs, edges), [executionLogs, edges]);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const pathKey = `${path.nodes.join('|')}::${path.edges.join('|')}`;
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    const currentPath = pathRef.current;
    if (currentPath.nodes.length === 0) {
      setCurrentStep(0);
      setIsAnimating(false);
      return;
    }

    setCurrentStep(0);
    setIsAnimating(true);

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i <= currentPath.nodes.length; i++) {
      const t = setTimeout(() => {
        setCurrentStep(i);
      }, i * STEP_INTERVAL_MS);
      timers.push(t);
    }

    const resetTime = currentPath.nodes.length * STEP_INTERVAL_MS + HOLD_MS;
    const resetTimer = setTimeout(() => {
      setCurrentStep(0);
      setIsAnimating(false);
    }, resetTime);
    timers.push(resetTimer);

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [pathKey]);

  const highlightedNodeIds = useMemo(() => {
    return new Set(path.nodes.slice(0, currentStep));
  }, [path, currentStep]);

  const highlightedEdgeIds = useMemo(() => {
    if (currentStep <= 1) return new Set<string>();
    return new Set(path.edges.slice(0, currentStep - 1));
  }, [path, currentStep]);

  return {
    highlightedNodeIds,
    highlightedEdgeIds,
    isAnimating,
    currentStep,
    totalSteps: path.nodes.length,
  };
}
