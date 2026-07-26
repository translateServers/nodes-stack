/**
 * V2 蓝图搜索面板节点选项
 *
 * V2 节点 kind：component / condition / delay / comment
 * 全局节点子类型通过 component + globalType 表达，搜索面板分别提供入口。
 *
 * 与 V1 NODE_OPTIONS 的差异：
 * - 不再有 trigger / action kind
 * - 新增 delay 节点
 * - 新增 4 种全局节点（pageLoad / navigate / requestApi / scrollTo）
 * - 普通画布组件节点通过 buildComponentOptions 动态生成
 */

import type { JSX } from 'react';
import {
  Boxes,
  Clock,
  FileText,
  GitBranch,
  MessageSquare,
  MousePointerClick,
  Navigation,
  Send,
  Square,
  Type,
} from 'lucide-react';
import { GLOBAL_COMPONENT_ID, type ScreenComponent } from '@nebula/shared';

/** V2 节点 kind */
export type V2NodeKind = 'component' | 'condition' | 'delay' | 'comment';

/** V2 全局节点子类型（仅当 kind === 'component' 且 globalType 有值时为全局节点） */
export type V2GlobalSubtype = 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo';

/** 选项分组（用于搜索面板分区显示） */
export type V2NodeOptionGroup = 'canvas-component' | 'global' | 'logic';

/** V2 可插入节点选项 */
export interface V2NodeOption {
  /** 唯一标识 */
  id: string;
  /** 节点 kind */
  kind: V2NodeKind;
  /** 子类型标识（用于全局节点区分；其他节点为 kind 同名） */
  subtype: string;
  /** 全局节点子类型（仅全局节点有值） */
  globalType?: V2GlobalSubtype;
  /** 选项分组（影响搜索面板的分区显示） */
  group: V2NodeOptionGroup;
  /** 画布组件 ID（仅普通画布组件选项有值；用于 createV2NodeFromOption 生成 componentId） */
  componentId?: string;
  /** 显示名称 */
  label: string;
  /** 描述（用于模糊匹配） */
  description: string;
  /** 图标 */
  icon: JSX.Element;
}

/** V2 静态节点选项（逻辑节点 + 全局节点；画布组件选项由 buildComponentOptions 动态生成） */
export const V2_NODE_OPTIONS: readonly V2NodeOption[] = [
  {
    id: 'global.pageLoad',
    kind: 'component',
    subtype: 'globalPageLoad',
    globalType: 'pageLoad',
    group: 'global',
    label: '页面加载触发',
    description: '页面加载完成时触发执行',
    icon: <FileText className="size-4" />,
  },
  {
    id: 'global.navigate',
    kind: 'component',
    subtype: 'globalNavigate',
    globalType: 'navigate',
    group: 'global',
    label: '导航跳转',
    description: '跳转到指定 URL（仅 http/https）',
    icon: <Navigation className="size-4" />,
  },
  {
    id: 'global.requestApi',
    kind: 'component',
    subtype: 'globalRequestApi',
    globalType: 'requestApi',
    group: 'global',
    label: '请求接口',
    description: '发起 HTTP 请求',
    icon: <Send className="size-4" />,
  },
  {
    id: 'global.scrollTo',
    kind: 'component',
    subtype: 'globalScrollTo',
    globalType: 'scrollTo',
    group: 'global',
    label: '滚动定位',
    description: '滚动到指定组件位置',
    icon: <MousePointerClick className="size-4" />,
  },
  {
    id: 'condition',
    kind: 'condition',
    subtype: 'condition',
    group: 'logic',
    label: '条件分支',
    description: '根据条件表达式选择 then / else 分支执行',
    icon: <GitBranch className="size-4" />,
  },
  {
    id: 'delay',
    kind: 'delay',
    subtype: 'delay',
    group: 'logic',
    label: '延时',
    description: '延时指定毫秒后继续执行',
    icon: <Clock className="size-4" />,
  },
  {
    id: 'comment',
    kind: 'comment',
    subtype: 'comment',
    group: 'logic',
    label: '注释',
    description: '注释节点，不参与执行流',
    icon: <MessageSquare className="size-4" />,
  },
];

/**
 * 画布组件类型 → 图标的映射表。
 *
 * 仅对常见组件类型做语义化映射，未命中的类型回退到通用 Boxes 图标，
 * 避免每个组件都用相同的 Square 图标导致视觉单调。
 */
const COMPONENT_TYPE_ICON_MAP: Record<string, JSX.Element> = {
  'bar-chart': <Boxes className="size-4" />,
  'line-chart': <Boxes className="size-4" />,
  'pie-chart': <Boxes className="size-4" />,
  table: <Boxes className="size-4" />,
  text: <Type className="size-4" />,
};

function getComponentIcon(type: string): JSX.Element {
  return COMPONENT_TYPE_ICON_MAP[type] ?? <Square className="size-4" />;
}

/**
 * 根据当前画布组件列表动态生成"画布组件"选项。
 *
 * - 排除全局组件（GLOBAL_COMPONENT_ID）
 * - 排除没有 id 的组件（防御性）
 * - 选项 id 形如 `component.<componentId>`，避免与静态选项冲突
 * - group = 'canvas-component'，搜索面板据此分区显示
 *
 * 调用方：blueprint-sheet-v2.tsx 中将结果与 V2_NODE_OPTIONS 合并后传入 V2SearchPanel
 */
export function buildComponentOptions(components: readonly ScreenComponent[]): V2NodeOption[] {
  return components
    .filter((c) => c.id !== '' && c.id !== GLOBAL_COMPONENT_ID)
    .map((c) => {
      // ScreenComponent.name 是必填 string 字段，直接用作显示名（避免 props 的 unknown 类型）
      const label = c.name;
      return {
        id: `component.${c.id}`,
        kind: 'component' as const,
        subtype: 'component',
        group: 'canvas-component' as const,
        componentId: c.id,
        label,
        description: `${c.type} 组件`,
        icon: getComponentIcon(c.type),
      };
    });
}

/**
 * 合并静态选项与动态画布组件选项，作为搜索面板的完整选项列表。
 *
 * 顺序：画布组件 → 全局节点 → 逻辑节点
 * （用户最常添加画布组件节点，置顶便于检索）
 */
export function buildAllNodeOptions(components: readonly ScreenComponent[]): V2NodeOption[] {
  return [...buildComponentOptions(components), ...V2_NODE_OPTIONS];
}

/** V2 待完成连线的源信息（连线松手场景） */
export interface V2PendingConnection {
  sourceNodeId: string;
  /** 源锚点 id（evt:* / out / then / else） */
  sourceHandle: string;
}

/** V2 面板呼出场景 */
export type V2SearchPanelMode = 'create' | 'connect';

/**
 * V2 connect 模式下兼容目标节点判定。
 *
 * 兼容规则：
 * - comment 节点不参与连线 → 排除
 * - 源为 evt:* / out / then / else 时，目标可为 component（含全局非 pageLoad）/ condition / delay
 * - 全局 pageLoad 节点无输入锚点 → 排除
 */
export function isV2ConnectableTarget(option: V2NodeOption): boolean {
  if (option.kind === 'comment') return false;
  // 全局 pageLoad 节点只有输出，不能作为连线目标
  if (option.globalType === 'pageLoad') return false;
  return true;
}
