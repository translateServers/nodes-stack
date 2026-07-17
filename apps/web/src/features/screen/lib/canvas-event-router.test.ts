import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attachContextMenuRedistributor,
  detectDoubleClick,
  findComponentIdAtPoint,
  getComponentIdFromElement,
  handleSelectEnd,
  redistributeContextMenu,
  zoomAtPoint,
} from './canvas-event-router';

/** 创建带 data-component-id 的元素 */
function createElementWithId(id: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-component-id', id);
  return el;
}

/** 创建带 className 的元素 */
function createElementWithClass(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

describe('getComponentIdFromElement', () => {
  it('命中：起始元素即包含 data-component-id', () => {
    const el = createElementWithId('comp-1');

    expect(getComponentIdFromElement(el)).toBe('comp-1');
  });

  it('命中：父元素包含 data-component-id', () => {
    const parent = createElementWithId('comp-parent');
    const child = document.createElement('div');
    parent.appendChild(child);

    expect(getComponentIdFromElement(child)).toBe('comp-parent');
  });

  it('未命中：元素链中无 data-component-id', () => {
    const el = document.createElement('div');

    expect(getComponentIdFromElement(el)).toBeNull();
  });

  it('未命中：传入 null', () => {
    expect(getComponentIdFromElement(null)).toBeNull();
  });

  it('终止：遇到 .moveable-control-box 时立即终止返回 null', () => {
    // 结构：moveable-control-box > inner > component
    const moveableBox = createElementWithClass('moveable-control-box');
    const inner = document.createElement('div');
    const component = createElementWithId('comp-1');
    moveableBox.appendChild(inner);
    inner.appendChild(component);

    // 从 component 向上查找时遇到 moveable-control-box 应终止
    // 注意：实际场景中事件 target 是 moveableBox 内部元素，向上会先遇到 component
    // 但若起点已在 moveable-control-box 之上则应终止
    const control = document.createElement('div');
    control.className = 'moveable-control';
    moveableBox.appendChild(control);

    expect(getComponentIdFromElement(control)).toBeNull();
  });

  it('终止：起点本身即为 moveable-control-box', () => {
    const moveableBox = createElementWithClass('moveable-control-box');

    expect(getComponentIdFromElement(moveableBox)).toBeNull();
  });
});

describe('findComponentIdAtPoint', () => {
  /** 暂存原始实现以便 afterEach 恢复 */
  // eslint-disable-next-line @typescript-eslint/unbound-method -- 仅用于存储引用以恢复，不调用此方法
  const originalElementsFromPoint = document.elementsFromPoint;

  afterEach(() => {
    // 恢复原始实现（jsdom 中可能为 undefined）
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: originalElementsFromPoint,
      writable: true,
    });
  });

  /** 替换 document.elementsFromPoint 返回指定元素数组 */
  function mockElementsFromPoint(elements: Element[]): void {
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => elements,
      writable: true,
    });
  }

  it('命中：返回第一个带 data-component-id 的元素', () => {
    const component = createElementWithId('comp-1');
    const overlay = document.createElement('div');
    mockElementsFromPoint([overlay, component]);

    expect(findComponentIdAtPoint(100, 100)).toBe('comp-1');
  });

  it('跳过：[data-slot="context-menu-content"] 元素', () => {
    const menuContent = document.createElement('div');
    menuContent.setAttribute('data-slot', 'context-menu-content');
    const component = createElementWithId('comp-1');
    mockElementsFromPoint([menuContent, component]);

    expect(findComponentIdAtPoint(100, 100)).toBe('comp-1');
  });

  it('跳过：[data-radix-popper-content-wrapper] 元素', () => {
    const popper = document.createElement('div');
    popper.setAttribute('data-radix-popper-content-wrapper', '');
    const component = createElementWithId('comp-1');
    mockElementsFromPoint([popper, component]);

    expect(findComponentIdAtPoint(100, 100)).toBe('comp-1');
  });

  it('跳过：.moveable-control-box 元素（含其内部嵌套元素）', () => {
    const moveableBox = createElementWithClass('moveable-control-box');
    const inner = document.createElement('div');
    const component = createElementWithId('comp-1');
    moveableBox.appendChild(inner);
    inner.appendChild(component);

    mockElementsFromPoint([inner]);

    // 通过 closest('.moveable-control-box') 跳过
    expect(findComponentIdAtPoint(100, 100)).toBeNull();
  });

  it('未命中：鼠标下方无任何带 data-component-id 的元素', () => {
    const plain = document.createElement('div');
    mockElementsFromPoint([plain]);

    expect(findComponentIdAtPoint(100, 100)).toBeNull();
  });

  it('未命中：elementsFromPoint 返回空数组', () => {
    mockElementsFromPoint([]);

    expect(findComponentIdAtPoint(100, 100)).toBeNull();
  });
});

