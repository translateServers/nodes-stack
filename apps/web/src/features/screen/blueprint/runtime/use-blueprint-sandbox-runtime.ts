/**
 * 蓝图沙盒运行时 Hook（任务 8.1）
 *
 * 在 Sheet 内对选中的 trigger 节点执行模拟触发，沙盒运行时独立于预览/画布真实状态。
 *
 * 隔离策略（spec: "调试在独立沙盒运行时执行，不污染预览与画布真实状态"）：
 * - `applyVisibility` / `getVisibility`：读写本 Hook 内部独立的 sandboxVisibilityOverrides，
 *   不与 useBlueprintPreviewRuntime 的 visibilityOverrides 共享
 * - `openUrl` / `scrollToComponent` / `refreshDataSource`：no-op（沙盒内不发起真实导航、
 *   不滚动 Sheet 内画布、不发起新的网络请求；仅由执行器返回 success 结果）
 * - `hasComponent`：只读真实 components 引用（不写回项目数据）
 * - `logWarning`：与预览运行时一致（深度截断等运行时告警仍记录到 console）
 *
 * 错误级诊断拒绝（spec: "错误级诊断对应的触发器在预览运行时不执行"）：
 * - 当 triggerNodeId 对应的 trigger 节点存在 error 级诊断时，refuse 执行
 *
 * 产物：
 * - executionLogs：最新一次模拟的规则执行日志（供任务 8.3 执行日志面板渲染）
 * - executedNodeIds：最新一次模拟涉及的节点 id 集合（供任务 8.2 链路高亮使用）
 * - sandboxVisibilityOverrides：累积直至 resetSandbox（多次模拟可叠加观察组合效果）
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { EventBlueprint, ScreenComponent } from '@nebula/shared';
import { compileBlueprint, type CompiledRule, type Diagnostic } from '../compiler/index.js';
import { executeRule } from './executor.js';
import type { RuleExecutionLog, RuntimeDeps, VisibilityOverrides } from './types.js';

/** 模拟触发结果 */
export interface SandboxSimulationResult {
  /** 触发的规则日志（按编译顺序；正常情况下长度为 1，因 triggerNodeId 唯一映射一条规则） */
  logs: RuleExecutionLog[];
  /** 是否因 trigger 不存在而失败 */
  triggerNotFound: boolean;
  /** 是否因 error 级诊断被拒绝执行 */
  refused: boolean;
  /** 拒绝原因（refused=true 时有值） */
  refusalReason?: string;
}

/** 沙盒运行时对外 API */
export interface BlueprintSandboxRuntime {
  /** 对指定 trigger 节点执行模拟触发 */
  simulateTrigger: (triggerNodeId: string) => Promise<SandboxSimulationResult>;
  /** 最新一次模拟的规则执行日志（供执行日志面板渲染） */
  executionLogs: RuleExecutionLog[];
  /** 沙盒可见性覆盖表（独立于预览/画布真实状态；累积直至 resetSandbox） */
  sandboxVisibilityOverrides: VisibilityOverrides;
  /** 最新一次模拟涉及的节点 id 集合（trigger + 全部 action，含 skipped/failure） */
  executedNodeIds: Set<string>;
  /** 是否正在执行模拟 */
  isSimulating: boolean;
  /** 重置沙盒状态（清空日志、可见性覆盖、节点集） */
  resetSandbox: () => void;
  /** 当前编译结果（供 UI 展示诊断或链路拓扑） */
  compiledRules: CompiledRule[];
  /** 当前编译诊断列表 */
  compileDiagnostics: Diagnostic[];
}

/**
 * 构造沙盒运行时。
 *
 * @param blueprint  当前蓝图（可能为 undefined）
 * @param components  当前项目组件列表（只读，用于 hasComponent 判定）
 */
