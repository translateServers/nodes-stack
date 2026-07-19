/**
 * 编辑器会话交互控制器（Editor Session Controller）
 *
 * 阶段 1 任务 2.1：组合工具状态机、交互状态机、活动工具能力、文本编辑对象和
 * 会话活动颜色，明确各字段的拥有者。
 *
 * 设计原则（来自 spec.md "单一编辑器会话交互控制器"）：
 * - 编辑器只创建一个工具状态机实例和一个交互状态机实例
 * - 画布、工具入口、状态栏和快捷键读取同一实例的活动状态
 * - 高频手势数据（pointer 起点、DOM ref、Moveable 实例、实时辅助线、尺寸浮层）
 *   保留在局部 ref 或专用高频 Store 中，不进入会话控制器
 * - 持久项目数据只通过编辑器 Store 提交
 *
 * 字段拥有者划分：
 * - 工具状态（activeTool/currentTool/hasTemporaryTool）→ ToolStateMachineApi
 * - 交互状态（state/isInteracting/isEditingText/isContextMenuOpen）→ InteractionStateMachineApi
 *   （任务 12.4：isEditingText 的唯一来源是交互状态机，工具状态机不再持有镜像）
 * - 活动工具能力（capabilities）→ 由 TOOL_REGISTRY 派生，会话控制器只读
 * - 文本编辑对象（textEditing）→ 会话控制器持有，由交互状态机 text-editing 状态联动
 *
 * 不包含：
 * - 持久项目副本（project/components/selectedIds 等仍在编辑器 Store）
 * - Moveable 实例或 DOM ref（局部）
 * - 每帧 pointer 坐标（局部 ref 或高频 Store）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getToolById, type EditorTool, type ToolCapabilities } from './tool-registry';
import type { ToolStateMachineApi } from './use-tool-state-machine';
import type { InteractionStateMachineApi } from './use-interaction-state-machine';

/**
 * 文本编辑对象
 *
 * 描述当前正在编辑的文本组件上下文。当 interactionState 进入 'text-editing' 时，
 * 控制器持有该对象；退出时清空。
 */
export interface TextEditingContext {
  /** 正在编辑的组件 ID */
  readonly componentId: string;
  /** 编辑开始时的初始内容，用于取消时恢复 */
  readonly initialContent: string;
  /**
   * 是否为新建组件（任务 5.1 契约）。
   *
   * - true：文字工具点击创建路径，提交时若内容为空则删除组件
   * - false：双击编辑已有文本路径，提交时若内容为空则保留（允许清空）
   *
   * 取消时若为 true，也删除组件（恢复到创建前状态）。
   */
  readonly isNewlyCreated: boolean;
}

/**
 * 编辑器会话交互控制器的对外 API
 *
 * 这是编辑器子组件消费会话状态的唯一入口。子组件不应自行创建工具状态机或
 * 交互状态机实例，必须从 ScreenEditor 接收此对象。
 */
export interface EditorSessionApi {
  // ===== 工具状态（拥有者：ToolStateMachineApi）=====
  /** 当前活动工具（受临时工具栈影响） */
  readonly activeTool: EditorTool;
  /** 主工具（不受临时栈影响） */
  readonly currentTool: EditorTool;
  /** 是否持有临时工具 */
  readonly hasTemporaryTool: boolean;
  /** 设置主工具 */
  readonly setTool: (tool: EditorTool) => void;
  /** 压栈临时工具 */
  readonly pushTemporaryTool: (tool: EditorTool) => void;
  /** 出栈临时工具 */
  readonly popTemporaryTool: (tool: EditorTool) => void;

  // ===== 交互状态（拥有者：InteractionStateMachineApi）=====
  /** 当前交互状态 */
  readonly interactionState: InteractionStateMachineApi['state'];
  /** 是否处于交互中（非 idle/hovering） */
  readonly isInteracting: boolean;
  /** 是否处于文本编辑态（来自交互状态机，任务 12.4 已删除工具状态机镜像） */
  readonly isEditingText: boolean;
  /** 是否处于右键菜单打开态 */
  readonly isContextMenuOpen: boolean;
  /** 派发交互事件 */
  readonly dispatchInteraction: InteractionStateMachineApi['dispatch'];

  // ===== 活动工具能力（拥有者：TOOL_REGISTRY，会话控制器只读派生）=====
  /** 活动工具的能力定义 */
  readonly activeCapabilities: ToolCapabilities;
  /** 便捷方法：活动工具是否具备某能力 */
  readonly hasCapability: (capability: keyof ToolCapabilities) => boolean;

