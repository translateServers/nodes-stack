/**
 * V2 蓝图沙盒运行时 Hook
 *
 * 在 Sheet 内对选中的组件节点执行模拟触发（按组件 ID + 事件 ID 匹配规则），
 * 沙盒运行时独立于预览/画布真实状态。
 *
 * 与 V1 useBlueprintSandboxRuntime 的差异：
 * - 使用 compileBlueprintV2 编译，规则结构为 V2CompiledRule
 * - 触发事件为 V2TriggerEvent（componentEvent / pageLoad），按选中节点派生
 * - 错误级诊断拒绝：组件节点存在 error 级诊断时拒绝执行
 *
 * 隔离策略（与 V1 一致）：
 * - applyVisibility / getVisibility：读写本 Hook 内部独立的 sandboxVisibilityOverrides
 * - openUrl / scrollToComponent / refreshDataSource：no-op
 * - hasComponent：只读真实 components 引用
 * - logWarning：与预览运行时一致
 *
 * 产物：
 * - executionLogs：最新一次模拟的规则执行日志
 * - executedNodeIds：最新一次模拟涉及的节点 id 集合
 * - sandboxVisibilityOverrides：累积直至 resetSandbox
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { EventBlueprintV2, ScreenComponent } from '@nebula/shared';
import { GLOBAL_COMPONENT_ID } from '@nebula/shared';
import { compileBlueprintV2 } from '../compiler/v2-compile.js';
import type { V2CompiledRule, V2CompileResult, V2Diagnostic } from '../compiler/v2-types.js';
import { executeV2Rule } from './v2-executor.js';
import type {
  V2ActionResult,
  V2RuleExecutionLog,
  V2RuntimeDeps,
  V2TriggerEvent,
} from './v2-types.js';

/** 模拟触发结果 */
export interface V2SandboxSimulationResult {
  /** 触发的规则日志（按编译顺序；可能为多条规则） */
  logs: V2RuleExecutionLog[];
  /** 是否因 trigger 不存在而失败（无匹配规则） */
  triggerNotFound: boolean;
  /** 是否因 error 级诊断被拒绝执行 */
  refused: boolean;
  /** 拒绝原因（refused=true 时有值） */
  refusalReason?: string;
}

/** V2 沙盒运行时对外 API */
export interface BlueprintSandboxRuntimeV2 {
  /** 对指定节点 + 事件执行模拟触发 */
  simulateEvent: (nodeId: string, eventId: string) => Promise<V2SandboxSimulationResult>;
  /** 最新一次模拟的规则执行日志 */
  executionLogs: V2RuleExecutionLog[];
  /** 沙盒可见性覆盖表 */
  sandboxVisibilityOverrides: Map<string, boolean>;
  /** 最新一次模拟涉及的节点 id 集合 */
  executedNodeIds: Set<string>;
  /** 是否正在执行模拟 */
  isSimulating: boolean;
  /** 重置沙盒状态 */
  resetSandbox: () => void;
  /** 当前编译结果 */
  compiledRules: V2CompiledRule[];
  /** 当前编译诊断列表 */
  compileDiagnostics: V2Diagnostic[];
}

/**
 * 构造 V2 沙盒运行时。
 *
 * @param blueprint  当前 V2 蓝图（可能为 undefined）
 * @param components  当前项目组件列表（只读）
 */
