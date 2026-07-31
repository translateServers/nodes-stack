/**
 * 统一工具注册表（单一数据源）
 *
 * 定义所有编辑器工具的元数据、能力与实现状态。
 * 供工具入口、状态栏、快捷键帮助和画布共同消费。
 *
 * 所有权边界：
 * - 本注册表拥有：工具 ID、名称、图标、`shortcutId`、cursor、能力、实现状态
 * - `SHORTCUTS_REGISTRY` 拥有：实际键位、scope、`preventDefault`、浏览器冲突信息
 * - 两者通过 `shortcutId` 建立唯一引用，不重复保存实际键位字符串
 */

import {
  MousePointer2,
  Hand,
  Type,
  Square,
  Circle,
  Image as ImageIcon,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';

/** 编辑器工具 ID */
export type EditorTool = 'select' | 'hand' | 'text' | 'rect' | 'ellipse' | 'image' | 'zoom';

/** 工具能力定义 */
export interface ToolCapabilities {
  /** 允许 Selecto 选择组件 */
  readonly canSelect: boolean;
  /** 允许 Moveable 拖拽组件 */
  readonly canDrag: boolean;
  /** 允许 Moveable 缩放组件 */
  readonly canResize: boolean;
  /** 允许 Moveable 旋转组件 */
  readonly canRotate: boolean;
  /** 允许画布平移（主指针拖动） */
  readonly canPan: boolean;
  /** 允许创建新组件 */
  readonly canCreate: boolean;
  /** 允许点击缩放视口 */
  readonly canZoom: boolean;
}

/** 工具定义 */
export interface ToolDefinition {
  /** 工具唯一 ID */
  readonly id: EditorTool;
  /** 中文显示名称 */
  readonly name: string;
  /** lucide-react 图标组件 */
  readonly icon: LucideIcon;
  /** 引用 SHORTCUTS_REGISTRY 的快捷键 ID，null 表示无快捷键 */
  readonly shortcutId: string | null;
  /** 画布 cursor CSS 值 */
  readonly cursor: string;
  /** 工具能力 */
  readonly capabilities: ToolCapabilities;
  /** 是否已实现真实画布行为 */
  readonly implemented: boolean;
}

/** 全部能力（选择工具） */
const FULL_EDIT_CAPABILITIES: ToolCapabilities = {
  canSelect: true,
  canDrag: true,
  canResize: true,
  canRotate: true,
  canPan: false,
  canCreate: false,
  canZoom: false,
};

/** 无编辑能力（非选择工具的基线） */
const NO_EDIT_CAPABILITIES: ToolCapabilities = {
  canSelect: false,
  canDrag: false,
  canResize: false,
  canRotate: false,
  canPan: false,
  canCreate: false,
  canZoom: false,
};

/**
 * 工具注册表
 *
 * 阶段 1 实施状态：
 * - select: 已实现（Selecto/Moveable 始终启用）
 * - hand: 已实现（任务 4.2 让 activeTool==='hand' 直接平移）
 * - text/rect/ellipse/image/zoom: 已实现（任务 5-8 闭环）
 * - 吸管工具已移出阶段 1 范围（无调色板等应用场景，不宣称无效能力）
 */
export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  {
    id: 'select',
    name: '选择',
    icon: MousePointer2,
    shortcutId: 'toolSelect',
    cursor: 'default',
    capabilities: FULL_EDIT_CAPABILITIES,
    implemented: true,
  },
  {
    id: 'hand',
    name: '抓手',
    icon: Hand,
    shortcutId: 'toolHand',
    cursor: 'grab',
    capabilities: {
      ...NO_EDIT_CAPABILITIES,
      canPan: true,
    },
    implemented: true,
  },
  {
    id: 'text',
    name: '文字',
    icon: Type,
    shortcutId: 'toolText',
    cursor: 'text',
    capabilities: {
      ...NO_EDIT_CAPABILITIES,
      canCreate: true,
    },
    implemented: true,
  },
  {
    id: 'rect',
    name: '矩形',
    icon: Square,
    shortcutId: 'toolRect',
    cursor: 'crosshair',
    capabilities: {
      ...NO_EDIT_CAPABILITIES,
      canCreate: true,
    },
    implemented: true,
  },
  {
    id: 'ellipse',
    name: '椭圆',
    icon: Circle,
    shortcutId: 'toolEllipse',
    cursor: 'crosshair',
    capabilities: {
      ...NO_EDIT_CAPABILITIES,
      canCreate: true,
    },
    implemented: true,
  },
  {
    id: 'image',
    name: '图片',
    icon: ImageIcon,
    shortcutId: 'toolImage',
    cursor: 'crosshair',
    capabilities: {
      ...NO_EDIT_CAPABILITIES,
      canCreate: true,
    },
    implemented: true,
  },
  {
    id: 'zoom',
    name: '缩放',
    icon: ZoomIn,
    shortcutId: 'toolZoom',
    cursor: 'zoom-in',
    capabilities: {
      ...NO_EDIT_CAPABILITIES,
      canZoom: true,
    },
    implemented: true,
  },
];

/** 根据 ID 查找工具定义 */
export function getToolById(id: EditorTool): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.id === id);
}

/** 获取已实现的工具列表 */
export function getImplementedTools(): ToolDefinition[] {
  return TOOL_REGISTRY.filter((t) => t.implemented);
}

/** 检查工具是否具有指定能力 */
export function hasCapability(id: EditorTool, capability: keyof ToolCapabilities): boolean {
  const tool = getToolById(id);
  return tool?.capabilities[capability] ?? false;
}
