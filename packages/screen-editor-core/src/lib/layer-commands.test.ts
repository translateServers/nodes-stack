import { describe, expect, it, vi } from 'vitest';
import type { ScreenComponent } from '@nebula/shared';
import {
  getLayerCommandTargetIds,
  getVisibleLayerCommands,
  hasGroupedSelection,
  isAllHidden,
  isAllLocked,
  isLayerCommandEnabled,
  resolveLayerCommandIcon,
  resolveLayerCommandLabel,
  LAYER_COMMANDS,
  type LayerCommandContext,
  type LayerCommandStore,
} from './layer-commands';

/** 构造最小可用的 ScreenComponent mock */
function makeComp(overrides: Partial<ScreenComponent> & { id: string }): ScreenComponent {
  return {
    type: 'rect',
    name: `comp-${overrides.id}`,
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
    ...overrides,
  } as unknown as ScreenComponent;
}

/** 构造最小 mock store：所有方法都是 vi.fn，便于断言调用 */
function makeMockStore(): LayerCommandStore {
  return {
    renameComponent: vi.fn(),
    copySelectedToClipboard: vi.fn(),
    duplicateSelected: vi.fn(),
    setLocked: vi.fn(),
    setHidden: vi.fn(),
    reorderToTop: vi.fn(),
    reorderToBottom: vi.fn(),
    reorderLayerToIndex: vi.fn(),
    groupSelected: vi.fn(),
    ungroupSelected: vi.fn(),
    removeSelectedComponents: vi.fn(),
  };
}

/** 构造一个完整的 LayerCommandContext */
function makeCtx(overrides: Partial<LayerCommandContext> = {}): LayerCommandContext {
  return {
    selectedComponents: [],
    topLevelOrdered: [],
    store: makeMockStore(),
    ...overrides,
  };
}

function getCmd(id: string) {
  const cmd = LAYER_COMMANDS.find((c) => c.id === id);
  if (!cmd) throw new Error(`Command ${id} not found`);
  return cmd;
}

describe('layer-commands · 注册表完整性', () => {
  it('包含架构 §3.1 规定的全部命令', () => {
    const ids = LAYER_COMMANDS.map((c) => c.id);
    expect(ids).toEqual([
      'rename',
      'copy',
      'duplicate',
      'toggle-lock',
      'toggle-hide',
      'bring-to-front',
      'bring-forward',
      'send-backward',
      'send-to-back',
      'group',
      'ungroup',
      'delete',
    ]);
  });

  it('每个命令都有唯一 id、label、run', () => {
    const ids = new Set<string>();
    for (const cmd of LAYER_COMMANDS) {
      expect(ids.has(cmd.id)).toBe(false);
      ids.add(cmd.id);
      expect(typeof cmd.label).toMatch(/^(string|function)$/);
      expect(typeof cmd.run).toBe('function');
    }
  });
});

describe('layer-commands · 辅助函数', () => {
  it('isAllLocked: 全部锁定返回 true，含未锁定项返回 false，空选区返回 false', () => {
    const a = makeComp({ id: 'a', status: { locked: true, hidden: false } });
    const b = makeComp({ id: 'b', status: { locked: true, hidden: false } });
    expect(isAllLocked(makeCtx({ selectedComponents: [a, b] }))).toBe(true);
    expect(
      isAllLocked(
        makeCtx({ selectedComponents: [a, { ...b, status: { locked: false, hidden: false } }] }),
      ),
    ).toBe(false);
    expect(isAllLocked(makeCtx({ selectedComponents: [] }))).toBe(false);
  });

  it('isAllHidden: 全部隐藏返回 true', () => {
    const a = makeComp({ id: 'a', status: { locked: false, hidden: true } });
    expect(isAllHidden(makeCtx({ selectedComponents: [a] }))).toBe(true);
  });

  it('hasGroupedSelection: 含 parentId 的组件返回 true', () => {
    const child = makeComp({ id: 'c', parentId: 'group-1' });
    const top = makeComp({ id: 't' });
    expect(hasGroupedSelection(makeCtx({ selectedComponents: [child, top] }))).toBe(true);
    expect(hasGroupedSelection(makeCtx({ selectedComponents: [top] }))).toBe(false);
  });

  it('getLayerCommandTargetIds: 组件行走选区 ID，分组行走子组件 ID', () => {
    const a = makeComp({ id: 'a' });
    const b = makeComp({ id: 'b' });
    expect(
      getLayerCommandTargetIds(makeCtx({ selectedComponents: [a, b], targetComponent: a })),
    ).toEqual(['a', 'b']);
    const c1 = makeComp({ id: 'c1' });
    const c2 = makeComp({ id: 'c2' });
    expect(
      getLayerCommandTargetIds(
        makeCtx({
          selectedComponents: [c1, c2],
          targetGroup: { groupId: 'g1', children: [c1, c2] },
        }),
      ),
    ).toEqual(['c1', 'c2']);
  });
});

