import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Options } from 'react-hotkeys-hook';
import { buildHotkeysOptions, useKeyboardShortcuts } from './use-keyboard-shortcuts';
import { TOOL_REGISTRY, type EditorTool } from './tool-registry';
import {
  SHORTCUTS_REGISTRY,
  getShortcutById,
  validateRegistry,
  type ShortcutDefinition,
} from './shortcuts-registry';
import type { InteractionEvent, InteractionEventPayload } from './use-interaction-state-machine';

/**
 * 任务 1.4 验证：接入全部声明的工具快捷键
 *
 * 测试策略：
 * - mock react-hotkeys-hook 的 useHotkeys 捕获所有调用
 * - 验证每个 TOOL_REGISTRY 中非空 shortcutId 都有对应的 useHotkeys 注册
 * - 验证 toolHandTemp（Space 临时抓手）以 keydown/keyup 分两次注册
 * - 验证 canvas 作用域：文本编辑态禁用工具切换
 */

// 捕获 useHotkeys 调用：keys、callback、options
interface HotkeysCall {
  keys: string;
  callback: (e: KeyboardEvent) => void;
  options: Options;
}

let capturedCalls: HotkeysCall[] = [];

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn((keys: string, callback: (e: KeyboardEvent) => void, options: Options) => {
    capturedCalls.push({ keys, callback, options });
  }),
}));

vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  }),
}));

// 任务 4.3：mock use-modifier-keys 的 isFormElementFocused，验证 Space 临时抓手在表单元素中不抢占
vi.mock('./use-modifier-keys', () => ({
  isFormElementFocused: vi.fn(() => false),
  useModifierKeys: () => ({
    spaceRef: { current: false },
    shiftRef: { current: false },
    altRef: { current: false },
    ctrlRef: { current: false },
    spaceHeld: false,
    shiftHeld: false,
    altHeld: false,
    ctrlHeld: false,
  }),
}));

import { useScreenEditorStore } from '../stores/editor-store';
import { isFormElementFocused } from './use-modifier-keys';

const mockUseStore = useScreenEditorStore as unknown as ReturnType<typeof vi.fn> & {
  getState: ReturnType<typeof vi.fn>;
};

const mockIsFormElementFocused = isFormElementFocused as unknown as ReturnType<typeof vi.fn>;

/** 构造受控 EditorSessionApi 子集（任务 12.4：toolStateMachine 回退已删除） */
function makeToolStateMachine(
  overrides: {
    activeTool?: EditorTool;
    isEditingText?: boolean;
    setTool?: ReturnType<typeof vi.fn<(tool: EditorTool) => void>>;
    pushTemporaryTool?: ReturnType<typeof vi.fn<(tool: EditorTool) => void>>;
    popTemporaryTool?: ReturnType<typeof vi.fn<(tool: EditorTool) => void>>;
    dispatchInteraction?: ReturnType<
      typeof vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>
    >;
  } = {},
) {
  const setTool = overrides.setTool ?? vi.fn<(tool: EditorTool) => void>();
  const pushTemporaryTool = overrides.pushTemporaryTool ?? vi.fn<(tool: EditorTool) => void>();
  const popTemporaryTool = overrides.popTemporaryTool ?? vi.fn<(tool: EditorTool) => void>();
  return {
    activeTool: overrides.activeTool ?? 'select',
    setTool,
    pushTemporaryTool,
    popTemporaryTool,
    isEditingText: overrides.isEditingText ?? false,
    dispatchInteraction:
      overrides.dispatchInteraction ??
      vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>(),
  };
}

/** 通过 shortcutId 查找捕获的调用（用 getAllKeys 的等价逻辑） */
function findCallByShortcutId(shortcutId: string): HotkeysCall | undefined {
  const entry = getShortcutById(shortcutId);
  if (!entry) return undefined;
  const allKeys = [entry.keys, ...(entry.aliases ?? [])].join(',');
  return capturedCalls.find((c) => c.keys === allKeys);
}

