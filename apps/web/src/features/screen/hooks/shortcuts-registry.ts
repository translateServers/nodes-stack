/**
 * 快捷键注册表（单一数据源）
 *
 * 同时作为 use-keyboard-shortcuts.ts 的注册数据源和
 * shortcuts-help-dialog.tsx 的渲染数据源，避免描述与实际绑定脱节。
 *
 * 键位表达式遵循 react-hotkeys-hook 约定：
 * - `mod` 跨平台修饰键（Mac→Cmd，Win/Linux→Ctrl）
 * - 多个键用逗号分隔表示"任一触发"
 * - 组合键用 `+` 连接
 */

export type ShortcutCategory = 'file' | 'edit' | 'view' | 'component' | 'align' | 'help';

export type ShortcutScope = 'global' | 'canvas';

export interface ShortcutDefinition {
  /** 唯一标识，用于在 use-keyboard-shortcuts.ts 中查找 */
  id: string;
  /** react-hotkeys-hook 的键位表达式，如 'mod+s' */
  keys: string;
  /** 中文描述，用于帮助面板 */
  description: string;
  /** 分组，用于帮助面板分类展示 */
  category: ShortcutCategory;
  /**
   * 作用域：
   * - 'global'：始终生效（含输入框聚焦时通过 enableOnFormTags 控制）
   * - 'canvas'：仅在画布激活（非文本编辑、非输入框聚焦）时触发
   */
  scope: ShortcutScope;
}

export const SHORTCUTS_REGISTRY: readonly ShortcutDefinition[] = [
  // 文件
  { id: 'save', keys: 'mod+s', description: '保存项目', category: 'file', scope: 'global' },

  // 编辑
  {
    id: 'undo',
    keys: 'mod+z',
    description: '撤销',
    category: 'edit',
    scope: 'global',
  },
  {
    id: 'redo',
    keys: 'mod+shift+z',
    description: '重做',
    category: 'edit',
    scope: 'global',
  },
  {
    id: 'delete',
    keys: 'delete,backspace',
    description: '删除选中',
    category: 'edit',
    scope: 'canvas',
  },
  { id: 'selectAll', keys: 'mod+a', description: '全选', category: 'edit', scope: 'canvas' },
  { id: 'copy', keys: 'mod+c', description: '复制', category: 'edit', scope: 'canvas' },
  { id: 'paste', keys: 'mod+v', description: '粘贴', category: 'edit', scope: 'canvas' },
  {
    id: 'duplicate',
    keys: 'mod+d',
    description: '原地复制',
    category: 'edit',
    scope: 'canvas',
  },

  // 视图
  {
    id: 'zoomIn',
    keys: 'mod+=',
    description: '放大画布',
    category: 'view',
    scope: 'global',
  },
  {
    id: 'zoomOut',
    keys: 'mod+-',
    description: '缩小画布',
    category: 'view',
    scope: 'global',
  },
  {
    id: 'fitToScreen',
    keys: 'mod+0',
    description: '适应屏幕',
    category: 'view',
    scope: 'global',
  },
  {
    id: 'toggleBorderGuides',
    keys: 'mod+k',
    description: '切换边框参考线',
    category: 'view',
    scope: 'canvas',
  },
  {
    id: 'toggleGuides',
    keys: 'mod+;',
    description: '切换参考线显示',
    category: 'view',
    scope: 'global',
  },

  // 组件
  {
    id: 'bringToFront',
    keys: 'mod+]',
    description: '置顶',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'sendToBack',
    keys: 'mod+[',
    description: '置底',
    category: 'component',
    scope: 'canvas',
  },
  { id: 'group', keys: 'mod+g', description: '成组', category: 'component', scope: 'canvas' },
  {
    id: 'ungroup',
    keys: 'mod+shift+g',
    description: '解组',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'lock',
    keys: 'mod+l',
    description: '锁定选中',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'unlock',
    keys: 'mod+shift+l',
    description: '解锁选中',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'hide',
    keys: 'mod+h',
    description: '隐藏选中',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'clearSelection',
    keys: 'escape',
    description: '清空选中',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'nudgeUp',
    keys: 'up',
    description: '上移 1px',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'nudgeDown',
    keys: 'down',
    description: '下移 1px',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'nudgeLeft',
    keys: 'left',
    description: '左移 1px',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'nudgeRight',
    keys: 'right',
    description: '右移 1px',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'nudgeUp10',
    keys: 'shift+up',
    description: '上移 10px',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'nudgeDown10',
    keys: 'shift+down',
    description: '下移 10px',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'nudgeLeft10',
    keys: 'shift+left',
    description: '左移 10px',
    category: 'component',
    scope: 'canvas',
  },
  {
    id: 'nudgeRight10',
    keys: 'shift+right',
    description: '右移 10px',
    category: 'component',
    scope: 'canvas',
  },

  // 对齐
  {
    id: 'alignLeft',
    keys: 'mod+alt+l',
    description: '左对齐',
    category: 'align',
    scope: 'canvas',
  },
  {
    id: 'alignCenterH',
    keys: 'mod+alt+c',
    description: '水平居中',
    category: 'align',
    scope: 'canvas',
  },
  {
    id: 'alignRight',
    keys: 'mod+alt+r',
    description: '右对齐',
    category: 'align',
    scope: 'canvas',
  },
  {
    id: 'alignTop',
    keys: 'mod+alt+t',
    description: '顶对齐',
    category: 'align',
    scope: 'canvas',
  },
  {
    id: 'alignMiddleV',
    keys: 'mod+alt+m',
    description: '垂直居中',
    category: 'align',
    scope: 'canvas',
  },
  {
    id: 'alignBottom',
    keys: 'mod+alt+b',
    description: '底对齐',
    category: 'align',
    scope: 'canvas',
  },
  {
    id: 'distributeH',
    keys: 'mod+alt+h',
    description: '水平等距分布',
    category: 'align',
    scope: 'canvas',
  },
  {
    id: 'distributeV',
    keys: 'mod+alt+v',
    description: '垂直等距分布',
    category: 'align',
    scope: 'canvas',
  },

  // 帮助
  {
    id: 'showHelp',
    keys: 'mod+/',
    description: '快捷键帮助',
    category: 'help',
    scope: 'global',
  },
] as const;