describe('layer-commands · 命令可见性 (when)', () => {
  it('rename 仅在单组件行、单选时可见', () => {
    const a = makeComp({ id: 'a' });
    const ctxSingle = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
    });
    expect(getVisibleLayerCommands(ctxSingle).map((c) => c.id)).toContain('rename');

    // 多选时不可见
    const b = makeComp({ id: 'b' });
    const ctxMulti = makeCtx({
      selectedComponents: [a, b],
      targetComponent: a,
    });
    expect(getVisibleLayerCommands(ctxMulti).map((c) => c.id)).not.toContain('rename');

    // 分组行不可见
    const ctxGroup = makeCtx({
      selectedComponents: [a, b],
      targetGroup: { groupId: 'g', children: [a, b] },
    });
    expect(getVisibleLayerCommands(ctxGroup).map((c) => c.id)).not.toContain('rename');
  });

  it('copy/duplicate 仅在组件行可见（分组行不显示）', () => {
    const a = makeComp({ id: 'a' });
    const b = makeComp({ id: 'b' });
    const ctxGroup = makeCtx({
      selectedComponents: [a, b],
      targetGroup: { groupId: 'g', children: [a, b] },
    });
    const ids = getVisibleLayerCommands(ctxGroup).map((c) => c.id);
    expect(ids).not.toContain('copy');
    expect(ids).not.toContain('duplicate');
  });

  it('bring-forward/send-backward 仅在单选顶层组件时可见', () => {
    const top = makeComp({ id: 'top' });
    const ctxTop = makeCtx({
      selectedComponents: [top],
      targetComponent: top,
      topLevelOrdered: [top],
    });
    const idsTop = getVisibleLayerCommands(ctxTop).map((c) => c.id);
    expect(idsTop).toContain('bring-forward');
    expect(idsTop).toContain('send-backward');

    // 分组子组件（有 parentId）→ 不可见
    const child = makeComp({ id: 'child', parentId: 'g' });
    const ctxChild = makeCtx({
      selectedComponents: [child],
      targetComponent: child,
    });
    const idsChild = getVisibleLayerCommands(ctxChild).map((c) => c.id);
    expect(idsChild).not.toContain('bring-forward');
    expect(idsChild).not.toContain('send-backward');
  });

  it('group 仅在选中≥2 时可见', () => {
    const a = makeComp({ id: 'a' });
    const b = makeComp({ id: 'b' });
    expect(
      getVisibleLayerCommands(makeCtx({ selectedComponents: [a], targetComponent: a })).map(
        (c) => c.id,
      ),
    ).not.toContain('group');
    expect(
      getVisibleLayerCommands(makeCtx({ selectedComponents: [a, b], targetComponent: a })).map(
        (c) => c.id,
      ),
    ).toContain('group');
  });

  it('ungroup 仅在选中包含分组子组件时可见', () => {
    const top = makeComp({ id: 'top' });
    const child = makeComp({ id: 'child', parentId: 'g' });
    expect(
      getVisibleLayerCommands(makeCtx({ selectedComponents: [top], targetComponent: top })).map(
        (c) => c.id,
      ),
    ).not.toContain('ungroup');
    expect(
      getVisibleLayerCommands(makeCtx({ selectedComponents: [child], targetComponent: child })).map(
        (c) => c.id,
      ),
    ).toContain('ungroup');
  });

  it('delete 在有选中时可见（含组件行与分组行）', () => {
    const a = makeComp({ id: 'a' });
    expect(
      getVisibleLayerCommands(makeCtx({ selectedComponents: [a], targetComponent: a })).map(
        (c) => c.id,
      ),
    ).toContain('delete');

    const b = makeComp({ id: 'b' });
    expect(
      getVisibleLayerCommands(
        makeCtx({
          selectedComponents: [a, b],
          targetGroup: { groupId: 'g', children: [a, b] },
        }),
      ).map((c) => c.id),
    ).toContain('delete');
  });
});

