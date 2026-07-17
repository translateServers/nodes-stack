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
 *
 * 防冲突方法论（详见 spec.md "快捷键防冲突方法论" 小节）：
 * - 每条条目必须显式声明 preventDefault 与 browserConflict 字段
 * - browserConflict='overridable' 必须搭配 preventDefault='always' 或 'callback-only'
 * - 新增快捷键前请按 spec.md 的检查清单自检
 */

export type ShortcutCategory =
  | 'file'
  | 'edit'
  | 'view'
  | 'component'
  | 'align'
  | 'help'
  | 'tool'
  | 'ui';

export type ShortcutScope = 'global' | 'canvas';

/** preventDefault 语义 */
export type PreventDefaultLevel = 'always' | 'callback-only' | 'none';

/** 浏览器冲突类别 */
export type BrowserConflict = 'reserved' | 'overridable' | 'none';

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
  /**
   * preventDefault 语义：
   * - 'always'：始终阻止默认行为（与浏览器原生冲突的键必须用此值）
   * - 'callback-only'：仅在 callback 执行路径内阻止（用于条件性 preventDefault，如 canvasEnabled 时才阻止）
   * - 'none'：不阻止默认行为
   */
  preventDefault: PreventDefaultLevel;
  /**
   * 浏览器冲突类别：
   * - 'reserved'：浏览器保留键，JS 无法拦截（F5、Ctrl+W 等）
   * - 'overridable'：浏览器有默认行为但 JS 可拦截
   * - 'none'：无浏览器默认行为冲突
   */
  browserConflict: BrowserConflict;
  /**
   * 是否在 input/textarea/select 中也触发；
   * 不传时按 scope 推断（global → true, canvas → false）
   */
  enableOnFormTags?: boolean;
  /** 别名键位（如 mod+= 的别名 mod+shift+=），与主键位行为完全一致 */
  aliases?: string[];
  /** 是否在帮助面板中隐藏（noop 拦截条目等设为 true） */
  hidden?: boolean;
}