  // ===== 文本编辑对象（拥有者：会话控制器）=====
  /** 当前文本编辑上下文；非文本编辑态为 null */
  readonly textEditing: TextEditingContext | null;
  /** 进入文本编辑 */
  readonly beginTextEditing: (context: TextEditingContext) => void;
  /** 退出文本编辑（不传 componentId 表示退出任意） */
  readonly endTextEditing: () => void;
}

/**
 * 创建编辑器会话交互控制器的参数
 *
 * 工具状态机和交互状态机实例由 ScreenEditor 创建并传入，
 * 控制器不负责创建它们，只负责组合和派生。
 */
export interface UseEditorSessionOptions {
  readonly toolStateMachine: ToolStateMachineApi;
  readonly interactionStateMachine: InteractionStateMachineApi;
}

/**
 * 创建编辑器会话交互控制器
 *
 * 在 ScreenEditor 中调用一次，将返回的 EditorSessionApi 下发到画布、
 * 工具入口、状态栏和快捷键。
 */
export function useEditorSession({
  toolStateMachine,
  interactionStateMachine,
}: UseEditorSessionOptions): EditorSessionApi {
  const {
    activeTool,
    currentTool,
    hasTemporaryTool,
    setTool,
    pushTemporaryTool,
    popTemporaryTool,
  } = toolStateMachine;
  const {
    state: interactionState,
    isInteracting,
    isEditingText,
    isContextMenuOpen,
    dispatch: dispatchInteraction,
  } = interactionStateMachine;

  // 活动工具能力（从 TOOL_REGISTRY 派生，会话控制器只读）
  const activeCapabilities = useMemo<ToolCapabilities>(() => {
    const tool = getToolById(activeTool);
    // activeTool 受 ToolStateMachine 约束，必然能在注册表中找到；防御性回退到选择工具
    return (tool ?? getToolById('select'))!.capabilities;
  }, [activeTool]);

  const hasCapability = useCallback(
    (capability: keyof ToolCapabilities): boolean => activeCapabilities[capability],
    [activeCapabilities],
  );

  // 文本编辑对象（会话控制器持有）
  // 任务 12.4：isEditingText 由交互状态机 'text-editing' 状态派生，工具状态机不再镜像。
  // begin/end 只负责更新会话控制器持有的文本编辑上下文；交互状态由调用方通过
  // dispatchInteraction('double-click'/'commit'/'escape') 派发到交互状态机。
  const [textEditing, setTextEditing] = useState<TextEditingContext | null>(null);
  const beginTextEditing = useCallback((context: TextEditingContext) => {
    setTextEditing(context);
  }, []);
  const endTextEditing = useCallback(() => {
    setTextEditing(null);
  }, []);

  /**
   * 任务 13.6：包装 setTool，工具切换时清理交互状态。
   *
   * 修复 bug：用户在文本编辑/创建/平移/缩放/采样态直接切换工具时，交互状态机
   * 卡在非 idle 状态，导致 Selecto onDragStart 仲裁拒绝后续点击，无法选中组件。
   *
   * 策略：切换工具视为"放弃当前交互"，派发 cancel 事件让交互状态机恢复到 idle。
   * - panState/shapeCreation 等 ScreenCanvas 局部状态由其 useEffect 监听 interactionState 清理
   * - textEditing 上下文由 ScreenEditor useEffect 监听 interactionState 清理
   *   （需要知道 isNewlyCreated 决定是否删除组件，该逻辑在 ScreenEditor 中）
   *
   * 用 ref 读取最新 interactionState，避免 setTool 包装依赖 interactionState
   * 导致每次状态变化都重建函数（影响 tool-selector.tsx memo 等消费方）。
   */
  const interactionStateRef = useRef(interactionState);
  useEffect(() => {
    interactionStateRef.current = interactionState;
  }, [interactionState]);

  const setToolWithCleanup = useCallback(
    (tool: EditorTool) => {
      const currentState = interactionStateRef.current;
      if (currentState !== 'idle' && currentState !== 'hovering') {
        dispatchInteraction('cancel');
      }
      setTool(tool);
    },
    [dispatchInteraction, setTool],
  );

  return {
    // 工具状态
    activeTool,
    currentTool,
    hasTemporaryTool,
    setTool: setToolWithCleanup,
    pushTemporaryTool,
    popTemporaryTool,
    // 交互状态
    interactionState,
    isInteracting,
    isEditingText,
    isContextMenuOpen,
    dispatchInteraction,
    // 活动工具能力
    activeCapabilities,
    hasCapability,
    // 文本编辑对象
    textEditing,
    beginTextEditing,
    endTextEditing,
  };
}