describe('redistributeContextMenu', () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- 仅用于存储引用以恢复，不调用此方法
  const originalElementsFromPoint = document.elementsFromPoint;

  /**
   * jsdom 不支持 `view: window` 的 PointerEvent / MouseEvent 构造，
   * 因此在测试前 mock 两者为简化版 Event。
   * 仅验证事件类型、坐标、button 字段，不验证完整事件语义。
   */
  class MockMouseEvent extends Event {
    readonly clientX: number;
    readonly clientY: number;
    readonly button: number;
    readonly buttons: number;

    constructor(type: string, init: Record<string, unknown> = {}) {
      super(type, {
        bubbles: init.bubbles as boolean | undefined,
        cancelable: init.cancelable as boolean | undefined,
      });
      this.clientX = (init.clientX as number) ?? 0;
      this.clientY = (init.clientY as number) ?? 0;
      this.button = (init.button as number) ?? 0;
      this.buttons = (init.buttons as number) ?? 0;
    }
  }

  class MockPointerEvent extends MockMouseEvent {
    readonly pointerId: number;
    readonly isPrimary: boolean;
    readonly pointerType: string;

    constructor(type: string, init: Record<string, unknown> = {}) {
      super(type, init);
      this.pointerId = (init.pointerId as number) ?? 0;
      this.isPrimary = (init.isPrimary as boolean) ?? false;
      this.pointerType = (init.pointerType as string) ?? '';
    }
  }

  beforeEach(() => {
    vi.stubGlobal('PointerEvent', MockPointerEvent);
    vi.stubGlobal('MouseEvent', MockMouseEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: originalElementsFromPoint,
      writable: true,
    });
  });

  function mockElementsFromPoint(elements: Element[]): void {
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => elements,
      writable: true,
    });
  }

  it('派发完整事件序列：pointerdown → mousedown → pointerup → mouseup → contextmenu', () => {
    const target = document.createElement('div');
    mockElementsFromPoint([target]);
    const dispatchSpy = vi.spyOn(target, 'dispatchEvent');

    redistributeContextMenu(150, 200);

    expect(dispatchSpy).toHaveBeenCalledTimes(5);
    const eventTypes = dispatchSpy.mock.calls.map((call) => call[0].type);
    expect(eventTypes).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'contextmenu']);
  });

  it('事件坐标：所有事件均使用传入的 x/y 作为 clientX/clientY', () => {
    const target = document.createElement('div');
    mockElementsFromPoint([target]);
    const dispatchSpy = vi.spyOn(target, 'dispatchEvent');

    redistributeContextMenu(333, 444);

    for (const call of dispatchSpy.mock.calls) {
      const event = call[0] as MouseEvent;
      expect(event.clientX).toBe(333);
      expect(event.clientY).toBe(444);
    }
  });

  it('事件 button：所有事件均为右键（button === 2）', () => {
    const target = document.createElement('div');
    mockElementsFromPoint([target]);
    const dispatchSpy = vi.spyOn(target, 'dispatchEvent');

    redistributeContextMenu(100, 100);

    for (const call of dispatchSpy.mock.calls) {
      const event = call[0] as MouseEvent;
      expect(event.button).toBe(2);
    }
  });

  it('跳过覆盖层：从首个非跳过元素派发事件', () => {
    const menuContent = document.createElement('div');
    menuContent.setAttribute('data-slot', 'context-menu-content');
    const popper = document.createElement('div');
    popper.setAttribute('data-radix-popper-content-wrapper', '');
    const moveableBox = createElementWithClass('moveable-control-box');
    const realTarget = document.createElement('div');
    mockElementsFromPoint([menuContent, popper, moveableBox, realTarget]);

    const realTargetSpy = vi.spyOn(realTarget, 'dispatchEvent');
    const menuContentSpy = vi.spyOn(menuContent, 'dispatchEvent');

    redistributeContextMenu(100, 100);

    expect(realTargetSpy).toHaveBeenCalled();
    expect(menuContentSpy).not.toHaveBeenCalled();
  });

  it('兜底：所有元素都被跳过时派发到 document.body', () => {
    mockElementsFromPoint([]);

    const bodySpy = vi.spyOn(document.body, 'dispatchEvent');

    redistributeContextMenu(100, 100);

    expect(bodySpy).toHaveBeenCalled();
  });

  it('清除 body / html / #root 的 pointer-events 内联样式', () => {
    document.body.style.pointerEvents = 'none';
    document.documentElement.style.pointerEvents = 'none';

    const root = document.createElement('div');
    root.id = 'root';
    root.style.pointerEvents = 'none';
    document.body.appendChild(root);

    const target = document.createElement('div');
    mockElementsFromPoint([target]);

    redistributeContextMenu(100, 100);

    expect(document.body.style.pointerEvents).toBe('');
    expect(document.documentElement.style.pointerEvents).toBe('');
    expect(root.style.pointerEvents).toBe('');

    root.remove();
  });
});