export const SHORTCUTS_REGISTRY: readonly ShortcutDefinition[] = [
  // 文件
  {
    id: 'save',
    keys: 'mod+s',
    description: '保存项目',
    category: 'file',
    scope: 'global',
    preventDefault: 'always',
    browserConflict: 'overridable',
    enableOnFormTags: true,
  },

  // 编辑
  {
    id: 'undo',
    keys: 'mod+z',
    description: '撤销',
    category: 'edit',
    scope: 'global',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'redo',
    keys: 'mod+shift+z',
    description: '重做',
    category: 'edit',
    scope: 'global',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'delete',
    keys: 'delete,backspace',
    description: '删除选中',
    category: 'edit',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'selectAll',
    keys: 'mod+a',
    description: '全选',
    category: 'edit',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'copy',
    keys: 'mod+c',
    description: '复制',
    category: 'edit',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'paste',
    keys: 'mod+v',
    description: '粘贴',
    category: 'edit',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'duplicate',
    keys: 'mod+d',
    description: '原地复制',
    category: 'edit',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },

  // 视图
  {
    id: 'zoomIn',
    keys: 'mod+=',
    description: '放大画布',
    category: 'view',
    scope: 'global',
    preventDefault: 'always',
    browserConflict: 'overridable',
    enableOnFormTags: true,
    // US 键盘 + 需要 Shift+=，浏览器原生 Ctrl++ = Ctrl+Shift+=，加别名兼容
    aliases: ['mod+shift+='],
  },
  {
    id: 'zoomOut',
    keys: 'mod+-',
    description: '缩小画布',
    category: 'view',
    scope: 'global',
    preventDefault: 'always',
    browserConflict: 'overridable',
    enableOnFormTags: true,
  },
  {
    id: 'fitToScreen',
    keys: 'mod+0',
    description: '适应屏幕',
    category: 'view',
    scope: 'global',
    preventDefault: 'always',
    browserConflict: 'overridable',
    enableOnFormTags: true,
  },
  {
    id: 'toggleBorderGuides',
    keys: 'mod+k',
    description: '切换边框参考线',
    category: 'view',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'toggleGuides',
    keys: 'mod+;',
    description: '切换参考线显示',
    category: 'view',
    scope: 'global',
    preventDefault: 'always',
    browserConflict: 'none',
    enableOnFormTags: true,
  },

  // 组件
  {
    id: 'bringToFront',
    keys: 'mod+]',
    description: '置顶',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'sendToBack',
    keys: 'mod+[',
    description: '置底',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'group',
    keys: 'mod+g',
    description: '成组',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'ungroup',
    keys: 'mod+shift+g',
    description: '解组',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'lock',
    keys: 'mod+l',
    description: '锁定选中',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'unlock',
    keys: 'mod+shift+l',
    description: '解锁选中',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'hide',
    keys: 'mod+h',
    description: '隐藏选中',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'clearSelection',
    keys: 'escape',
    description: '清空选中',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'none',
    browserConflict: 'none',
  },
  {
    id: 'nudgeUp',
    keys: 'up',
    description: '上移 1px',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'nudgeDown',
    keys: 'down',
    description: '下移 1px',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'nudgeLeft',
    keys: 'left',
    description: '左移 1px',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'nudgeRight',
    keys: 'right',
    description: '右移 1px',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'nudgeUp10',
    keys: 'shift+up',
    description: '上移 10px',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'nudgeDown10',
    keys: 'shift+down',
    description: '下移 10px',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'nudgeLeft10',
    keys: 'shift+left',
    description: '左移 10px',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  {
    id: 'nudgeRight10',
    keys: 'shift+right',
    description: '右移 10px',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
  },
  // noop：拦截 Alt+方向键触发的浏览器历史导航（macOS / Firefox）
  {
    id: 'noopAltLeft',
    keys: 'alt+left',
    description: '拦截 Alt+Left（防浏览器历史导航）',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
    hidden: true,
  },
  {
    id: 'noopAltRight',
    keys: 'alt+right',
    description: '拦截 Alt+Right（防浏览器历史导航）',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
    hidden: true,
  },
  {
    id: 'noopAltUp',
    keys: 'alt+up',
    description: '拦截 Alt+Up（防浏览器历史导航）',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
    hidden: true,
  },
  {
    id: 'noopAltDown',
    keys: 'alt+down',
    description: '拦截 Alt+Down（防浏览器历史导航）',
    category: 'component',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
    hidden: true,
  },

  // 对齐
  {
    id: 'alignLeft',
    keys: 'mod+alt+l',
    description: '左对齐',
    category: 'align',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'alignCenterH',
    keys: 'mod+alt+c',
    description: '水平居中',
    category: 'align',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'alignRight',
    keys: 'mod+alt+r',
    description: '右对齐',
    category: 'align',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'alignTop',
    keys: 'mod+alt+t',
    description: '顶对齐',
    category: 'align',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'alignMiddleV',
    keys: 'mod+alt+m',
    description: '垂直居中',
    category: 'align',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'alignBottom',
    keys: 'mod+alt+b',
    description: '底对齐',
    category: 'align',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'distributeH',
    keys: 'mod+alt+h',
    description: '水平等距分布',
    category: 'align',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },
  {
    id: 'distributeV',
    keys: 'mod+alt+v',
    description: '垂直等距分布',
    category: 'align',
    scope: 'canvas',
    preventDefault: 'callback-only',
    browserConflict: 'none',
  },

  // 帮助
  {
    id: 'showHelp',
    keys: 'mod+/',
    description: '快捷键帮助',
    category: 'help',
    scope: 'global',
    preventDefault: 'always',
    browserConflict: 'none',
    enableOnFormTags: true,
  },

  // 工具
  {
    id: 'brushSizeDecrease',
    keys: '[',
    description: '减小画笔尺寸',
    category: 'tool',
    scope: 'canvas',
    preventDefault: 'none',
    browserConflict: 'none',
  },
  {
    id: 'brushSizeIncrease',
    keys: ']',
    description: '增大画笔尺寸',
    category: 'tool',
    scope: 'canvas',
    preventDefault: 'none',
    browserConflict: 'none',
  },
  {
    // 仅文档化：alt 作为临时吸管工具的修饰键，由 use-keyboard-shortcuts.ts
    // 通过 keydown/keyup 监听 altKey 实现，不通过 useHotkeys 绑定
    id: 'eyedropperTemp',
    keys: 'alt',
    description: '临时吸管（按住）',
    category: 'tool',
    scope: 'canvas',
    preventDefault: 'none',
    browserConflict: 'none',
  },

  // 界面
  {
    id: 'toggleUI',
    keys: 'tab',
    description: '切换面板显示',
    category: 'ui',
    scope: 'global',
    preventDefault: 'callback-only',
    browserConflict: 'overridable',
    // 故意禁用：保留 input/textarea 内 Tab 焦点切换
    enableOnFormTags: false,
  },
  {
    id: 'cycleScreenMode',
    keys: 'f',
    description: '切换屏幕模式',
    category: 'ui',
    scope: 'global',
    preventDefault: 'none',
    browserConflict: 'none',
  },
];

/** 帮助面板分组顺序与中文名 */
export const SHORTCUT_CATEGORY_LABELS: Readonly<Record<ShortcutCategory, string>> = {
  file: '文件',
  edit: '编辑',
  view: '视图',
  component: '组件',
  align: '对齐',
  help: '帮助',
  tool: '工具',
  ui: '界面',
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

/**
 * 校验 registry 是否符合防冲突方法论。
 * 返回违规条目的警告字符串数组（空数组表示全部合规）。
 *
 * 规则：
 * - browserConflict='overridable' 必须搭配 preventDefault='always' 或 'callback-only'
 * - browserConflict='reserved' 不应注册（JS 无法拦截）
 */
export function validateRegistry(registry: readonly ShortcutDefinition[]): string[] {
  const warnings: string[] = [];
  for (const entry of registry) {
    if (entry.browserConflict === 'overridable' && entry.preventDefault === 'none') {
      warnings.push(
        `[${entry.id}] browserConflict='overridable' 但 preventDefault='none'，将触发浏览器默认行为`,
      );
    }
    if (entry.browserConflict === 'reserved') {
      warnings.push(`[${entry.id}] browserConflict='reserved'，JS 无法拦截，注册无效`);
    }
  }
  return warnings;
}

if (import.meta.env.DEV) {
  const warnings = validateRegistry(SHORTCUTS_REGISTRY);
  if (warnings.length > 0) {
    console.warn('[shortcuts-registry] 防冲突校验警告：\n' + warnings.join('\n'));
  }
}
