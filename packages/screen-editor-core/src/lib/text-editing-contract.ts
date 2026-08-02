/**
 * 文本创建与编辑会话契约（任务 5.1）
 *
 * 明确文本工具的创建、编辑、提交、取消、失焦、Escape 和历史记录语义。
 * 契约覆盖两条路径：
 * 1. 创建新文本：文字工具点击画布 → 创建文本组件 → 立即进入编辑
 * 2. 编辑已有文本：选择工具双击文本组件 → 进入编辑
 *
 * 提交/取消/历史规则：
 * - 提交（commit）：有效内容（非空且与初始内容不同）写入 Store，进入历史一条
 * - 取消（cancel/Escape）：不写入历史，恢复初始内容
 * - 失焦（blur）：视为提交（如果有变化）
 * - 无变化：不写入历史，直接退出编辑
 * - 空内容创建：取消创建（删除新创建的空文本组件，不入历史）
 *
 * 与交互状态机的联动：
 * - 进入编辑：dispatch 'double-click'（idle/hovering → text-editing）
 * - 提交退出：dispatch 'commit'（text-editing → idle）
 * - 取消退出：dispatch 'escape' 或 'cancel'（text-editing → idle）
 */

/**
 * 文本编辑的退出方式。
 *
 * - 'commit'：用户提交有效内容（Enter 或 blur 且有变化）
 * - 'cancel'：用户取消（Escape）
 * - 'commit-empty'：提交时内容为空，调用方决定是否删除组件
 */
export type TextEditExitKind = 'commit' | 'cancel' | 'commit-empty';

/**
 * 文本编辑的提交结果。
 *
 * 描述提交时应执行的 Store 操作，契约本身不执行副作用。
 */
export interface TextCommitResult {
  /** 退出方式 */
  readonly exitKind: TextEditExitKind;
  /** 最终内容（exitKind='cancel' 时为初始内容） */
  readonly content: string;
  /** 是否应该写入历史（commit 且有变化时为 true） */
  readonly shouldCommitHistory: boolean;
  /** 是否应该删除组件（commit-empty 且为新建组件时为 true） */
  readonly shouldDeleteComponent: boolean;
}

/**
 * 默认文本内容（来自 COMPONENT_DEFINITIONS text.defaultProps.content）。
 *
 * 文字工具点击创建时使用此值作为初始内容，并立即进入编辑态让用户替换。
 */
export const DEFAULT_TEXT_CONTENT = '请输入文本';

/**
 * 判断文本内容是否为"空"（仅空白也算空）。
 *
 * 空内容在创建路径下应取消创建（删除组件），在编辑路径下应保留（允许清空已有文本）。
 */
export function isTextEmpty(content: string): boolean {
  return content.trim().length === 0;
}

/**
 * 判断文本内容是否与初始内容不同（有变化）。
 */
export function hasTextChanges(initial: string, current: string): boolean {
  return initial !== current;
}

/**
 * 计算文本编辑的提交结果。
 *
 * 契约规则：
 * - exitKind='cancel'：不写入历史，内容恢复为初始值，不删除组件
 * - exitKind='commit'：
 *   - 内容为空且 isNewlyCreated=true → commit-empty，删除组件，不写入历史
 *   - 内容为空且 isNewlyCreated=false → commit，写入历史（允许清空已有文本）
 *   - 内容非空且有变化 → commit，写入历史
 *   - 内容非空且无变化 → commit，不写入历史
 *
 * @param initialContent 编辑开始时的初始内容
 * @param currentContent 编辑结束时的当前内容
 * @param exitKind 退出方式
 * @param isNewlyCreated 是否为新建组件（创建路径 vs 编辑路径）
 */
export function resolveTextCommit(
  initialContent: string,
  currentContent: string,
  exitKind: TextEditExitKind,
  isNewlyCreated: boolean,
): TextCommitResult {
  // 取消：恢复初始内容，不写入历史，不删除组件
  if (exitKind === 'cancel') {
    return {
      exitKind: 'cancel',
      content: initialContent,
      shouldCommitHistory: false,
      shouldDeleteComponent: false,
    };
  }

  // 提交路径
  const empty = isTextEmpty(currentContent);
  const changed = hasTextChanges(initialContent, currentContent);

  // 空内容 + 新建组件 → 删除组件（取消创建）
  if (empty && isNewlyCreated) {
    return {
      exitKind: 'commit-empty',
      content: currentContent,
      shouldCommitHistory: false,
      shouldDeleteComponent: true,
    };
  }

  // 有变化 → 写入历史
  // 无变化 → 不写入历史
  return {
    exitKind: 'commit',
    content: currentContent,
    shouldCommitHistory: changed,
    shouldDeleteComponent: false,
  };
}

/**
 * 文本编辑会话的入口描述。
 *
 * 用于在创建/编辑路径开始时记录上下文，供提交时判断 isNewlyCreated。
 */
export interface TextEditSession {
  /** 正在编辑的组件 ID */
  readonly componentId: string;
  /** 编辑开始时的初始内容 */
  readonly initialContent: string;
  /** 是否为新建组件（文字工具点击创建 vs 双击编辑已有） */
  readonly isNewlyCreated: boolean;
}