describe('attachContextMenuRedistributor', () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- 仅用于存储引用以恢复，不调用此方法
  const originalElementsFromPoint = document.elementsFromPoint;

  /**
   * jsdom 不支持 `view: window` 的 PointerEvent / MouseEvent 构造，
   * 复用与 redistributeContextMenu describe 相同的 mock 模式。
   */
  class MockMouseEvent extends Event {
    readonly clientX: number;
    readonly clientY: number;
    readonly button: number;
    readonly buttons: number;

    constructor(type: string, init: Record<string, unknown> = {}) {
      super(type, {
        bubbles: init.bubbles as boolean | undefined,
        cancelable: init.cancelable as boolean | undefined,
      });
      this.clientX = (init.clientX as number) ?? 0;
      this.clientY = (init.clientY as number) ?? 0;
      this.button = (init.button as number) ?? 0;
      this.buttons = (init.buttons as number) ?? 0;
    }
  }

  class MockPointerEvent extends MockMouseEvent {
    readonly pointerId: number;
    readonly isPrimary: boolean;
    readonly pointerType: string;

    constructor(type: string, init: Record<string, unknown> = {}) {
      super(type, init);
      this.pointerId = (init.pointerId as number) ?? 0;
      this.isPrimary = (init.isPrimary as boolean) ?? false;
      this.pointerType = (init.pointerType as string) ?? '';
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('PointerEvent', MockPointerEvent);
    vi.stubGlobal('MouseEvent', MockMouseEvent);
    // redistributeContextMenu 在 rAF 中调用 elementsFromPoint，需提供有效 mock
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [],
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: originalElementsFromPoint,
      writable: true,
    });
  });

  /** 在 document.body 上派发右键 contextmenu 事件（让 document 捕获监听器触发） */
  function fireContextmenu(x = 100, y = 100): void {
    document.body.dispatchEvent(
      new MockMouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 2,
        buttons: 0,
      }),
    );
  }

  /** 在 document.body 上派发 pointerdown 事件 */
  function firePointerdown(button = 2): void {
    document.body.dispatchEvent(
      new MockPointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button,
        buttons: button === 2 ? 2 : 0,
      }),
    );
  }

  /** 推进双 rAF（每个约 16ms）+ 50ms setTimeout */
  function flushRedistribution(): void {
    vi.advanceTimersByTime(32);
    vi.advanceTimersByTime(50);
  }

  it('返回 cleanup 函数', () => {
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => false,
      onClose: () => {},
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('注册时在 document 上添加 contextmenu 与 pointerdown capture 监听器', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');

    const cleanup = attachContextMenuRedistributor({
      isOpen: () => false,
      onClose: () => {},
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    const contextmenuCalls = addSpy.mock.calls.filter(([type]) => type === 'contextmenu');
    const pointerdownCalls = addSpy.mock.calls.filter(([type]) => type === 'pointerdown');

    // 第三个参数为 capture 标志（实现使用布尔 true，等价于 { capture: true }）
    expect(contextmenuCalls).toHaveLength(1);
    expect(contextmenuCalls[0][2]).toBe(true);
    expect(pointerdownCalls).toHaveLength(1);
    expect(pointerdownCalls[0][2]).toBe(true);

    cleanup();
    addSpy.mockRestore();
  });

  it('cleanup 移除两个 capture 监听器', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const cleanup = attachContextMenuRedistributor({
      isOpen: () => false,
      onClose: () => {},
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });
    cleanup();

    const contextmenuCalls = removeSpy.mock.calls.filter(([type]) => type === 'contextmenu');
    const pointerdownCalls = removeSpy.mock.calls.filter(([type]) => type === 'pointerdown');

    expect(contextmenuCalls).toHaveLength(1);
    expect(contextmenuCalls[0][2]).toBe(true);
    expect(pointerdownCalls).toHaveLength(1);
    expect(pointerdownCalls[0][2]).toBe(true);

    removeSpy.mockRestore();
  });

  it('cleanup 后事件不再触发回调', () => {
    const onClose = vi.fn();
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => true,
      onClose,
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });
    cleanup();

    fireContextmenu();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('pointerdown capture：非右键（button !== 2）不隐藏现有 Content', () => {
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => true,
      onClose: () => {},
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    const menuContent = document.createElement('div');
    menuContent.setAttribute('data-slot', 'context-menu-content');
    document.body.appendChild(menuContent);

    firePointerdown(0); // 左键
    expect(menuContent.style.opacity).toBe('');

    menuContent.remove();
    cleanup();
  });

  it('pointerdown capture：菜单关闭时不隐藏现有 Content', () => {
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => false,
      onClose: () => {},
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    const menuContent = document.createElement('div');
    menuContent.setAttribute('data-slot', 'context-menu-content');
    document.body.appendChild(menuContent);

    firePointerdown(2);
    expect(menuContent.style.opacity).toBe('');

    menuContent.remove();
    cleanup();
  });

  it('pointerdown capture：右键 + 菜单打开 → 隐藏现有 Content', () => {
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => true,
      onClose: () => {},
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    const menuContent = document.createElement('div');
    menuContent.setAttribute('data-slot', 'context-menu-content');
    document.body.appendChild(menuContent);

    firePointerdown(2);

    expect(menuContent.style.opacity).toBe('0');
    expect(menuContent.style.pointerEvents).toBe('none');
    expect(menuContent.style.getPropertyValue('animation')).toBe('none');
    expect(menuContent.style.getPropertyValue('transition')).toBe('none');

    menuContent.remove();
    cleanup();
  });

  it('contextmenu capture：非右键不处理（不调用 onClose）', () => {
    const onClose = vi.fn();
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => true,
      onClose,
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    document.body.dispatchEvent(
      new MockMouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );

    expect(onClose).not.toHaveBeenCalled();
    cleanup();
  });

  it('contextmenu capture：菜单关闭时不处理', () => {
    const onClose = vi.fn();
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => false,
      onClose,
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    fireContextmenu();
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
  });

  it('contextmenu capture：拦截事件（stopImmediatePropagation + preventDefault）', () => {
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => true,
      onClose: () => {},
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    const event = new MockMouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      button: 2,
      buttons: 0,
    });
    const stopSpy = vi.spyOn(event, 'stopImmediatePropagation');
    const preventSpy = vi.spyOn(event, 'preventDefault');

    document.body.dispatchEvent(event);

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(preventSpy).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('contextmenu capture：调用 onClose 与 onMenuKeyBump', () => {
    const onClose = vi.fn();
    const onMenuKeyBump = vi.fn();
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => true,
      onClose,
      onMenuKeyBump,
      onReopenIfClosed: () => {},
    });

    fireContextmenu(150, 250);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMenuKeyBump).toHaveBeenCalledTimes(1);

    flushRedistribution();
    cleanup();
  });

  it('contextmenu capture：通过双 rAF 调度 redistributeContextMenu', () => {
    const target = document.createElement('div');
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [target],
      writable: true,
    });
    const dispatchSpy = vi.spyOn(target, 'dispatchEvent');

    const cleanup = attachContextMenuRedistributor({
      isOpen: () => true,
      onClose: () => {},
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    fireContextmenu(150, 250);
    expect(dispatchSpy).not.toHaveBeenCalled(); // 尚未到 rAF

    vi.advanceTimersByTime(16); // 第一个 rAF
    expect(dispatchSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(16); // 第二个 rAF → 触发 redistributeContextMenu
    expect(dispatchSpy).toHaveBeenCalledTimes(5); // 5 个事件序列

    vi.advanceTimersByTime(50); // 完成 setTimeout
    cleanup();
  });

  it('isRedistributing 标志：阻止重派发期间的事件再次进入', () => {
    const onClose = vi.fn();
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => true,
      onClose,
      onMenuKeyBump: () => {},
      onReopenIfClosed: () => {},
    });

    fireContextmenu();
    expect(onClose).toHaveBeenCalledTimes(1);

    // 在 rAF 尚未触发时（isRedistributing=true）再次右键 → 应被拦截
    fireContextmenu();
    expect(onClose).toHaveBeenCalledTimes(1);

    // 完成 redistribute + setTimeout
    flushRedistribution();

    // 现在可以再次触发
    fireContextmenu();
    expect(onClose).toHaveBeenCalledTimes(2);

    flushRedistribution();
    cleanup();
  });

  it('50ms 超时后：菜单仍关闭 → 调用 onReopenIfClosed', () => {
    let open = true;
    const onReopenIfClosed = vi.fn();
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => open,
      onClose: () => {
        open = false;
      },
      onMenuKeyBump: () => {},
      onReopenIfClosed,
    });

    fireContextmenu();

    vi.advanceTimersByTime(32); // 双 rAF 完成
    expect(onReopenIfClosed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50); // setTimeout 触发
    expect(onReopenIfClosed).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('50ms 超时后：菜单已被重派发打开 → 不调用 onReopenIfClosed', () => {
    let open = true;
    const onReopenIfClosed = vi.fn();
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => open,
      onClose: () => {
        open = false;
      },
      onMenuKeyBump: () => {},
      onReopenIfClosed,
    });

    fireContextmenu();

    vi.advanceTimersByTime(32); // 双 rAF 完成 → redistributeContextMenu 已派发
    // 模拟 Radix 接收到重派发事件后重新打开菜单
    open = true;

    vi.advanceTimersByTime(50);
    expect(onReopenIfClosed).not.toHaveBeenCalled();

    cleanup();
  });
});

