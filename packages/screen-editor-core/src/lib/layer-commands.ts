/**
 * 图层命令描述符模块（Phase 2 Slice A）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §1.3 命令描述符。
 *
 * 一切对图层/画布的操作（重命名/锁定/显隐/置顶/成组/删除…）统一定义为命令对象：
 * `{ id, label, icon, when?, enabled?, run, destructive?, separatorBefore? }`。
 *
 * 同一份命令表（`LAYER_COMMANDS`）目前喂给图层右键菜单；后续可扩展喂给
 * 顶部菜单栏、快捷键系统、命令面板。操作语义只写一次，UI 零分支。
 *
 * 不持有业务状态：所有读取/写入都经 `LayerCommandContext.store` 调用 Zustand actions，
 * 单向数据流不变（架构 §1.4）。
 */

import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  Group as GroupIcon,
  Lock,
  Pencil,
  Trash2,
  Ungroup,
  Unlock,
  type LucideIcon,
} from 'lucide-react';
import type { ScreenComponent } from '@nebula/shared';

/**
 * 命令执行所需的 store actions 子集。
 * 仅声明图层命令实际调用的方法，便于在测试中构造 mock，解耦 store 实现。
 */
export interface LayerCommandStore {
  renameComponent: (id: string, name: string) => void;
  copySelectedToClipboard: () => void;
  duplicateSelected: () => void;
  setLocked: (ids: string[], locked: boolean) => void;
  setHidden: (ids: string[], hidden: boolean) => void;
  reorderToTop: (id: string) => void;
  reorderToBottom: (id: string) => void;
  reorderLayerToIndex: (id: string, toIndex: number) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  removeSelectedComponents: () => void;
}

/** 命令执行上下文：选区 + 目标行 + 顶层序列 + 重命名回调 + store */
export interface LayerCommandContext {
  /** 当前选中组件（菜单弹起前由调用方保证包含 target） */
  readonly selectedComponents: readonly ScreenComponent[];
  /** 右键命中的单个组件行；分组行右键时为 undefined */
  readonly targetComponent?: ScreenComponent;
  /** 右键命中的分组行（虚拟节点）；组件行右键时为 undefined */
  readonly targetGroup?: {
    readonly groupId: string;
    readonly children: readonly ScreenComponent[];
  };
  /**
   * 顶层组件按 zIndex 降序排列（index 0 = 最顶层），用于「上移/下移一层」计算相邻位。
   * 与 `reorderLayerToIndex` 的内部排序口径保持一致（仅无 parentId 项参与）。
   */
  readonly topLevelOrdered: readonly ScreenComponent[];
  /** 重命名出口：调用方据此切到 inline input 编辑态，命令本身不直接改名 */
  readonly requestRename?: (id: string) => void;
  /** store actions（单向数据流不变，命令不持有业务状态副本） */
  readonly store: LayerCommandStore;
}

/** 命令描述符：标签/图标可基于上下文动态返回，以表达「锁定/解锁」等互斥文案 */
export interface LayerCommandDescriptor {
  readonly id: string;
  readonly label: string | ((ctx: LayerCommandContext) => string);
  readonly icon?: LucideIcon | ((ctx: LayerCommandContext) => LucideIcon);
  /** when=false 时该命令不显示在菜单中（按上下文裁剪菜单项） */
  readonly when?: (ctx: LayerCommandContext) => boolean;
  /** enabled=false 时菜单项置灰但可见 */
  readonly enabled?: (ctx: LayerCommandContext) => boolean;
  readonly run: (ctx: LayerCommandContext) => void;
  /** 标记为危险操作（删除），UI 渲染时套 destructive variant */
  readonly destructive?: boolean;
  /** 在该项前插入分隔线，用于命令分组视觉切分 */
  readonly separatorBefore?: boolean;
}

/** 取目标行影响的组件 ID 列表：分组行作用于子组件，组件行作用于当前选区 */
export function getLayerCommandTargetIds(ctx: LayerCommandContext): readonly string[] {
  if (ctx.targetGroup) {
    return ctx.targetGroup.children.map((c) => c.id);
  }
  return ctx.selectedComponents.map((c) => c.id);
}

/** 是否所有选中组件都已锁定（用于「锁定/解锁」互斥文案与图标切换） */
export function isAllLocked(ctx: LayerCommandContext): boolean {
  return ctx.selectedComponents.length > 0 && ctx.selectedComponents.every((c) => c.status.locked);
}

