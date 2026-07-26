/**
 * GlobalVariablesPanel 组件测试（Task 9.4）
 *
 * 验证点（对应 SubTask 9.4 验证要求）：
 * 1. 无全局变量时显示空状态
 * 2. 渲染变量列表（名称/类型/值摘要）
 * 3. 点击「+ 添加」打开对话框
 * 4. 提交添加表单调用 addGlobalVariable
 * 5. 点击编辑按钮打开对话框（预填当前值）
 * 6. 提交编辑表单调用 updateGlobalVariable
 * 7. 点击删除按钮显示确认对话框
 * 8. 确认删除调用 removeGlobalVariable
 * 9. static/api/computed 三种类型的表单字段动态切换
 *
 * 测试策略：
 * - mock editor-store：用 vi.fn() 替换 actions，用受控对象控制 project.globalVariables
 * - 不依赖真实 zustand store，避免副作用与跨用例污染
 * - 用 data-testid 定位元素，与生产代码契约一致
 */

import { beforeAll, describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Mock editor-store：GlobalVariablesPanel 依赖 zustand store，测试用 vi.fn() 替换以便控制返回值
vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: vi.fn(),
}));

import { useScreenEditorStore } from '../stores/editor-store';
import GlobalVariablesPanel from './global-variables-panel';
import type { GlobalVariable } from '@nebula/shared';

/** 测试用 store 状态结构（仅包含 GlobalVariablesPanel 读取的字段） */
interface StoreState {
  project: { globalVariables: GlobalVariable[] } | null;
  addGlobalVariable: ReturnType<typeof vi.fn>;
  updateGlobalVariable: ReturnType<typeof vi.fn>;
  removeGlobalVariable: ReturnType<typeof vi.fn>;
}

/** 创建一个最小可用的 static 类型全局变量 */
function makeStaticVariable(overrides: Partial<GlobalVariable> = {}): GlobalVariable {
  return {
    id: 'var-1',
    name: 'token',
    type: 'static',
    value: 'abc123',
    ...overrides,
  };
}

/** 创建 api 类型变量 */
function makeApiVariable(overrides: Partial<GlobalVariable> = {}): GlobalVariable {
  return {
    id: 'var-2',
    name: 'userData',
    type: 'api',
    apiConfig: {
      url: 'https://api.example.com/user',
      method: 'GET',
      refreshInterval: 5000,
    },
    ...overrides,
  };
}

/** 创建 computed 类型变量 */
function makeComputedVariable(overrides: Partial<GlobalVariable> = {}): GlobalVariable {
  return {
    id: 'var-3',
    name: 'total',
    type: 'computed',
    expression: 'globalVars.a + globalVars.b',
    ...overrides,
  };
}

/** 将 HTMLElement 收窄为 HTMLInputElement（避免 no-unnecessary-type-assertion 误报） */
function asInput(el: HTMLElement): HTMLInputElement {
  return el as HTMLInputElement;
}

/** 将 HTMLElement 收窄为 HTMLTextAreaElement */
function asTextarea(el: HTMLElement): HTMLTextAreaElement {
  return el as HTMLTextAreaElement;
}

/**
 * 打开 Radix Select 并选择选项（键盘路径，规避 jsdom 指针捕获差异）。
 *
 * jsdom 未实现 hasPointerCapture，直接 userEvent.click SelectTrigger 会抛错；
 * 改用 keyDown ArrowDown 打开 + keyDown Enter 选择，与 bar-chart 测试一致。
 */
async function selectOptionByTestId(triggerTestId: string, optionTestId: string): Promise<void> {
  const trigger = screen.getByTestId(triggerTestId);
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const option = await screen.findByTestId(optionTestId);
  fireEvent.keyDown(option, { key: 'Enter' });
}

/** 将 mock useScreenEditorStore 转为可操控的 Mock 函数 */
const mockUseStore = useScreenEditorStore as unknown as ReturnType<typeof vi.fn>;

/** 当前测试用 store 状态（mock 闭包读取此变量） */
let currentState: StoreState;

/** 设置 store 状态并让 mock 返回对应字段的值 */
function setStoreState(state: StoreState): void {
  currentState = state;
  mockUseStore.mockImplementation((selector: (s: StoreState) => unknown) => selector(currentState));
}