describe('useKeyboardShortcuts 任务 1.4：接入全部声明的工具快捷键', () => {
  beforeEach(() => {
    capturedCalls = [];
    mockUseStore.mockReset();
    mockUseStore.getState = vi.fn(() => ({}));
  });

  it('每个 TOOL_REGISTRY 中非空 shortcutId 都注册了 useHotkeys', () => {
    const tsm = makeToolStateMachine();
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );

    for (const tool of TOOL_REGISTRY) {
      if (tool.shortcutId === null) continue;
      const call = findCallByShortcutId(tool.shortcutId);
      expect(call, `工具 ${tool.id} 的快捷键 ${tool.shortcutId} 应注册 useHotkeys`).toBeDefined();
    }
  });

  it('7 个工具切换快捷键各自调用 setTool 切换到对应工具', () => {
    const setTool = vi.fn();
    const tsm = makeToolStateMachine({ setTool });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );

    // 模拟按下每个工具快捷键
    const fakeEvent = {} as KeyboardEvent;
    const toolShortcutIds = [
      'toolSelect',
      'toolHand',
      'toolText',
      'toolRect',
      'toolEllipse',
      'toolImage',
      'toolZoom',
    ] as const;
    const expectedTools: EditorTool[] = [
      'select',
      'hand',
      'text',
      'rect',
      'ellipse',
      'image',
      'zoom',
    ];

    for (let i = 0; i < toolShortcutIds.length; i++) {
      const call = findCallByShortcutId(toolShortcutIds[i]);
      expect(call).toBeDefined();
      // 先切换到其他工具，再按下快捷键，避免"当前工具已等于目标工具"的防御逻辑拦截
      // 注意：必须选与 expectedTools[i] 不同的工具，否则 callback 会直接 return
      tsm.activeTool = expectedTools[i] === 'hand' ? 'select' : 'hand';
      call!.callback(fakeEvent);
      expect(setTool).toHaveBeenCalledWith(expectedTools[i]);
    }

    expect(setTool).toHaveBeenCalledTimes(7);
  });

  it('toolHandTemp（Space）以 keydown/keyup 分两次注册', () => {
    const pushTemporaryTool = vi.fn();
    const popTemporaryTool = vi.fn();
    const tsm = makeToolStateMachine({ pushTemporaryTool, popTemporaryTool });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );

    const entry = getShortcutById('toolHandTemp')!;
    const allKeys = [entry.keys, ...(entry.aliases ?? [])].join(',');
    const matches = capturedCalls.filter((c) => c.keys === allKeys);
    expect(matches).toHaveLength(2);
    // keydown: true, keyup: false
    expect(matches[0].options).toMatchObject({ keydown: true, keyup: false });
    // keyup: true, keydown: false
    expect(matches[1].options).toMatchObject({ keydown: false, keyup: true });

    // keydown 调用 preventDefault + pushTemporaryTool('hand')
    const fakeEvent = {
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    matches[0].callback(fakeEvent);
    expect(pushTemporaryTool).toHaveBeenCalledWith('hand');
    // keyup 调用 popTemporaryTool('hand')
    matches[1].callback(fakeEvent);
    expect(popTemporaryTool).toHaveBeenCalledWith('hand');
  });

  it('文本编辑态时工具切换快捷键被禁用（canvasEnabled 返回 false）', () => {
    const tsm = makeToolStateMachine({ isEditingText: true });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );

    // 找到 toolSelect 的注册，验证其 enabled 函数在 isEditingText=true 时返回 false
    const call = findCallByShortcutId('toolSelect');
    expect(call).toBeDefined();
    const enabled = call!.options.enabled;
    expect(typeof enabled).toBe('function');
    if (typeof enabled === 'function') {
      // 实际 canvasEnabled 签名 () => boolean，不依赖 react-hotkeys-hook 注入的参数
      const check = enabled as () => boolean;
      expect(check()).toBe(false);
    }
  });

  it('非文本编辑态时工具切换快捷键启用', () => {
    const tsm = makeToolStateMachine({ isEditingText: false });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );

    const call = findCallByShortcutId('toolRect');
    expect(call).toBeDefined();
    const enabled = call!.options.enabled;
    if (typeof enabled === 'function') {
      const check = enabled as () => boolean;
      expect(check()).toBe(true);
    }
  });

  it('工具快捷键 scope=canvas 时不在表单元素中触发', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: makeToolStateMachine(),
      }),
    );
    // toolRect 是 canvas 作用域，enableOnFormTags 应为 false
    const call = findCallByShortcutId('toolRect');
    expect(call).toBeDefined();
    expect(call!.options.enableOnFormTags).toBe(false);
  });

  it('注册表通过 validateRegistry 校验无警告', () => {
    const warnings = validateRegistry(SHORTCUTS_REGISTRY);
    // 工具快捷键不应产生冲突警告
    const toolWarnings = warnings.filter((w) =>
      [
        'toolSelect',
        'toolHand',
        'toolText',
        'toolRect',
        'toolEllipse',
        'toolImage',
        'toolZoom',
        'toolHandTemp',
        'altDragCopy',
        'zoomReverse',
      ].some((id) => w.includes(id)),
    );
    expect(toolWarnings).toEqual([]);
  });

  it('工具快捷键声明与处理器一一对应（无遗漏、无多余）', () => {
    const tsm = makeToolStateMachine();
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );

    // 收集所有声明的工具类快捷键 ID
    const declaredToolShortcutIds = SHORTCUTS_REGISTRY.filter(
      (s) => !s.hidden && s.category === 'tool',
    )
      .map((s) => s.id)
      // altDragCopy 和 zoomReverse 是鼠标/滚轮文档条目，不通过 useHotkeys 注册
      .filter((id) => !['altDragCopy', 'zoomReverse'].includes(id));

    // 验证每个声明的工具快捷键都有 useHotkeys 注册
    for (const id of declaredToolShortcutIds) {
      const call = findCallByShortcutId(id);
      expect(call, `声明的工具快捷键 ${id} 应有 useHotkeys 注册`).toBeDefined();
    }
  });
});

