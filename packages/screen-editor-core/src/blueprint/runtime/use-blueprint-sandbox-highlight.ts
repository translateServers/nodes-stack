import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlueprintEdge, EventBlueprint } from '@nebula/shared';

import type { RuleExecutionLog } from './types.js';

const stepIntervalMs = 300;
const holdMs = 1200;

export interface ExecutionPath {
  readonly nodes: string[];
  readonly edges: string[];
}

export function deriveExecutionPath(
  logs: readonly RuleExecutionLog[],
  edges: readonly BlueprintEdge[],
): ExecutionPath {
  const nodes: string[] = [];
  const edgeIds: string[] = [];
  for (const log of logs) {
    const logNodes = [log.triggerNodeId, ...log.results.map((result) => result.nodeId)];
    for (const [index, nodeId] of logNodes.entries()) {
      nodes.push(nodeId);
      const source = logNodes[index - 1];
      if (source !== undefined) {
        const edge = edges.find(
          (candidate) => candidate.source === source && candidate.target === nodeId,
        );
        if (edge !== undefined) {
          edgeIds.push(edge.id);
        }
      }
    }
  }
  return { nodes, edges: edgeIds };
}

export interface BlueprintSandboxHighlight {
  readonly highlightedNodeIds: Set<string>;
  readonly highlightedEdgeIds: Set<string>;
  readonly isAnimating: boolean;
  readonly currentStep: number;
  readonly totalSteps: number;
}

export function useBlueprintSandboxHighlight(
  executionLogs: readonly RuleExecutionLog[],
  blueprint: EventBlueprint | undefined,
): BlueprintSandboxHighlight {
  const path = useMemo(
    () => deriveExecutionPath(executionLogs, blueprint?.edges ?? []),
    [executionLogs, blueprint?.edges],
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const pathRef = useRef(path);
  pathRef.current = path;
  const pathKey = `${path.nodes.join('|')}::${path.edges.join('|')}`;

  useEffect(() => {
    const currentPath = pathRef.current;
    if (currentPath.nodes.length === 0) {
      setCurrentStep(0);
      setIsAnimating(false);
      return;
    }

    setCurrentStep(0);
    setIsAnimating(true);
    const timers = currentPath.nodes.map((_, index) =>
      setTimeout(() => setCurrentStep(index + 1), (index + 1) * stepIntervalMs),
    );
    timers.push(
      setTimeout(
        () => {
          setCurrentStep(0);
          setIsAnimating(false);
        },
        currentPath.nodes.length * stepIntervalMs + holdMs,
      ),
    );
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [pathKey]);

  return {
    highlightedNodeIds: useMemo(
      () => new Set(path.nodes.slice(0, currentStep)),
      [path, currentStep],
    ),
    highlightedEdgeIds: useMemo(
      () => new Set(path.edges.slice(0, Math.max(currentStep - 1, 0))),
      [path, currentStep],
    ),
    isAnimating,
    currentStep,
    totalSteps: path.nodes.length,
  };
}