describe('detectDoubleClick', () => {
  it('prev 为 null 时返回 false（无历史）', () => {
    expect(detectDoubleClick(null, { id: 'comp-1', time: 1000 })).toBe(false);
  });

  it('不同 id 时返回 false', () => {
    expect(detectDoubleClick({ id: 'comp-1', time: 1000 }, { id: 'comp-2', time: 1200 })).toBe(
      false,
    );
  });

  it('同 id 时间间隔超过阈值时返回 false', () => {
    expect(detectDoubleClick({ id: 'comp-1', time: 1000 }, { id: 'comp-1', time: 1500 }, 400)).toBe(
      false,
    );
  });

  it('同 id 时间间隔等于阈值时返回 true（边界）', () => {
    expect(detectDoubleClick({ id: 'comp-1', time: 1000 }, { id: 'comp-1', time: 1400 }, 400)).toBe(
      true,
    );
  });

  it('同 id 时间间隔小于阈值时返回 true', () => {
    expect(detectDoubleClick({ id: 'comp-1', time: 1000 }, { id: 'comp-1', time: 1200 }, 400)).toBe(
      true,
    );
  });

  it('使用默认阈值 400ms', () => {
    expect(detectDoubleClick({ id: 'comp-1', time: 0 }, { id: 'comp-1', time: 350 })).toBe(true);
    expect(detectDoubleClick({ id: 'comp-1', time: 0 }, { id: 'comp-1', time: 450 })).toBe(false);
  });

  it('自定义阈值生效', () => {
    expect(detectDoubleClick({ id: 'comp-1', time: 0 }, { id: 'comp-1', time: 600 }, 1000)).toBe(
      true,
    );
  });

  it('current.time 小于 prev.time 时返回 false（时间倒流，异常容错）', () => {
    expect(detectDoubleClick({ id: 'comp-1', time: 2000 }, { id: 'comp-1', time: 1000 })).toBe(
      false,
    );
  });
});