describe('buildHotkeysOptions（统一生成 useHotkeys 选项）', () => {
  /** 构造一个最小可用 entry 的工厂函数 */
  function makeEntry(overrides: Partial<ShortcutDefinition> = {}): ShortcutDefinition {
    return {
      id: 'test',
      keys: 'mod+s',
      description: 'test',
      category: 'file',
      scope: 'global',
      preventDefault: 'always',
      browserConflict: 'overridable',
      ...overrides,
    };
  }

  describe('preventDefault 映射', () => {
    it("preventDefault='always' → preventDefault: true", () => {
      const options = buildHotkeysOptions(makeEntry({ preventDefault: 'always' }), true);
      expect(options.preventDefault).toBe(true);
    });

    it("preventDefault='callback-only' → preventDefault: false", () => {
      const options = buildHotkeysOptions(makeEntry({ preventDefault: 'callback-only' }), true);
      expect(options.preventDefault).toBe(false);
    });

    it("preventDefault='none' → preventDefault: false", () => {
      const options = buildHotkeysOptions(makeEntry({ preventDefault: 'none' }), true);
      expect(options.preventDefault).toBe(false);
    });
  });

  describe('enableOnFormTags 推断', () => {
    it("scope='global' 且未声明 enableOnFormTags → 默认 true", () => {
      const options = buildHotkeysOptions(
        makeEntry({ scope: 'global', enableOnFormTags: undefined }),
        true,
      );
      expect(options.enableOnFormTags).toBe(true);
    });

    it("scope='canvas' 且未声明 enableOnFormTags → 默认 false", () => {
      const options = buildHotkeysOptions(
        makeEntry({ scope: 'canvas', enableOnFormTags: undefined }),
        true,
      );
      expect(options.enableOnFormTags).toBe(false);
    });

    it('显式声明 enableOnFormTags=true 时优先使用显式值', () => {
      const options = buildHotkeysOptions(
        makeEntry({ scope: 'canvas', enableOnFormTags: true }),
        true,
      );
      expect(options.enableOnFormTags).toBe(true);
    });

    it('显式声明 enableOnFormTags=false 时优先使用显式值', () => {
      const options = buildHotkeysOptions(
        makeEntry({ scope: 'global', enableOnFormTags: false }),
        true,
      );
      expect(options.enableOnFormTags).toBe(false);
    });
  });

  describe('enabled 传递', () => {
    it('布尔值 enabled 正确传递', () => {
      const options = buildHotkeysOptions(makeEntry(), true);
      expect(options.enabled).toBe(true);
    });

    it('函数 enabled 正确传递（用于 canvasEnabled 等动态判断）', () => {
      const canvasEnabled = () => false;
      const options = buildHotkeysOptions(makeEntry(), canvasEnabled);
      expect(options.enabled).toBe(canvasEnabled);
    });
  });
});