describe('layer-commands · 命令执行 (run)', () => {
  it('rename 调用 requestRename 出口，不直接改名', () => {
    const a = makeComp({ id: 'a' });
    const requestRename = vi.fn();
    const store = makeMockStore();
    const ctx = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
      requestRename,
      store,
    });
    getCmd('rename').run(ctx);
    expect(requestRename).toHaveBeenCalledWith('a');
    expect(store.renameComponent).not.toHaveBeenCalled();
  });

  it('copy/duplicate 调用对应 store action', () => {
    const a = makeComp({ id: 'a' });
    const store = makeMockStore();
    const ctx = makeCtx({ selectedComponents: [a], targetComponent: a, store });
    getCmd('copy').run(ctx);
    expect(store.copySelectedToClipboard).toHaveBeenCalled();
    getCmd('duplicate').run(ctx);
    expect(store.duplicateSelected).toHaveBeenCalled();
  });

  it('toggle-lock: 全部未锁定→锁定；全部已锁定→解锁', () => {
    const a = makeComp({ id: 'a', status: { locked: false, hidden: false } });
    const store = makeMockStore();
    const ctx = makeCtx({ selectedComponents: [a], targetComponent: a, store });
    getCmd('toggle-lock').run(ctx);
    expect(store.setLocked).toHaveBeenCalledWith(['a'], true);

    const b = makeComp({ id: 'b', status: { locked: true, hidden: false } });
    const ctxLocked = makeCtx({
      selectedComponents: [b],
      targetComponent: b,
      store,
    });
    getCmd('toggle-lock').run(ctxLocked);
    expect(store.setLocked).toHaveBeenCalledWith(['b'], false);
  });

  it('toggle-hide: 全部未隐藏→隐藏；全部已隐藏→显示', () => {
    const a = makeComp({ id: 'a', status: { locked: false, hidden: false } });
    const store = makeMockStore();
    const ctx = makeCtx({ selectedComponents: [a], targetComponent: a, store });
    getCmd('toggle-hide').run(ctx);
    expect(store.setHidden).toHaveBeenCalledWith(['a'], true);

    const b = makeComp({ id: 'b', status: { locked: false, hidden: true } });
    const ctxHidden = makeCtx({
      selectedComponents: [b],
      targetComponent: b,
      store,
    });
    getCmd('toggle-hide').run(ctxHidden);
    expect(store.setHidden).toHaveBeenCalledWith(['b'], false);
  });

  it('分组行 toggle-lock 作用于子组件 ID', () => {
    const c1 = makeComp({ id: 'c1' });
    const c2 = makeComp({ id: 'c2' });
    const store = makeMockStore();
    const ctx = makeCtx({
      selectedComponents: [c1, c2],
      targetGroup: { groupId: 'g', children: [c1, c2] },
      store,
    });
    getCmd('toggle-lock').run(ctx);
    expect(store.setLocked).toHaveBeenCalledWith(['c1', 'c2'], true);
  });

  it('bring-to-front 对所有选中顶层组件调用 reorderToTop', () => {
    const a = makeComp({ id: 'a' });
    const b = makeComp({ id: 'b' });
    const store = makeMockStore();
    const ctx = makeCtx({
      selectedComponents: [a, b],
      targetComponent: a,
      store,
    });
    getCmd('bring-to-front').run(ctx);
    expect(store.reorderToTop).toHaveBeenCalledTimes(2);
  });

  it('bring-forward: idx=1 → reorderLayerToIndex(id, 0)', () => {
    const top = makeComp({ id: 'top' });
    const a = makeComp({ id: 'a' });
    const store = makeMockStore();
    const ctx = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
      topLevelOrdered: [top, a],
      store,
    });
    getCmd('bring-forward').run(ctx);
    expect(store.reorderLayerToIndex).toHaveBeenCalledWith('a', 0);
  });

  it('send-backward: idx=0 → reorderLayerToIndex(id, 1)', () => {
    const a = makeComp({ id: 'a' });
    const b = makeComp({ id: 'b' });
    const store = makeMockStore();
    const ctx = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
      topLevelOrdered: [a, b],
      store,
    });
    getCmd('send-backward').run(ctx);
    expect(store.reorderLayerToIndex).toHaveBeenCalledWith('a', 1);
  });

  it('send-to-back 对所有选中顶层组件调用 reorderToBottom', () => {
    const a = makeComp({ id: 'a' });
    const store = makeMockStore();
    const ctx = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
      store,
    });
    getCmd('send-to-back').run(ctx);
    expect(store.reorderToBottom).toHaveBeenCalledWith('a');
  });

  it('group/ungroup 调用对应 store action', () => {
    const a = makeComp({ id: 'a' });
    const b = makeComp({ id: 'b' });
    const store = makeMockStore();
    const ctx = makeCtx({
      selectedComponents: [a, b],
      targetComponent: a,
      store,
    });
    getCmd('group').run(ctx);
    expect(store.groupSelected).toHaveBeenCalled();
  });

  it('delete 调用 removeSelectedComponents', () => {
    const a = makeComp({ id: 'a' });
    const store = makeMockStore();
    const ctx = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
      store,
    });
    getCmd('delete').run(ctx);
    expect(store.removeSelectedComponents).toHaveBeenCalled();
  });
});