describe('zoomAtPoint', () => {
  it('放大：factor=1.1 → scale 增加，offset 调整使光标点保持锚定', () => {
    const result = zoomAtPoint({
      currentScale: 1,
      currentOffset: { x: 0, y: 0 },
      cursorX: 100,
      cursorY: 100,
      factor: 1.1,
    });

    expect(result.scale).toBe(1.1);
    // 光标点 (100, 100) 在新坐标系下应映射到原画布坐标 100
    // (cursor - offset_new) / scale_new = (100 - 0) / 1 = 100
    // offset_new = cursor - 100 * (1.1 / 1) = 100 - 110 = -10
    expect(result.offset.x).toBeCloseTo(-10, 10);
    expect(result.offset.y).toBeCloseTo(-10, 10);
  });

  it('缩小：factor=0.5 → scale 减小一半，offset 调整使光标点保持锚定', () => {
    const result = zoomAtPoint({
      currentScale: 2,
      currentOffset: { x: 50, y: 50 },
      cursorX: 200,
      cursorY: 200,
      factor: 0.5, // 缩小一半
    });

    expect(result.scale).toBe(1);
    // scaleRatio = newScale / currentScale = 1 / 2 = 0.5
    // offset_new = cursor - (cursor - offset_old) * scaleRatio
    //            = 200 - (200 - 50) * 0.5 = 200 - 75 = 125
    expect(result.offset.x).toBeCloseTo(125, 10);
    expect(result.offset.y).toBeCloseTo(125, 10);
  });

  it('factor=1 → scale 与 offset 不变', () => {
    const result = zoomAtPoint({
      currentScale: 1.5,
      currentOffset: { x: 30, y: 70 },
      cursorX: 500,
      cursorY: 300,
      factor: 1,
    });

    expect(result.scale).toBe(1.5);
    expect(result.offset.x).toBe(30);
    expect(result.offset.y).toBe(70);
  });

  it('光标在原点时 offset = 0', () => {
    const result = zoomAtPoint({
      currentScale: 1,
      currentOffset: { x: 0, y: 0 },
      cursorX: 0,
      cursorY: 0,
      factor: 2,
    });

    expect(result.scale).toBe(2);
    expect(result.offset.x).toBe(0);
    expect(result.offset.y).toBe(0);
  });

  it('newScale <= 0 时保持原值（边界容错）', () => {
    const result = zoomAtPoint({
      currentScale: 1,
      currentOffset: { x: 10, y: 20 },
      cursorX: 50,
      cursorY: 50,
      factor: -1, // 会导致 newScale = -1
    });

    expect(result.scale).toBe(1);
    expect(result.offset.x).toBe(10);
    expect(result.offset.y).toBe(20);
  });

  it('factor=0 时保持原值（边界容错）', () => {
    const result = zoomAtPoint({
      currentScale: 2,
      currentOffset: { x: 10, y: 20 },
      cursorX: 50,
      cursorY: 50,
      factor: 0,
    });

    expect(result.scale).toBe(2);
    expect(result.offset.x).toBe(10);
    expect(result.offset.y).toBe(20);
  });

  it('验证锚点不变性：缩放前后光标点对应的画布坐标相同', () => {
    const params = {
      currentScale: 1.5,
      currentOffset: { x: 100, y: 200 },
      cursorX: 400,
      cursorY: 600,
      factor: 1.3,
    };
    const result = zoomAtPoint(params);

    // 原画布坐标 = (cursor - offset_old) / scale_old
    const canvasPointBefore = {
      x: (params.cursorX - params.currentOffset.x) / params.currentScale,
      y: (params.cursorY - params.currentOffset.y) / params.currentScale,
    };
    // 新画布坐标 = (cursor - offset_new) / scale_new
    const canvasPointAfter = {
      x: (params.cursorX - result.offset.x) / result.scale,
      y: (params.cursorY - result.offset.y) / result.scale,
    };

    expect(canvasPointAfter.x).toBeCloseTo(canvasPointBefore.x, 10);
    expect(canvasPointAfter.y).toBeCloseTo(canvasPointBefore.y, 10);
  });
});