export function useBlueprintSandboxRuntimeV2(
  blueprint: EventBlueprintV2 | undefined,
  components: readonly ScreenComponent[],
): BlueprintSandboxRuntimeV2 {
  // 编译蓝图
  const compileResult = useMemo<V2CompileResult | null>(() => {
    if (!blueprint) return null;
    const componentIds = new Set(components.map((c) => c.id));
    return compileBlueprintV2(blueprint, { componentIds });
  }, [blueprint, components]);

  const compiledRules = compileResult?.rules ?? [];
  const compileDiagnostics = compileResult?.diagnostics ?? [];

  // 沙盒独立的可见性覆盖表
  const [sandboxVisibilityOverrides, setSandboxVisibilityOverrides] = useState<
    Map<string, boolean>
  >(() => new Map());

  const [executionLogs, setExecutionLogs] = useState<V2RuleExecutionLog[]>([]);
  const [executedNodeIds, setExecutedNodeIds] = useState<Set<string>>(() => new Set());
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // ref 镜像高频变化的非 primitive state
  const componentsRef = useRef(components);
  componentsRef.current = components;
  const visibilityRef = useRef(sandboxVisibilityOverrides);
  visibilityRef.current = sandboxVisibilityOverrides;

  // 沙盒执行器依赖：副作用全部隔离
  const sandboxDeps = useMemo<V2RuntimeDeps>(
    () => ({
      applyVisibility: (componentId: string, visible: boolean): void => {
        setSandboxVisibilityOverrides((prev) => {
          const next = new Map(prev);
          next.set(componentId, visible);
          return next;
        });
      },
      getVisibility: (componentId: string): boolean => {
        return visibilityRef.current.get(componentId) ?? true;
      },
      openUrl: (): void => {
        /* no-op: 沙盒模拟，不真实导航 */
      },
      scrollToComponent: (): void => {
        /* no-op: 沙盒模拟，不滚动 */
      },
      refreshDataSource: async (): Promise<void> => {
        /* no-op: 沙盒模拟，不 fetch */
      },
      requestApi: async (): Promise<{
        ok: boolean;
        status: number;
        bodyPreview: string;
      }> => {
        return Promise.resolve({
          status: 200,
          bodyPreview: '[sandbox] 模拟请求未发起',
          ok: true,
        });
      },
      hasComponent: (componentId: string): boolean => {
        if (componentId === GLOBAL_COMPONENT_ID) return true;
        return componentsRef.current.some((c) => c.id === componentId);
      },
      logWarning: (message: string): void => {
        console.warn(`[blueprint-sandbox-v2] ${message}`);
      },
      getComponentValue: (componentId: string): Record<string, unknown> | undefined => {
        const component = componentsRef.current.find((c) => c.id === componentId);
        if (!component) return undefined;
        return component.props;
      },
      getComponentData: (): unknown => {
        // 沙盒内无真实数据源缓存，返回 undefined
        return undefined;
      },
    }),
    [],
  );

  // 规则与诊断通过 ref 暴露
  const rulesRef = useRef(compiledRules);
  rulesRef.current = compiledRules;
  const diagnosticsRef = useRef(compileDiagnostics);
  diagnosticsRef.current = compileDiagnostics;
  // 蓝图通过 ref 暴露，供 simulateEvent 查找节点 componentId
  const blueprintRef = useRef(blueprint);
  blueprintRef.current = blueprint;

  /**
   * 根据 nodeId + eventId 构造 V2 触发事件。
   *
   * - 全局 pageLoad 节点（componentId === 'global' 且 globalType === 'pageLoad'）
   *   -> 返回 pageLoad 事件
   * - 全局 interval 节点（componentId === 'global' 且 globalType === 'interval'）
   *   -> 返回 interval 事件
   * - 普通组件节点 -> 返回 componentEvent 事件
   * - 节点不存在 -> 返回 null
   */
  const buildEvent = useCallback((nodeId: string, eventId: string): V2TriggerEvent | null => {
    const bp = blueprintRef.current;
    if (!bp) return null;
    const node = bp.nodes.find((n) => n.id === nodeId);
    if (!node || node.kind !== 'component') return null;

    // 全局 pageLoad 节点
    if (
      node.componentId === GLOBAL_COMPONENT_ID &&
      node.globalType === 'pageLoad' &&
      eventId === 'pageLoad'
    ) {
      return { kind: 'pageLoad' };
    }

    // 全局 interval 节点
    if (
      node.componentId === GLOBAL_COMPONENT_ID &&
      node.globalType === 'interval' &&
      eventId === 'interval'
    ) {
      return { kind: 'interval' };
    }

    // 普通组件节点
    return {
      kind: 'componentEvent',
      componentId: node.componentId,
      eventId,
    };
  }, []);

  /**
   * 对指定节点 + 事件执行模拟触发。
   *
   * 行为：
   * - 节点不存在或非组件节点 → triggerNotFound
   * - 节点存在 error 级诊断 → 拒绝执行
   * - 否则编译并执行匹配规则，写入 executionLogs / executedNodeIds
   */
  const simulateEvent = useCallback(
    async (nodeId: string, eventId: string): Promise<V2SandboxSimulationResult> => {
      const event = buildEvent(nodeId, eventId);
      if (!event) {
        return { logs: [], triggerNotFound: true, refused: false };
      }

      // 错误级诊断检查
      const errorDiag = diagnosticsRef.current.find(
        (d) => d.nodeId === nodeId && d.level === 'error',
      );
      if (errorDiag) {
        return {
          logs: [],
          triggerNotFound: false,
          refused: true,
          refusalReason: errorDiag.message,
        };
      }

      // 收集匹配规则
      const rules = rulesRef.current;
      const matched = rules.filter((rule) => {
        if (rule.triggerNodeId !== nodeId) return false;
        if (event.kind === 'pageLoad') {
          return rule.triggerEventId === 'pageLoad';
        }
        if (event.kind === 'interval') {
          return rule.triggerEventId === 'interval';
        }
        return (
          rule.triggerEventId === event.eventId && rule.triggerComponentId === event.componentId
        );
      });

      if (matched.length === 0) {
        return { logs: [], triggerNotFound: true, refused: false };
      }

      setIsSimulating(true);
      try {
        const logs: V2RuleExecutionLog[] = [];
        const nodeIds = new Set<string>();
        for (const rule of matched) {
          nodeIds.add(rule.triggerNodeId);
          const log = await executeV2Rule(rule, event, sandboxDeps);
          logs.push(log);
          for (const result of log.results) {
            nodeIds.add(result.nodeId);
          }
        }
        setExecutionLogs(logs);
        setExecutedNodeIds(nodeIds);
        return { logs, triggerNotFound: false, refused: false };
      } finally {
        setIsSimulating(false);
      }
    },
    [buildEvent, sandboxDeps],
  );

  const resetSandbox = useCallback((): void => {
    setExecutionLogs([]);
    setExecutedNodeIds(new Set());
    setSandboxVisibilityOverrides(new Map());
  }, []);

  return {
    simulateEvent,
    executionLogs,
    sandboxVisibilityOverrides,
    executedNodeIds,
    isSimulating,
    resetSandbox,
    compiledRules,
    compileDiagnostics,
  };
}

/** V2 ActionResult 类型重导出（供 ExecutionLogPanel 适配层使用） */
export type { V2ActionResult, V2RuleExecutionLog };
