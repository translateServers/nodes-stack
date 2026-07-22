/**
 * 蓝图诊断订阅 hook（任务 6.1）
 *
 * 订阅蓝图（nodes/edges）变化，经 rAF 节流后调用编译器产出诊断。
 * 返回当前诊断列表及分级计数，供问题面板与节点标记使用。
 *
 * 节流策略：
 * - 使用 createRafThrottler 将高频编辑合并到下一动画帧
 * - 同一帧内多次蓝图变更仅编译一次
 * - 组件卸载时 cancel 挂起任务
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventBlueprint } from '@nebula/shared';
import { compileBlueprint, type Diagnostic } from '../compiler';
import { createRafThrottler } from '../../lib/raf-throttle';

interface UseBlueprintDiagnosticsOptions {
  blueprint: EventBlueprint | undefined;
  componentIds: Set<string>;
}

interface UseBlueprintDiagnosticsResult {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export function useBlueprintDiagnostics(
  options: UseBlueprintDiagnosticsOptions,
): UseBlueprintDiagnosticsResult {
  const { blueprint, componentIds } = options;
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const throttlerRef = useRef(createRafThrottler());

  const compile = useCallback(() => {
    if (!blueprint) {
      setDiagnostics([]);
      return;
    }
    const result = compileBlueprint(blueprint, { componentIds });
    setDiagnostics(result.diagnostics);
  }, [blueprint, componentIds]);

  useEffect(() => {
    throttlerRef.current.schedule(compile);
    return () => {
      throttlerRef.current.cancel();
    };
  }, [compile]);

  const errorCount = diagnostics.filter((d) => d.level === 'error').length;
  const warningCount = diagnostics.filter((d) => d.level === 'warning').length;
  const infoCount = diagnostics.filter((d) => d.level === 'info').length;

  return { diagnostics, errorCount, warningCount, infoCount };
}

export type { UseBlueprintDiagnosticsOptions, UseBlueprintDiagnosticsResult };