describe('handleSelectEnd', () => {
  /** 创建一个无修饰键的 mock MouseEvent */
  function createMouseEvent(
    modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {},
  ): MouseEvent {
    return {
      ctrlKey: modifiers.ctrl ?? false,
      metaKey: modifiers.meta ?? false,
      shiftKey: modifiers.shift ?? false,
    } as MouseEvent;
  }

  /** 创建组件 mock */
  function createComponent(id: string, parentId: string | null = null) {
    return { id, parentId };
  }

  it('框选（isDragStart=false）：返回 selected，清空 lastClick，保持 activeGroupId', () => {
    const result = handleSelectEnd({
      selected: ['comp-1', 'comp-2'],
      inputEvent: createMouseEvent(),
      lastClick: { id: 'old', time: 0 },
      activeGroupId: 'group-1',
      components: [createComponent('comp-1'), createComponent('comp-2')],
      isDragStart: false,
      currentTime: 1000,
    });

    expect(result.selection).toEqual(['comp-1', 'comp-2']);
    expect(result.newActiveGroupId).toBe('group-1');
    expect(result.newLastClick).toBeNull();
    expect(result.isDoubleClick).toBe(false);
  });

  it('Ctrl 多选（hasModifier=true）：返回 selected，清空 lastClick', () => {
    const result = handleSelectEnd({
      selected: ['comp-1', 'comp-2'],
      inputEvent: createMouseEvent({ ctrl: true }),
      lastClick: { id: 'old', time: 0 },
      activeGroupId: null,
      components: [createComponent('comp-1'), createComponent('comp-2')],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.selection).toEqual(['comp-1', 'comp-2']);
    expect(result.newLastClick).toBeNull();
    expect(result.isDoubleClick).toBe(false);
  });

  it('单击顶层组件（首次点击）：返回 selected，更新 lastClick，无 activeGroupId 变化', () => {
    const result = handleSelectEnd({
      selected: ['comp-1'],
      inputEvent: createMouseEvent(),
      lastClick: null,
      activeGroupId: null,
      components: [createComponent('comp-1')],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.selection).toEqual(['comp-1']);
    expect(result.newActiveGroupId).toBeNull();
    expect(result.newLastClick).toEqual({ id: 'comp-1', time: 1000 });
    expect(result.isDoubleClick).toBe(false);
  });

  it('双击顶层组件：进入双击态，清空 lastClick，activeGroupId 设为 null', () => {
    const result = handleSelectEnd({
      selected: ['comp-1'],
      inputEvent: createMouseEvent(),
      lastClick: { id: 'comp-1', time: 800 }, // 200ms 前
      activeGroupId: 'group-1', // 当前在分组中
      components: [createComponent('comp-1')],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.selection).toEqual(['comp-1']);
    expect(result.newActiveGroupId).toBeNull();
    expect(result.newLastClick).toBeNull();
    expect(result.isDoubleClick).toBe(true);
  });

  it('双击分组内组件：进入该分组，selection 仅包含被双击组件', () => {
    const result = handleSelectEnd({
      selected: ['child-1'],
      inputEvent: createMouseEvent(),
      lastClick: { id: 'child-1', time: 800 },
      activeGroupId: null,
      components: [createComponent('child-1', 'group-1'), createComponent('child-2', 'group-1')],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.isDoubleClick).toBe(true);
    expect(result.newActiveGroupId).toBe('group-1');
    expect(result.selection).toEqual(['child-1']);
    expect(result.newLastClick).toBeNull();
  });

  it('单击分组内组件（未进入任何分组）：选中整个分组，activeGroupId 设为 null', () => {
    const result = handleSelectEnd({
      selected: ['child-1'],
      inputEvent: createMouseEvent(),
      lastClick: null, // 首次点击，不会触发双击
      activeGroupId: null,
      components: [
        createComponent('child-1', 'group-1'),
        createComponent('child-2', 'group-1'),
        createComponent('child-3', 'group-1'),
        createComponent('top-1'), // 其它组件
      ],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.selection).toEqual(['child-1', 'child-2', 'child-3']);
    expect(result.newActiveGroupId).toBeNull();
    expect(result.isDoubleClick).toBe(false);
    expect(result.newLastClick).toEqual({ id: 'child-1', time: 1000 });
  });

  it('单击分组内组件（已进入该分组）：仅选中此组件，保持 activeGroupId', () => {
    const result = handleSelectEnd({
      selected: ['child-1'],
      inputEvent: createMouseEvent(),
      lastClick: null,
      activeGroupId: 'group-1', // 已进入 group-1
      components: [createComponent('child-1', 'group-1'), createComponent('child-2', 'group-1')],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.selection).toEqual(['child-1']);
    expect(result.newActiveGroupId).toBe('group-1');
    expect(result.isDoubleClick).toBe(false);
  });

  it('单击分组内组件（进入了别的分组）：选中整个新分组，退出旧分组', () => {
    const result = handleSelectEnd({
      selected: ['child-a'],
      inputEvent: createMouseEvent(),
      lastClick: null,
      activeGroupId: 'group-1', // 当前在 group-1
      components: [createComponent('child-a', 'group-2'), createComponent('child-b', 'group-2')],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.selection).toEqual(['child-a', 'child-b']);
    expect(result.newActiveGroupId).toBeNull(); // 退出旧分组（设为 null，与原实现一致）
    expect(result.isDoubleClick).toBe(false);
  });

  it('单击顶层组件（当前在分组中）：退出分组，activeGroupId 设为 null', () => {
    const result = handleSelectEnd({
      selected: ['top-1'],
      inputEvent: createMouseEvent(),
      lastClick: null,
      activeGroupId: 'group-1', // 当前在分组中
      components: [createComponent('top-1')],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.selection).toEqual(['top-1']);
    expect(result.newActiveGroupId).toBeNull();
    expect(result.isDoubleClick).toBe(false);
  });

  it('同组件间隔超阈值不触发双击（走单击逻辑）', () => {
    const result = handleSelectEnd({
      selected: ['comp-1'],
      inputEvent: createMouseEvent(),
      lastClick: { id: 'comp-1', time: 500 }, // 600ms 前，超过 400ms 阈值
      activeGroupId: null,
      components: [createComponent('comp-1')],
      isDragStart: true,
      currentTime: 1100,
    });

    expect(result.isDoubleClick).toBe(false);
    expect(result.newLastClick).toEqual({ id: 'comp-1', time: 1100 });
  });

  it('不同组件不触发双击（走单击逻辑）', () => {
    const result = handleSelectEnd({
      selected: ['comp-2'],
      inputEvent: createMouseEvent(),
      lastClick: { id: 'comp-1', time: 800 }, // 200ms 前，但不同 id
      activeGroupId: null,
      components: [createComponent('comp-2')],
      isDragStart: true,
      currentTime: 1000,
    });

    expect(result.isDoubleClick).toBe(false);
    expect(result.newLastClick).toEqual({ id: 'comp-2', time: 1000 });
  });
});