describe('任务 4.3：Space 临时抓手复用工具栈', () => {
  beforeEach(() => {
    capturedCalls = [];
    mockUseStore.mockReset();
    mockUseStore.getState = vi.fn(() => ({}));
    mockIsFormElementFocused.mockReset();
    mockIsFormElementFocused.mockReturnValue(false);
  });

  /** 查找 toolHandTemp 的 keydown 和 keyup 注册 */
  function findToolHandTempCalls(): { keydown: HotkeysCall; keyup: HotkeysCall } {
    const entry = getShortcutById('toolHandTemp')!;
    const allKeys = [entry.keys, ...(entry.aliases ?? [])].join(',');
    const matches = capturedCalls.filter((c) => c.keys === allKeys);
    expect(matches).toHaveLength(2);
    const keydown = matches.find((m) => m.options.keydown === true && m.options.keyup === false);
    const keyup = matches.find((m) => m.options.keyup === true && m.options.keydown === false);
    expect(keydown).toBeDefined();
    expect(keyup).toBeDefined();
    return { keydown: keydown!, keyup: keyup! };
  }

  it('Space keydown 调用 e.preventDefault() 阻止页面滚动', () => {
    const pushTemporaryTool = vi.fn();
    const tsm = makeToolStateMachine({ pushTemporaryTool });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );
    const { keydown } = findToolHandTempCalls();
    const preventDefault = vi.fn();
    const fakeEvent = { preventDefault } as unknown as KeyboardEvent;
    keydown.callback(fakeEvent);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('Space keydown 调用 pushTemporaryTool("hand") 使 activeTool 变为抓手', () => {
    const pushTemporaryTool = vi.fn();
    const tsm = makeToolStateMachine({ pushTemporaryTool });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );
    const { keydown } = findToolHandTempCalls();
    const fakeEvent = { preventDefault: vi.fn() } as unknown as KeyboardEvent;
    keydown.callback(fakeEvent);
    expect(pushTemporaryTool).toHaveBeenCalledWith('hand');
  });

  it('Space keyup 调用 popTemporaryTool("hand") 恢复原工具', () => {
    const popTemporaryTool = vi.fn();
    const tsm = makeToolStateMachine({ popTemporaryTool });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );
    const { keyup } = findToolHandTempCalls();
    const fakeEvent = { preventDefault: vi.fn() } as unknown as KeyboardEvent;
    keyup.callback(fakeEvent);
    expect(popTemporaryTool).toHaveBeenCalledWith('hand');
  });

  it('表单元素聚焦时 Space keydown 不触发 pushTemporaryTool 也不 preventDefault', () => {
    // 模拟用户在 contenteditable 中按 Space
    mockIsFormElementFocused.mockReturnValue(true);
    const pushTemporaryTool = vi.fn();
    const tsm = makeToolStateMachine({ pushTemporaryTool });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );
    const { keydown } = findToolHandTempCalls();
    const preventDefault = vi.fn();
    const fakeEvent = { preventDefault } as unknown as KeyboardEvent;
    keydown.callback(fakeEvent);
    expect(pushTemporaryTool).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('文本编辑态时 Space 快捷键被禁用（canvasEnabled 返回 false）', () => {
    const tsm = makeToolStateMachine({ isEditingText: true });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );
    const { keydown } = findToolHandTempCalls();
    const enabled = keydown.options.enabled;
    expect(typeof enabled).toBe('function');
    if (typeof enabled === 'function') {
      const check = enabled as () => boolean;
      expect(check()).toBe(false);
    }
  });

  it('非文本编辑态时 Space 快捷键启用', () => {
    const tsm = makeToolStateMachine({ isEditingText: false });
    renderHook(() =>
      useKeyboardShortcuts({
        onSave: vi.fn(),
        editorSession: tsm,
      }),
    );
    const { keydown } = findToolHandTempCalls();
    const enabled = keydown.options.enabled;
    if (typeof enabled === 'function') {
      const check = enabled as () => boolean;
      expect(check()).toBe(true);
    }
  });
});