export function useBlueprintSandboxRuntime(
  blueprint: EventBlueprint | undefined,
  components: readonly ScreenComponent[],
): BlueprintSandboxRuntime {
  // 编译蓝图（与预览运行时独立编译，避免共享 memo）
  const compileResult = useMemo(() => {
    if (!blueprint) return null;
    const componentIds = new Set(components.map((c) => c.id));
    return compileBlueprint(blueprint, { componentIds });
  }, [blueprint, components]);

  const compiledRules = compileResult?.rules ?? [];
  const compileDiagnostics = compileResult?.diagnostics ?? [];

  // 沙盒独立的可见性覆盖表：不与预览/画布共享
  const [sandboxVisibilityOverrides, setSandboxVisibilityOverrides] = useState<VisibilityOverrides>(
    () => new Map(),
  );

  // 最新一次模拟的执行日志
  const [executionLogs, setExecutionLogs] = useState<RuleExecutionLog[]>([]);
  // 最新一次模拟涉及的节点 id 集合
  const [executedNodeIds, setExecutedNodeIds] = useState<Set<string>>(() => new Set());
  // 是否正在执行模拟
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // 保留最新 components / visibility 引用，避免 deps 闭包捕获过期值
  const componentsRef = useRef(components);
  componentsRef.current = components;
  const visibilityRef = useRef(sandboxVisibilityOverrides);
  visibilityRef.current = sandboxVisibilityOverrides;

  // 沙盒执行器依赖：副作用全部隔离（no-op 或写本地 state）
  const sandboxDeps = useMemo<RuntimeDeps>(
    () => ({
      applyVisibility: (componentId: string, visible: boolean): void => {
        setSandboxVisibilityOverrides((prev) => {
          const next = new Map(prev);
          next.set(componentId, visible);
          return next;
        });
      },
      getVisibility: (componentId: string): boolean | undefined => {
        return visibilityRef.current.get(componentId);
      },
      // 沙盒内不真实导航（避免离开 Sheet）；执行器仍返回 success
      openUrl: (): void => {
        /* no-op: 沙盒模拟，不真实导航 */
      },
      // 沙盒内不滚动画布（Sheet 内 ReactFlow 自有视口）
      scrollToComponent: (): void => {
        /* no-op: 沙盒模拟，不滚动 */
      },
      // 沙盒内不发起新的网络请求（避免污染真实数据源缓存）
      refreshDataSource: async (): Promise<void> => {
        /* no-op: 沙盒模拟，不 fetch */
      },
      hasComponent: (componentId: string): boolean => {
        return componentsRef.current.some((c) => c.id === componentId);
      },
      logWarning: (message: string): void => {
        console.warn(`[blueprint-sandbox] ${message}`);
      },
    }),
    [],
  );

  // 规则通过 ref 暴露，避免 simulateTrigger 依赖 compiledRules 导致频繁重建
  const rulesRef = useRef(compiledRules);
  rulesRef.current = compiledRules;
  // 诊断通过 ref 暴露
  const diagnosticsRef = useRef(compileDiagnostics);
  diagnosticsRef.current = compileDiagnostics;

  /**
   * 对指定 trigger 节点执行模拟触发。
   *
   * 行为：
   * - trigger 不存在 → 返回 { triggerNotFound: true }
   * - trigger 存在 error 级诊断 → 拒绝执行，返回 { refused: true, refusalReason }
   * - 否则编译并执行对应规则，写入 executionLogs / executedNodeIds
   *
   * 注意：本方法不抛错。执行器内部的 failure 已被捕获为 ActionResult.kind='failure'。
   */
  const simulateTrigger = useCallback(
    async (triggerNodeId: string): Promise<SandboxSimulationResult> => {
      const rules = rulesRef.current;
      const rule = rules.find((r) => r.triggerNodeId === triggerNodeId);
      if (!rule) {
        return { logs: [], triggerNotFound: true, refused: false };
      }

      // 错误级诊断检查（spec: "错误级诊断对应的触发器在预览运行时不执行"）
      const errorDiag = diagnosticsRef.current.find(
        (d) => d.nodeId === triggerNodeId && d.level === 'error',
      );
      if (errorDiag) {
        return {
          logs: [],
          triggerNotFound: false,
          refused: true,
          refusalReason: errorDiag.message,
        };
      }

      setIsSimulating(true);
      try {
        const log = await executeRule(rule, sandboxDeps);
        // 收集本次模拟涉及的所有节点 id：trigger + 全部 action 结果
        const nodeIds = new Set<string>();
        nodeIds.add(rule.triggerNodeId);
        for (const result of log.results) {
          nodeIds.add(result.nodeId);
        }
        setExecutionLogs([log]);
        setExecutedNodeIds(nodeIds);
        return { logs: [log], triggerNotFound: false, refused: false };
      } finally {
        setIsSimulating(false);
      }
    },
    [sandboxDeps],
  );

  const resetSandbox = useCallback((): void => {
    setExecutionLogs([]);
    setExecutedNodeIds(new Set());
    setSandboxVisibilityOverrides(new Map());
  }, []);

  return {
    simulateTrigger,
    executionLogs,
    sandboxVisibilityOverrides,
    executedNodeIds,
    isSimulating,
    resetSandbox,
    compiledRules,
    compileDiagnostics,
  };
}
