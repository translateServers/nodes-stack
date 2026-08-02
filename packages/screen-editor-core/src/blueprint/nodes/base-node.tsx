/**
 * 蓝图节点共享容器
 *
 * 三类节点共享的渲染外壳：
 * - 选中态：蓝色边框高亮 + 柔和光晕
 * - dangling 标记态：红色边框 + 红色光晕
 * - cycle 标记态：橙色虚线边框
 * - 左侧类型色条：不读文字即可识别节点类型
 * - 类型图标容器与标签布局
 * - 深色主题配色
 *
 * 节点类型配色：
 * - component：绿色（emerald），突出"组件即节点"理念
 * - global：绿色（emerald）+ 虚线边框 —— 全局节点子类型
 * - delay：琥珀色（amber）
 * - condition：紫色（purple）
 * - comment：灰色（gray）
 *
 * 锚点（Handle）语义配色：
 * - source 输出锚点（事件）：emerald 实心
 * - target 输入锚点（动作）：sky 实心
 * - condition then / else：emerald / rose
 * - 其他静态引脚：muted 中性色
 *
 * 同时支持静态引脚和从事件/动作定义派生的动态锚点。
 */

import { useLayoutEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@nebula/screen-editor-core/internal';

/**
 * 动态锚点行高（px）。
 *
 * 每个锚点占一行，行高固定，Handle 通过测量锚点列表容器相对节点的偏移
 * 加上行索引 × 行高 + 行高/2 计算出精确的像素位置，与对应行垂直居中对齐。
 */
const ANCHOR_ROW_HEIGHT = 24;

/** 节点类型配色方案。 */
export type NodeColorScheme = 'comment' | 'condition' | 'component' | 'delay';

/** 动态锚点描述（组件节点派生的事件/动作锚点）。 */
export interface AnchorDescriptor {
  /** 锚点 ID（如 'evt:click' / 'act:show' / 'in' / 'out' / 'then' / 'else'） */
  id: string;
  /** 锚点显示名（如 '点击' / '显示'） */
  label: string;
}

interface BaseNodeShellProps {
  /** 节点类型配色 */
  colorScheme: NodeColorScheme;
  /** 节点 ID（用于 E2E 定位与诊断映射） */
  nodeId: string;
  /** 节点图标 */
  icon: ReactNode;
  /** 节点标签（类型名称） */
  typeLabel: string;
  /** 节点显示名称（组件名或注释文本） */
  label: string;
  /** 是否被选中（由 React Flow 通过 NodeProps.selected 传入） */
  selected: boolean;
  /** 是否被编译器标记为 dangling */
  dangling?: boolean;
  /** 是否在执行流环中 */
  inCycle?: boolean;
  /**
   * 该节点最高级别的诊断等级。
   * 用于在节点边框上显示问题标记（error 红色、warning 黄色）。
   * 优先级：dangling > error > warning > cycle > selected > 默认。
   */
  diagnosticLevel?: 'error' | 'warning' | 'info' | null;
  /**
   * 节点是否正在被定位（从问题面板点击跳转）。
   * 为 true 时添加闪烁动画，1s 后自动清除。
   */
  locating?: boolean;
  /** 是否显示输入引脚（trigger 无输入，comment 无引脚） */
  showInputHandle: boolean;
  /** 是否显示输出引脚（comment 无引脚） */
  showOutputHandle: boolean;
  /**
   * 输出引脚模式。
   * - 'single'：单个 `out` 引脚（trigger / action 默认）
   * - 'then-else'：then / else 双输出引脚（condition 节点）
   * 仅当 showOutputHandle=true 且未启用 dynamicAnchors 时生效。
   */
  outputHandleMode?: 'single' | 'then-else';
  /**
   * 是否启用虚线边框（全局节点专用）。
   * 与 colorScheme=component + globalType 共同标识全局节点。
   */
  dashed?: boolean;
  /**
   * 动态锚点模式。
   * - sourceAnchors：输出锚点列表（左侧或上侧，每个锚点一个 Handle）
   * - targetAnchors：输入锚点列表（右侧或下侧，每个锚点一个 Handle）
   * 启用后忽略 showInputHandle / showOutputHandle / outputHandleMode。
   */
  dynamicAnchors?: {
    sourceAnchors?: readonly AnchorDescriptor[];
    targetAnchors?: readonly AnchorDescriptor[];
  };
  /** 子元素（节点配置摘要或编辑器入口） */
  children?: ReactNode;
}

const COLOR_SCHEMES: Record<
  NodeColorScheme,
  {
    /** 卡片底色（极轻类型色染） */
    bg: string;
    /** 默认边框色 */
    border: string;
    /** 图标与类型标签文字色 */
    text: string;
    /** 图标容器底色 */
    iconBg: string;
    /** 左侧类型色条 */
    accentBar: string;
  }
> = {
  comment: {
    bg: 'bg-gray-500/[0.07] dark:bg-gray-500/10',
    border: 'border-gray-500/40 dark:border-gray-400/40',
    text: 'text-gray-700 dark:text-gray-300',
    iconBg: 'bg-gray-500/15 dark:bg-gray-500/25',
    accentBar: 'bg-gray-400',
  },
  condition: {
    bg: 'bg-purple-500/[0.07] dark:bg-purple-500/10',
    border: 'border-purple-500/40 dark:border-purple-400/40',
    text: 'text-purple-700 dark:text-purple-300',
    iconBg: 'bg-purple-500/15 dark:bg-purple-500/25',
    accentBar: 'bg-purple-500',
  },
  // Component nodes use the primary execution-flow color.
  component: {
    bg: 'bg-emerald-500/[0.07] dark:bg-emerald-500/10',
    border: 'border-emerald-500/40 dark:border-emerald-400/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/25',
    accentBar: 'bg-emerald-500',
  },
  // Delay nodes use the timing color.
  delay: {
    bg: 'bg-amber-500/[0.07] dark:bg-amber-500/10',
    border: 'border-amber-500/40 dark:border-amber-400/40',
    text: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-500/15 dark:bg-amber-500/25',
    accentBar: 'bg-amber-500',
  },
};

/** 锚点基础样式：12px 圆点 + 2px 背景色描边（产生"镂空"层次） */
const HANDLE_BASE_CLASS = '!h-3 !w-3 !border-2 !border-background transition-shadow';
/** 输出锚点（事件 / then 分支）：emerald */
const HANDLE_SOURCE_CLASS = `${HANDLE_BASE_CLASS} !bg-emerald-500`;
/** 输入锚点（动作）：sky */
const HANDLE_TARGET_CLASS = `${HANDLE_BASE_CLASS} !bg-sky-500`;
/** else 分支输出锚点：rose */
const HANDLE_ELSE_CLASS = `${HANDLE_BASE_CLASS} !bg-rose-500`;
/** 中性静态引脚（delay in/out、condition in） */
const HANDLE_NEUTRAL_CLASS = `${HANDLE_BASE_CLASS} !bg-muted-foreground`;

/**
 * 节点共享外壳组件。
 *
 * 不直接作为 React Flow 节点渲染，由 comment、condition、component、global 与 delay
 * 节点包装使用。
 */
export function BaseNodeShell({
  colorScheme,
  nodeId,
  icon,
  typeLabel,
  label,
  selected,
  dangling = false,
  inCycle = false,
  diagnosticLevel = null,
  locating = false,
  showInputHandle,
  showOutputHandle,
  outputHandleMode = 'single',
  dashed = false,
  dynamicAnchors,
  children,
}: BaseNodeShellProps): JSX.Element {
  const scheme = COLOR_SCHEMES[colorScheme];

  // 边框样式：优先级 dangling > error > warning > cycle > selected > 默认
  const borderClass = dangling
    ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.16)]'
    : diagnosticLevel === 'error'
      ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.16)]'
      : diagnosticLevel === 'warning'
        ? 'border-yellow-500 shadow-[0_0_0_3px_rgba(234,179,8,0.16)]'
        : inCycle
          ? 'border-dashed border-orange-500'
          : selected
            ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.16),0_10px_28px_-12px_rgba(59,130,246,0.45)]'
            : dashed
              ? `border-dashed ${scheme.border}`
              : scheme.border;

  // 定位闪烁动画
  const locateClass = locating ? 'animate-pulse ring-2 ring-blue-400 ring-offset-2' : '';

  // 动态锚点模式：渲染派生的 source / target Handle
  const useDynamicAnchors = dynamicAnchors !== undefined;
  const sourceAnchors = dynamicAnchors?.sourceAnchors ?? [];
  const targetAnchors = dynamicAnchors?.targetAnchors ?? [];

  // 行数：source 与 target 共享行，行数取较大值
  // 行 0 = source[0] + target[0]，行 1 = source[1] + target[1]，...
  // 这样每个 Handle 与同行标签垂直对齐，用户一眼可见"事件/动作 → 引脚"映射
  const rowCount = Math.max(sourceAnchors.length, targetAnchors.length);

  // 测量锚点列表容器相对节点顶部的偏移（px），用于计算 Handle 的 top 像素位置。
  // useLayoutEffect 在 DOM 变更后同步执行，浏览器绘制前完成，避免闪烁。
  // jsdom 中 getBoundingClientRect 全 0，anchorOffset=0，Handle 位置退化为
  // idx * 24 + 12，测试据此断言。
  const nodeRef = useRef<HTMLDivElement>(null);
  const anchorListRef = useRef<HTMLDivElement>(null);
  const [anchorOffset, setAnchorOffset] = useState(0);

  useLayoutEffect(() => {
    const nodeEl = nodeRef.current;
    const anchorListEl = anchorListRef.current;
    if (!nodeEl || !anchorListEl) return;
    const nodeRect = nodeEl.getBoundingClientRect();
    const anchorRect = anchorListEl.getBoundingClientRect();
    setAnchorOffset(anchorRect.top - nodeRect.top);
  }, [typeLabel, label, sourceAnchors.length, targetAnchors.length]);

  /** 计算 idx 行 Handle 的 top（px），垂直居中于该行 */
  const getHandleTop = (idx: number): number =>
    anchorOffset + idx * ANCHOR_ROW_HEIGHT + ANCHOR_ROW_HEIGHT / 2;

  return (
    <div
      ref={nodeRef}
      className={cn(
        'group relative min-w-[200px] max-w-[280px] rounded-xl border py-2.5 pl-4 pr-3',
        'shadow-sm transition-[border-color,box-shadow] duration-150 hover:shadow-md',
        scheme.bg,
        borderClass,
        locateClass,
      )}
      data-testid="blueprint-node"
      data-node-id={nodeId}
      data-node-kind={colorScheme}
      data-blueprint-node-selected={selected}
      data-blueprint-node-dangling={dangling}
      data-blueprint-node-cycle={inCycle}
      data-blueprint-node-diagnostic={diagnosticLevel ?? undefined}
      data-locating={locating || undefined}
      data-dashed={dashed || undefined}
      data-dynamic-anchors={useDynamicAnchors || undefined}
    >
      {/* 左侧类型色条：不读文字即可识别节点类别 */}
      <span
        aria-hidden="true"
        className={cn('absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full', scheme.accentBar)}
      />

      {useDynamicAnchors ? (
        <>
          {/* 动态 target 锚点（左侧）：每个动作一个 Handle，top 与对应行对齐。
           * 动作（输入）放在左侧，事件（输出）放在右侧，数据流从左到右：源节点 → 目标节点。 */}
          {targetAnchors.map((anchor, idx) => (
            <Handle
              key={anchor.id}
              type="target"
              position={Position.Left}
              id={anchor.id}
              style={{ top: `${getHandleTop(idx)}px` }}
              className={HANDLE_TARGET_CLASS}
            />
          ))}
          {/* 动态 source 锚点（右侧）：每个事件一个 Handle，top 与对应行对齐 */}
          {sourceAnchors.map((anchor, idx) => (
            <Handle
              key={anchor.id}
              type="source"
              position={Position.Right}
              id={anchor.id}
              style={{ top: `${getHandleTop(idx)}px` }}
              className={HANDLE_SOURCE_CLASS}
            />
          ))}
        </>
      ) : (
        <>
          {showInputHandle && (
            <Handle
              type="target"
              position={Position.Left}
              id="in"
              className={HANDLE_NEUTRAL_CLASS}
            />
          )}
        </>
      )}

      {/* 头部：图标 + 类型标签 + 节点名称 */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 dark:ring-white/10',
            scheme.iconBg,
            scheme.text,
          )}
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className={cn('text-[10px] font-medium uppercase tracking-wider', scheme.text)}>
            {typeLabel}
          </span>
          <span
            className="truncate text-sm font-semibold leading-tight text-foreground"
            title={label}
          >
            {label}
          </span>
        </div>
      </div>

      {/* 动态锚点行列表（仅在启用 dynamicAnchors 且有锚点时显示）。
       * 布局：target（动作）在左、source（事件）在右，符合"左→右"数据流约定。
       * 每行高度 = ANCHOR_ROW_HEIGHT，Handle 的 top 通过 getHandleTop(idx) 与该行垂直居中对齐。
       *
       * 视觉设计：
       * - target（动作，左）：sky 圆点 + sky 文字，圆点靠近左侧 Handle
       * - source（事件，右）：emerald 文字 + emerald 圆点，圆点靠近右侧 Handle
       * - 行 hover 背景 + crosshair 光标：提示"可从该行拖出/接入连线"
       */}
      {useDynamicAnchors && rowCount > 0 && (
        <div className="mt-2 border-t border-border/40 pt-1.5">
          <div ref={anchorListRef}>
            {Array.from({ length: rowCount }).map((_, rowIdx) => {
              const source = sourceAnchors[rowIdx];
              const target = targetAnchors[rowIdx];
              return (
                <div
                  key={rowIdx}
                  className="-mx-1 flex cursor-crosshair items-center gap-2 rounded px-1 transition-colors hover:bg-accent/60"
                  style={{ height: `${ANCHOR_ROW_HEIGHT}px` }}
                  data-anchor-row={rowIdx}
                >
                  {/* target（动作）标签：左侧，靠近左侧 Handle */}
                  <div className="flex min-w-0 flex-1 items-center">
                    {target && (
                      <div
                        className="flex min-w-0 items-center gap-1.5"
                        data-anchor-id={target.id}
                        data-anchor-side="target"
                      >
                        <span className="size-1.5 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400" />
                        <span className="truncate text-xs font-medium text-sky-700 dark:text-sky-300">
                          {target.label}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* source（事件）标签：右侧，靠近右侧 Handle */}
                  <div className="flex min-w-0 flex-1 items-center justify-end">
                    {source && (
                      <div
                        className="flex min-w-0 items-center gap-1.5"
                        data-anchor-id={source.id}
                        data-anchor-side="source"
                      >
                        <span className="truncate text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          {source.label}
                        </span>
                        <span className="size-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {children && <div className="mt-2 border-t border-border/40 pt-2">{children}</div>}

      {!useDynamicAnchors && showOutputHandle && outputHandleMode === 'single' && (
        <Handle type="source" position={Position.Right} id="out" className={HANDLE_NEUTRAL_CLASS} />
      )}
      {!useDynamicAnchors && showOutputHandle && outputHandleMode === 'then-else' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="then"
            style={{ top: '40%' }}
            className={HANDLE_SOURCE_CLASS}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="else"
            style={{ top: '70%' }}
            className={HANDLE_ELSE_CLASS}
          />
        </>
      )}
    </div>
  );
}