/** 帮助面板分组顺序与中文名 */
export const SHORTCUT_CATEGORY_LABELS: Readonly<Record<ShortcutCategory, string>> = {
  file: '文件',
  edit: '编辑',
  view: '视图',
  component: '组件',
  align: '对齐',
  help: '帮助',
};

/** 根据 id 查找快捷键定义 */
export function getShortcutById(id: string): ShortcutDefinition | undefined {
  return SHORTCUTS_REGISTRY.find((s) => s.id === id);
}

/** 根据 id 获取快捷键表达式（如 'mod+s'），未找到返回 null */
export function getShortcutKeys(id: string): string | null {
  return getShortcutById(id)?.keys ?? null;
}

/** 判断当前是否为 macOS（用于帮助面板渲染 mod 键的展示形式） */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/i.test(navigator.platform);
}

/**
 * 将键位表达式渲染为可读的按键序列。
 * 例：'mod+shift+z' → ['Ctrl', 'Shift', 'Z']（Win）或 ['⌘', 'Shift', 'Z']（Mac）
 * 多个键位用逗号分隔时只显示第一个（如 'delete,backspace' → ['Delete']）
 *
 * 共享给 shortcuts-help-dialog、菜单项 ShortcutBadge 等，避免重复实现。
 */
export function formatKeys(keys: string): string[] {
  const mac = isMac();
  const first = keys.split(',')[0]?.trim() ?? '';
  return first.split('+').map((k) => {
    const key = k.trim();
    switch (key) {
      case 'mod':
        return mac ? '⌘' : 'Ctrl';
      case 'shift':
        return 'Shift';
      case 'alt':
        return mac ? 'Option' : 'Alt';
      case 'ctrl':
        return mac ? '⌃' : 'Ctrl';
      default:
        // 单字母大写显示
        return key.length === 1 ? key.toUpperCase() : key;
    }
  });
}
