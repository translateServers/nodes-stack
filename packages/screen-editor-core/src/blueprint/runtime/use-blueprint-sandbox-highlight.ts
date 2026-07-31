/**
 * 蓝图沙盒链路高亮状态机 Hook（任务 8.2）
 *
 * 基于沙盒运行时（任务 8.1）产出的 executionLogs 驱动链路高亮动画：
 * - 执行路径上的边呈现流动高亮动画
 * - 经过的节点依次亮起
 * - 动画结束自动复位
 *
 * 状态机：
 *   idle ── executionLogs 变化 ──▶ animating
 *     (逐步推进 currentStep，每步亮起一个节点 + 对应边)
 *   animating ── 全部亮起后保持 HOLD_MS ──▶ idle（清空高亮）
 *
 * 派生执行路径：
 * - nodes = [triggerNodeId, ...results.nodeIds]（按执行顺序）
 * - edges = 相邻节点对在 blueprint.edges 中查到的边 id
 *
 * 仅消费 8.1 产出的 executionLogs[0]（一次模拟一条规则）；多规则场景留待后续扩展。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlueprintEdge, EventBlueprint } from '@nebula/shared';
import type { RuleExecutionLog } from './types.js';

/** 单步间隔：每个节点亮起的间隔毫秒数 */
const STEP_INTERVAL_MS = 300;
/** 全部亮起后的保持时间，之后自动复位 */
const HOLD_MS = 1200;

/** 执行路径：节点 id 序列 + 边 id 序列（按执行顺序） */
export interface ExecutionPath {
  nodes: string[];
  edges: string[];
}

/** 从执行日志派生执行路径：nodes 按序，edges 为相邻节点对在 blueprint.edges 中的边 */
export function deriveExecutionPath(
  log: RuleExecutionLog | undefined,
  edges: readonly BlueprintEdge[],
): ExecutionPath {
  if (!log) return { nodes: [], edges: [] };
  const nodes = [log.triggerNodeId, ...log.results.map((r) => r.nodeId)];
  const edgeIds: string[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const source = nodes[i];
    const target = nodes[i + 1];
    if (source === undefined || target === undefined) continue;
    const edge = edges.find((e) => e.source === source && e.target === target);
    if (edge) edgeIds.push(edge.id);
  }
  return { nodes, edges: edgeIds };
}

/** 链路高亮状态机对外 API */
export interface BlueprintSandboxHighlight {
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
 * 构造链路高亮状态机。
 *
 * @param executionLogs  沙盒运行时产出的执行日志（取 logs[0]）
 * @param blueprint  当前蓝图（用于查找执行路径上的边）
 */
export function useBlueprintSandboxHighlight(
  executionLogs: readonly RuleExecutionLog[],
  blueprint: EventBlueprint | undefined,
): BlueprintSandboxHighlight {
  const edges = blueprint?.edges ?? [];

  // 派生执行路径（仅在 executionLogs[0] 或 edges 变化时重算）
  const path = useMemo(() => deriveExecutionPath(executionLogs[0], edges), [executionLogs, edges]);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // 路径签名：仅当路径内容（节点 + 边 id）变化时才重启动画，
  // 避免外层 executionLogs 引用变化（每次渲染新数组）导致 effect 重复触发。
  const pathKey = `${path.nodes.join('|')}::${path.edges.join('|')}`;
  // 通过 ref 暴露最新 path，供 effect 内部读取
  const pathRef = useRef(path);
  pathRef.current = path;

  // 动画推进：路径内容变化时启动定时器链
  useEffect(() => {
    const currentPath = pathRef.current;
    if (currentPath.nodes.length === 0) {
      // 无执行路径：保持 idle
      setCurrentStep(0);
      setIsAnimating(false);
      return;
    }

    // 重置为 0 并启动动画
    setCurrentStep(0);
    setIsAnimating(true);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // 逐步推进：step 从 1 到 nodes.length
    for (let i = 1; i <= currentPath.nodes.length; i++) {
      const t = setTimeout(() => {
        setCurrentStep(i);
      }, i * STEP_INTERVAL_MS);
      timers.push(t);
    }

    // 全部亮起后保持 HOLD_MS，然后复位到 idle
    const resetTime = currentPath.nodes.length * STEP_INTERVAL_MS + HOLD_MS;
    const resetTimer = setTimeout(() => {
      setCurrentStep(0);
      setIsAnimating(false);
    }, resetTime);
    timers.push(resetTimer);

    return () => {
      for (const t of timers) clearTimeout(t);
    };
    // 仅依赖路径签名，不依赖 path 对象引用
  }, [pathKey]);

  // 派生亮起集合
  const highlightedNodeIds = useMemo(() => {
    return new Set(path.nodes.slice(0, currentStep));
  }, [path, currentStep]);

  const highlightedEdgeIds = useMemo(() => {
    // step 个节点对应 step-1 条边；step<=1 时无边亮起
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