describe('layer-commands · 启用态 (enabled)', () => {
  it('bring-forward 在 idx=0（已在顶层）时禁用', () => {
    const a = makeComp({ id: 'a' });
    const ctx = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
      topLevelOrdered: [a],
    });
    expect(isLayerCommandEnabled(getCmd('bring-forward'), ctx)).toBe(false);
  });

  it('send-backward 在 idx=末位（已在底层）时禁用', () => {
    const a = makeComp({ id: 'a' });
    const b = makeComp({ id: 'b' });
    const ctx = makeCtx({
      selectedComponents: [b],
      targetComponent: b,
      topLevelOrdered: [a, b],
    });
    expect(isLayerCommandEnabled(getCmd('send-backward'), ctx)).toBe(false);
  });

  it('锁定项时 bring-to-front / send-to-back / group / ungroup 禁用', () => {
    const a = makeComp({ id: 'a', status: { locked: true, hidden: false } });
    const ctx = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
      topLevelOrdered: [a],
    });
    expect(isLayerCommandEnabled(getCmd('bring-to-front'), ctx)).toBe(false);
    expect(isLayerCommandEnabled(getCmd('send-to-back'), ctx)).toBe(false);
    expect(isLayerCommandEnabled(getCmd('group'), ctx)).toBe(false);
    expect(isLayerCommandEnabled(getCmd('ungroup'), ctx)).toBe(false);
  });

  it('未声明 enabled 的命令始终视为启用', () => {
    const a = makeComp({ id: 'a' });
    const ctx = makeCtx({
      selectedComponents: [a],
      targetComponent: a,
    });
    expect(isLayerCommandEnabled(getCmd('rename'), ctx)).toBe(true);
    expect(isLayerCommandEnabled(getCmd('delete'), ctx)).toBe(true);
  });
});

describe('layer-commands · 标签与图标解析', () => {
  it('静态 label/icon 直接返回', () => {
    const a = makeComp({ id: 'a' });
    const ctx = makeCtx({ selectedComponents: [a], targetComponent: a });
    expect(resolveLayerCommandLabel(getCmd('rename'), ctx)).toBe('重命名');
    expect(resolveLayerCommandLabel(getCmd('delete'), ctx)).toBe('删除');
    expect(resolveLayerCommandIcon(getCmd('rename'), ctx)).toBeDefined();
  });

  it('toggle-lock label 随锁定状态切换：未锁定→"锁定"，已锁定→"解锁"', () => {
    const unlocked = makeComp({ id: 'a', status: { locked: false, hidden: false } });
    const ctxU = makeCtx({ selectedComponents: [unlocked], targetComponent: unlocked });
    expect(resolveLayerCommandLabel(getCmd('toggle-lock'), ctxU)).toBe('锁定');

    const locked = makeComp({ id: 'a', status: { locked: true, hidden: false } });
    const ctxL = makeCtx({ selectedComponents: [locked], targetComponent: locked });
    expect(resolveLayerCommandLabel(getCmd('toggle-lock'), ctxL)).toBe('解锁');
  });

  it('toggle-hide label 随隐藏状态切换：未隐藏→"隐藏"，已隐藏→"显示"', () => {
    const visible = makeComp({ id: 'a', status: { locked: false, hidden: false } });
    const ctxV = makeCtx({
      selectedComponents: [visible],
      targetComponent: visible,
    });
    expect(resolveLayerCommandLabel(getCmd('toggle-hide'), ctxV)).toBe('隐藏');

    const hidden = makeComp({ id: 'a', status: { locked: false, hidden: true } });
    const ctxH = makeCtx({ selectedComponents: [hidden], targetComponent: hidden });
    expect(resolveLayerCommandLabel(getCmd('toggle-hide'), ctxH)).toBe('显示');
  });

  it('delete 命令标记为 destructive', () => {
    expect(getCmd('delete').destructive).toBe(true);
  });

  it('separatorBefore 用于命令分组切分', () => {
    const sepIds = LAYER_COMMANDS.filter((c) => c.separatorBefore).map((c) => c.id);
    expect(sepIds).toEqual(['copy', 'toggle-lock', 'bring-to-front', 'group', 'delete']);
  });
});