describe('GlobalVariablesPanel', () => {
  // Radix Select 弹层依赖 floating-ui autoUpdate（ResizeObserver）与 scrollIntoView，
  // jsdom 未实现，提供空实现桩
  beforeAll(() => {
    if (typeof window.ResizeObserver !== 'function') {
      class MockResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
      vi.stubGlobal('ResizeObserver', MockResizeObserver);
    }
    if (typeof Element.prototype.scrollIntoView !== 'function') {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  beforeEach(() => {
    mockUseStore.mockReset();
  });

  describe('空状态', () => {
    it('无全局变量时显示空状态', () => {
      setStoreState({
        project: { globalVariables: [] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      const empty = screen.getByTestId('global-variables-empty');
      expect(empty).toBeDefined();
      expect(empty.textContent).toBe('暂无全局变量，点击右上角添加');
      // 列表不渲染
      expect(screen.queryByTestId('global-variables-list')).toBeNull();
    });

    it('project 为 null 时仍显示空状态（store selector 走 ?? [] 兜底）', () => {
      setStoreState({
        project: null,
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      expect(screen.getByTestId('global-variables-empty')).toBeDefined();
    });
  });

  describe('渲染变量列表', () => {
    it('渲染变量列表（名称/类型/值摘要）', () => {
      const staticVar = makeStaticVariable();
      const apiVar = makeApiVariable();
      const computedVar = makeComputedVariable();

      setStoreState({
        project: { globalVariables: [staticVar, apiVar, computedVar] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      const items = screen.getAllByTestId('global-variables-item');
      expect(items).toHaveLength(3);

      // 名称
      const names = screen.getAllByTestId('global-variables-item-name').map((el) => el.textContent);
      expect(names).toEqual(['token', 'userData', 'total']);

      // 类型徽章
      const types = screen.getAllByTestId('global-variables-item-type').map((el) => el.textContent);
      expect(types).toEqual(['静态', 'API', '表达式']);

      // 值摘要：static 显示 JSON.stringify(value)，api 显示 url，computed 显示 expression
      const summaries = screen
        .getAllByTestId('global-variables-item-summary')
        .map((el) => el.textContent);
      expect(summaries[0]).toBe(JSON.stringify('abc123'));
      expect(summaries[1]).toBe('https://api.example.com/user');
      expect(summaries[2]).toBe('globalVars.a + globalVars.b');
    });

    it('static 变量 value 为对象时摘要展示 JSON 序列化结果', () => {
      const objVar = makeStaticVariable({
        id: 'var-obj',
        name: 'config',
        value: { token: 'abc', retry: 3 },
      });

      setStoreState({
        project: { globalVariables: [objVar] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      const summary = screen.getByTestId('global-variables-item-summary');
      expect(summary.textContent).toBe(JSON.stringify({ token: 'abc', retry: 3 }));
    });

    it('api 变量缺 apiConfig 时摘要显示占位符', () => {
      const apiVar = makeApiVariable();
      // 删除 apiConfig 字段模拟数据缺失场景
      delete (apiVar as Partial<GlobalVariable>).apiConfig;

      setStoreState({
        project: { globalVariables: [apiVar] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      const summary = screen.getByTestId('global-variables-item-summary');
      expect(summary.textContent).toBe('—');
    });
  });

  describe('添加流程', () => {
    it('点击「+ 添加」打开对话框', async () => {
      setStoreState({
        project: { globalVariables: [] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      // 对话框初始未挂载
      expect(screen.queryByTestId('global-variables-dialog')).toBeNull();

      fireEvent.click(screen.getByTestId('global-variables-add'));

      // 对话框显示
      await waitFor(() => {
        expect(screen.getByTestId('global-variables-dialog')).toBeDefined();
      });
      // 标题：添加模式
      expect(screen.getByText('添加全局变量')).toBeDefined();
    });

    it('提交添加表单调用 addGlobalVariable', async () => {
      const addGlobalVariable = vi.fn();
      setStoreState({
        project: { globalVariables: [] },
        addGlobalVariable,
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-add'));
      await waitFor(() => {
        expect(screen.getByTestId('global-variables-dialog')).toBeDefined();
      });

      // 默认 type=static，填写名称与 value
      fireEvent.change(screen.getByTestId('global-variables-form-name'), {
        target: { value: 'token' },
      });
      fireEvent.change(screen.getByTestId('global-variables-form-value'), {
        target: { value: 'abc123' },
      });

      fireEvent.click(screen.getByTestId('global-variables-form-submit'));

      expect(addGlobalVariable).toHaveBeenCalledTimes(1);
      // static 类型：value 走 JSON.parse（'abc123' 非 JSON → 保留原字符串）
      expect(addGlobalVariable).toHaveBeenCalledWith({
        name: 'token',
        type: 'static',
        value: 'abc123',
      });
    });

    it('提交添加 api 类型变量时 refreshInterval 由秒转换为毫秒', async () => {
      const addGlobalVariable = vi.fn();
      setStoreState({
        project: { globalVariables: [] },
        addGlobalVariable,
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-add'));
      await waitFor(() => {
        expect(screen.getByTestId('global-variables-dialog')).toBeDefined();
      });

      // 切换 type 到 api（键盘路径，规避 jsdom 指针捕获差异）
      await selectOptionByTestId('global-variables-form-type', 'global-variables-form-type-api');

      // 填写 api 字段
      fireEvent.change(screen.getByTestId('global-variables-form-name'), {
        target: { value: 'userData' },
      });
      fireEvent.change(screen.getByTestId('global-variables-form-url'), {
        target: { value: 'https://api.example.com/user' },
      });
      fireEvent.change(screen.getByTestId('global-variables-form-refresh'), {
        target: { value: '5' },
      });

      fireEvent.click(screen.getByTestId('global-variables-form-submit'));

      expect(addGlobalVariable).toHaveBeenCalledWith({
        name: 'userData',
        type: 'api',
        apiConfig: {
          url: 'https://api.example.com/user',
          method: 'GET',
          refreshInterval: 5000, // 5s → 5000ms
        },
      });
    });

    it('名称为空时不提交（必填校验）', async () => {
      const addGlobalVariable = vi.fn();
      setStoreState({
        project: { globalVariables: [] },
        addGlobalVariable,
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-add'));
      await waitFor(() => {
        expect(screen.getByTestId('global-variables-dialog')).toBeDefined();
      });

      // 名称留空直接提交
      fireEvent.click(screen.getByTestId('global-variables-form-submit'));

      expect(addGlobalVariable).not.toHaveBeenCalled();
    });
  });

  describe('编辑流程', () => {
    it('点击编辑按钮打开对话框（预填当前值）', async () => {
      const variable = makeStaticVariable({ id: 'var-1', name: 'token', value: 'abc123' });
      setStoreState({
        project: { globalVariables: [variable] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-edit'));

      await waitFor(() => {
        expect(screen.getByTestId('global-variables-dialog')).toBeDefined();
      });

      // 标题：编辑模式
      expect(screen.getByText('编辑全局变量')).toBeDefined();
      // 预填：name 与 value
      const nameInput = asInput(screen.getByTestId('global-variables-form-name'));
      expect(nameInput.value).toBe('token');
      const valueTextarea = asTextarea(screen.getByTestId('global-variables-form-value'));
      expect(valueTextarea.value).toBe('abc123');
    });

    it('点击编辑 api 变量时预填 url/method/refreshInterval', async () => {
      const variable = makeApiVariable({
        id: 'var-2',
        name: 'userData',
        apiConfig: {
          url: 'https://api.example.com/user',
          method: 'POST',
          refreshInterval: 30000,
        },
      });
      setStoreState({
        project: { globalVariables: [variable] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-edit'));

      await waitFor(() => {
        expect(screen.getByTestId('global-variables-form-api-fields')).toBeDefined();
      });

      // refreshInterval 由毫秒转换为秒（30000ms → 30s）
      const refreshInput = asInput(screen.getByTestId('global-variables-form-refresh'));
      expect(refreshInput.value).toBe('30');
      const urlInput = asInput(screen.getByTestId('global-variables-form-url'));
      expect(urlInput.value).toBe('https://api.example.com/user');
    });

    it('提交编辑表单调用 updateGlobalVariable', async () => {
      const variable = makeStaticVariable({ id: 'var-1', name: 'token', value: 'abc123' });
      const updateGlobalVariable = vi.fn();
      setStoreState({
        project: { globalVariables: [variable] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable,
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-edit'));
      await waitFor(() => {
        expect(screen.getByTestId('global-variables-dialog')).toBeDefined();
      });

      // 修改 name
      fireEvent.change(screen.getByTestId('global-variables-form-name'), {
        target: { value: 'token2' },
      });

      fireEvent.click(screen.getByTestId('global-variables-form-submit'));

      expect(updateGlobalVariable).toHaveBeenCalledTimes(1);
      expect(updateGlobalVariable).toHaveBeenCalledWith('var-1', {
        name: 'token2',
        type: 'static',
        value: 'abc123',
      });
    });
  });

  describe('删除流程', () => {
    it('点击删除按钮显示确认对话框', () => {
      const variable = makeStaticVariable({ id: 'var-1', name: 'token' });
      setStoreState({
        project: { globalVariables: [variable] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-delete'));

      expect(screen.getByText('删除全局变量？')).toBeDefined();
    });

    it('确认删除调用 removeGlobalVariable', () => {
      const variable = makeStaticVariable({ id: 'var-1', name: 'token' });
      const removeGlobalVariable = vi.fn();
      setStoreState({
        project: { globalVariables: [variable] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable,
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-delete'));
      fireEvent.click(screen.getByTestId('global-variables-delete-confirm'));

      expect(removeGlobalVariable).toHaveBeenCalledTimes(1);
      expect(removeGlobalVariable).toHaveBeenCalledWith('var-1');
    });

    it('取消删除不调用 removeGlobalVariable', () => {
      const variable = makeStaticVariable({ id: 'var-1', name: 'token' });
      const removeGlobalVariable = vi.fn();
      setStoreState({
        project: { globalVariables: [variable] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable,
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-delete'));
      fireEvent.click(screen.getByTestId('global-variables-delete-cancel'));

      expect(removeGlobalVariable).not.toHaveBeenCalled();
    });
  });

  describe('表单字段动态切换', () => {
    it('static/api/computed 三种类型的表单字段动态切换', async () => {
      setStoreState({
        project: { globalVariables: [] },
        addGlobalVariable: vi.fn(),
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-add'));
      await waitFor(() => {
        expect(screen.getByTestId('global-variables-dialog')).toBeDefined();
      });

      // 默认 type=static：static 字段区块可见，api/computed 不可见
      expect(screen.getByTestId('global-variables-form-static-fields')).toBeDefined();
      expect(screen.queryByTestId('global-variables-form-api-fields')).toBeNull();
      expect(screen.queryByTestId('global-variables-form-computed-fields')).toBeNull();

      // 切换到 api（键盘路径，规避 jsdom 指针捕获差异）
      await selectOptionByTestId('global-variables-form-type', 'global-variables-form-type-api');

      // api 字段区块可见，static/computed 不可见
      await waitFor(() => {
        expect(screen.getByTestId('global-variables-form-api-fields')).toBeDefined();
      });
      expect(screen.queryByTestId('global-variables-form-static-fields')).toBeNull();
      expect(screen.queryByTestId('global-variables-form-computed-fields')).toBeNull();

      // 切换到 computed
      await selectOptionByTestId(
        'global-variables-form-type',
        'global-variables-form-type-computed',
      );

      await waitFor(() => {
        expect(screen.getByTestId('global-variables-form-computed-fields')).toBeDefined();
      });
      expect(screen.queryByTestId('global-variables-form-static-fields')).toBeNull();
      expect(screen.queryByTestId('global-variables-form-api-fields')).toBeNull();
    });

    it('computed 类型提交 expression 字段', async () => {
      const addGlobalVariable = vi.fn();
      setStoreState({
        project: { globalVariables: [] },
        addGlobalVariable,
        updateGlobalVariable: vi.fn(),
        removeGlobalVariable: vi.fn(),
      });

      render(<GlobalVariablesPanel />);

      fireEvent.click(screen.getByTestId('global-variables-add'));
      await waitFor(() => {
        expect(screen.getByTestId('global-variables-dialog')).toBeDefined();
      });

      // 切换到 computed（键盘路径，规避 jsdom 指针捕获差异）
      await selectOptionByTestId(
        'global-variables-form-type',
        'global-variables-form-type-computed',
      );

      await waitFor(() => {
        expect(screen.getByTestId('global-variables-form-computed-fields')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('global-variables-form-name'), {
        target: { value: 'total' },
      });
      fireEvent.change(screen.getByTestId('global-variables-form-expression'), {
        target: { value: 'globalVars.a + globalVars.b' },
      });

      fireEvent.click(screen.getByTestId('global-variables-form-submit'));

      expect(addGlobalVariable).toHaveBeenCalledWith({
        name: 'total',
        type: 'computed',
        expression: 'globalVars.a + globalVars.b',
      });
    });
  });
});