/** 是否所有选中组件都已隐藏（用于「显示/隐藏」互斥文案与图标切换） */
export function isAllHidden(ctx: LayerCommandContext): boolean {
  return ctx.selectedComponents.length > 0 && ctx.selectedComponents.every((c) => c.status.hidden);
}

/** 是否选中包含分组子组件（用于「解除成组」when 判定） */
export function hasGroupedSelection(ctx: LayerCommandContext): boolean {
  return ctx.selectedComponents.some((c) => c.parentId != null);
}

/** 是否选中含锁定项（用于破坏性/重排命令的 enabled 守卫） */
function hasLockedSelection(ctx: LayerCommandContext): boolean {
  return ctx.selectedComponents.some((c) => c.status.locked);
}

/** 单组件顶层场景：targetComponent 在 topLevelOrdered 中的索引；不在则 -1 */
function findTopLevelIndex(ctx: LayerCommandContext): number {
  const c = ctx.targetComponent;
  if (!c) return -1;
  return ctx.topLevelOrdered.findIndex((t) => t.id === c.id);
}

/**
 * 图层命令注册表（Slice A 落地版本）。
 *
 * 设计要点：
 * - 「重命名」走 `requestRename` 出口，由 LayerPanel 切到 inline input；
 *   命令本身不直接调用 `renameComponent`，避免与 input 提交语义重复入栈。
 * - 「上移/下移一层」基于 `reorderLayerToIndex`，仅在单选 + 顶层组件时启用，
 *   与 `reorderLayerToIndex` 内部"仅顶层组件参与重排"的契约一致。
 * - 「锁定/解锁」「显示/隐藏」标签与图标按当前态互斥切换，多选时按"全部锁定→解锁"语义。
 * - 「成组」要求选中≥2；「解除成组」要求选中包含分组子组件。
 * - 「删除」对分组行作用于子组件批量（targetGroup 时 selected 已是子组件集合）。
 */
export const LAYER_COMMANDS: readonly LayerCommandDescriptor[] = [
  {
    id: 'rename',
    label: '重命名',
    icon: Pencil,
    when: (ctx) => ctx.targetComponent !== undefined && ctx.selectedComponents.length === 1,
    run: (ctx) => {
      if (ctx.targetComponent) {
        ctx.requestRename?.(ctx.targetComponent.id);
      }
    },
  },
  {
    id: 'copy',
    label: '复制',
    icon: Copy,
    when: (ctx) => ctx.targetComponent !== undefined,
    enabled: (ctx) => ctx.selectedComponents.length > 0,
    run: (ctx) => ctx.store.copySelectedToClipboard(),
    separatorBefore: true,
  },
  {
    id: 'duplicate',
    label: '创建副本',
    icon: CopyPlus,
    when: (ctx) => ctx.targetComponent !== undefined,
    enabled: (ctx) => ctx.selectedComponents.length > 0,
    run: (ctx) => ctx.store.duplicateSelected(),
  },
  {
    id: 'toggle-lock',
    label: (ctx) => (isAllLocked(ctx) ? '解锁' : '锁定'),
    icon: (ctx: LayerCommandContext) => (isAllLocked(ctx) ? Unlock : Lock),
    when: (ctx) => ctx.selectedComponents.length > 0,
    run: (ctx) => {
      const ids = getLayerCommandTargetIds(ctx);
      ctx.store.setLocked([...ids], !isAllLocked(ctx));
    },
    separatorBefore: true,
  },
  {
    id: 'toggle-hide',
    label: (ctx) => (isAllHidden(ctx) ? '显示' : '隐藏'),
    icon: (ctx: LayerCommandContext) => (isAllHidden(ctx) ? Eye : EyeOff),
    when: (ctx) => ctx.selectedComponents.length > 0,
    run: (ctx) => {
      const ids = getLayerCommandTargetIds(ctx);
      ctx.store.setHidden([...ids], !isAllHidden(ctx));
    },
  },
  {
    id: 'bring-to-front',
    label: '置于顶层',
    icon: ArrowUpToLine,
    when: (ctx) => ctx.targetComponent !== undefined && ctx.targetComponent.parentId == null,
    enabled: (ctx) => !hasLockedSelection(ctx),
    run: (ctx) => {
      for (const c of ctx.selectedComponents) {
        if (c.parentId == null) ctx.store.reorderToTop(c.id);
      }
    },
    separatorBefore: true,
  },
  {
    id: 'bring-forward',
    label: '上移一层',
    icon: ChevronUp,
    when: (ctx) =>
      ctx.targetComponent !== undefined &&
      ctx.targetComponent.parentId == null &&
      ctx.selectedComponents.length === 1,
    enabled: (ctx) => {
      const c = ctx.targetComponent;
      if (!c || c.status.locked) return false;
      const idx = findTopLevelIndex(ctx);
      return idx > 0;
    },
    run: (ctx) => {
      const c = ctx.targetComponent;
      if (!c) return;
      const idx = findTopLevelIndex(ctx);
      if (idx > 0) ctx.store.reorderLayerToIndex(c.id, idx - 1);
    },
  },
  {
    id: 'send-backward',
    label: '下移一层',
    icon: ChevronDown,
    when: (ctx) =>
      ctx.targetComponent !== undefined &&
      ctx.targetComponent.parentId == null &&
      ctx.selectedComponents.length === 1,
    enabled: (ctx) => {
      const c = ctx.targetComponent;
      if (!c || c.status.locked) return false;
      const idx = findTopLevelIndex(ctx);
      return idx >= 0 && idx < ctx.topLevelOrdered.length - 1;
    },
    run: (ctx) => {
      const c = ctx.targetComponent;
      if (!c) return;
      const idx = findTopLevelIndex(ctx);
      if (idx >= 0 && idx < ctx.topLevelOrdered.length - 1) {
        ctx.store.reorderLayerToIndex(c.id, idx + 1);
      }
    },
  },
  {
    id: 'send-to-back',
    label: '置于底层',
    icon: ArrowDownToLine,
    when: (ctx) => ctx.targetComponent !== undefined && ctx.targetComponent.parentId == null,
    enabled: (ctx) => !hasLockedSelection(ctx),
    run: (ctx) => {
      for (const c of ctx.selectedComponents) {
        if (c.parentId == null) ctx.store.reorderToBottom(c.id);
      }
    },
  },
  {
    id: 'group',
    label: '成组',
    icon: GroupIcon,
    when: (ctx) => ctx.targetComponent !== undefined && ctx.selectedComponents.length >= 2,
    enabled: (ctx) => !hasLockedSelection(ctx),
    run: (ctx) => ctx.store.groupSelected(),
    separatorBefore: true,
  },
  {
    id: 'ungroup',
    label: '解除成组',
    icon: Ungroup,
    when: (ctx) => hasGroupedSelection(ctx),
    enabled: (ctx) => !hasLockedSelection(ctx),
    run: (ctx) => ctx.store.ungroupSelected(),
  },
  {
    id: 'delete',
    label: '删除',
    icon: Trash2,
    when: (ctx) => ctx.selectedComponents.length > 0,
    run: (ctx) => ctx.store.removeSelectedComponents(),
    destructive: true,
    separatorBefore: true,
  },
];

/**
 * 根据上下文过滤可见命令（when=false 不显示）。
 * 供菜单渲染层调用，避免每处自行过滤。
 */
export function getVisibleLayerCommands(
  ctx: LayerCommandContext,
): readonly LayerCommandDescriptor[] {
  return LAYER_COMMANDS.filter((cmd) => (cmd.when ? cmd.when(ctx) : true));
}

/** 计算命令在指定上下文下的最终标签（兼容字符串与函数两种声明） */
export function resolveLayerCommandLabel(
  cmd: LayerCommandDescriptor,
  ctx: LayerCommandContext,
): string {
  return typeof cmd.label === 'function' ? cmd.label(ctx) : cmd.label;
}

/**
 * 计算命令在指定上下文下的最终图标（兼容静态与动态两种声明）。
 *
 * 注：LucideIcon（ForwardRefExoticComponent）在 React 19 类型下也带 call signature，
 * 与 `(ctx) => LucideIcon` 无法仅凭 `typeof === 'function'` 区分，会导致返回类型膨胀为
 * `ReactNode | LucideIcon | null`。这里用 cast 断言函数分支返回 LucideIcon，
 * 语义由注册表的类型声明保证（icon 字段为 LucideIcon 或返回 LucideIcon 的函数）。
 */
export function resolveLayerCommandIcon(
  cmd: LayerCommandDescriptor,
  ctx: LayerCommandContext,
): LucideIcon | undefined {
  if (!cmd.icon) return undefined;
  return typeof cmd.icon === 'function'
    ? (cmd.icon as (ctx: LayerCommandContext) => LucideIcon)(ctx)
    : cmd.icon;
}

/** 计算命令在指定上下文下的 enabled 状态（未声明时视为 true） */
export function isLayerCommandEnabled(
  cmd: LayerCommandDescriptor,
  ctx: LayerCommandContext,
): boolean {
  return cmd.enabled ? cmd.enabled(ctx) : true;
}
