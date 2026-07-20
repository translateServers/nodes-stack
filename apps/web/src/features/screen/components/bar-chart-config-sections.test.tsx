/**
 * bar-chart 四层配置分组测试（阶段 2 任务 4.2-4.5、5.2）
 *
 * 验证点（对应 tasks.md 4.2-4.5、5.2 验证要求）：
 * - 4.2 静态数据编辑：预填生效数据；合法提交写入数据层（遗留组件一次性迁移，
 *   只产生一次更新）；非法 JSON / 非法结构被拒并展示可读错误；取消与无变化不写入
 * - 4.3 字段映射：字段推断区分字符串/数值；未配置时展示默认推断规则；
 *   映射修改只写数据层
 * - 4.4 逻辑层：排序字段/方向/条数限制提交写入 logic；每次提交一次更新；
 *   可清空；非法输入回退；不动其他层
 * - 4.5 交互层：开关写入 interaction.tooltipOnHover，不动其他层
 * - 5.2 API 配置表单：类型切换为草稿态（不写入）；预填既有配置；合法提交经共享
 *   Schema 校验入历史（遗留 props.data 迁移为静态数据保留）；非法 URL / 空地址 /
 *   非法刷新间隔被拒并展示可读错误；空键行忽略；取消与无变化不写入；只写数据层
 * - 集成（真实 store）：合法提交入历史一条；迁移后 props.data 清除
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import { BarChartConfigSections, inferFieldsFromSample } from './bar-chart-config-sections';
import { useScreenEditorStore } from '../stores/editor-store';

function asInput(el: HTMLElement): HTMLInputElement {
  return el as HTMLInputElement;
}
function asTextarea(el: HTMLElement): HTMLTextAreaElement {
  return el as HTMLTextAreaElement;
}

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

const LEGACY_DATA = [
  { name: '一月', value: 30 },
  { name: '二月', value: 80 },
];

const CUSTOM_DATA = [
  { city: '北京', sales: 100 },
  { city: '上海', sales: 200 },
];

function makeBarChart(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
  return {
    id: 'chart-1',
    type: 'bar-chart',
    name: '柱状图',
    position: { x: 0, y: 0, width: 400, height: 300 },
    style: {},
    props: { title: '销售' },
    status: { locked: false, hidden: false },
    zIndex: 0,
    ...overrides,
  };
}

function renderSections(component: ScreenComponent, onUpdate = vi.fn()) {
  const utils = render(<BarChartConfigSections component={component} onUpdate={onUpdate} />);
  return { onUpdate, ...utils };
}

/** 打开 Radix Select 并选择选项（键盘路径，规避 jsdom 指针捕获差异） */
async function selectOption(triggerName: string, optionName: string) {
  const trigger = screen.getByRole('combobox', { name: triggerName });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.keyDown(option, { key: 'Enter' });
}

describe('inferFieldsFromSample', () => {
  it('按字符串/数值类型分类字段键集合', () => {
    const fields = inferFieldsFromSample([
      { city: '北京', sales: 100, active: true },
      { city: '上海', sales: 200, region: '华东' },
    ]);
    expect(fields.stringFields).toEqual(['city', 'region']);
    expect(fields.numberFields).toEqual(['sales']);
  });

  it('支持数据路径提取嵌套数组', () => {
    const fields = inferFieldsFromSample({ data: { list: [{ n: 'a', v: 1 }] } }, 'data.list');
    expect(fields.stringFields).toEqual(['n']);
    expect(fields.numberFields).toEqual(['v']);
  });

  it('非数组输入返回空字段集合', () => {
    expect(inferFieldsFromSample('oops')).toEqual({ stringFields: [], numberFields: [] });
    expect(inferFieldsFromSample(undefined)).toEqual({ stringFields: [], numberFields: [] });
  });
});

describe('4.2 静态数据编辑与校验反馈', () => {
  it('遗留组件预填 props.data 生效数据', () => {
    renderSections(makeBarChart({ props: { title: '销售', data: LEGACY_DATA } }));
    const editor = screen.getByTestId('static-data-editor');
    expect(asTextarea(editor).value).toBe(JSON.stringify(LEGACY_DATA, null, 2));
  });

  it('已配置数据层时预填 dataSource.staticData（数据层优先）', () => {
    renderSections(
      makeBarChart({
        props: { title: '销售', data: LEGACY_DATA },
        dataSource: { type: 'static', staticData: CUSTOM_DATA },
      }),
    );
    const editor = screen.getByTestId('static-data-editor');
    expect(asTextarea(editor).value).toBe(JSON.stringify(CUSTOM_DATA, null, 2));
  });

  it('合法提交：一次更新写入数据层并迁移清除 props.data', () => {
    const component = makeBarChart({ props: { title: '销售', data: LEGACY_DATA } });
    const { onUpdate } = renderSections(component);

    const editor = screen.getByTestId('static-data-editor');
    fireEvent.change(editor, { target: { value: JSON.stringify(CUSTOM_DATA) } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource).toEqual({ type: 'static', staticData: CUSTOM_DATA });
    // 遗留 props.data 被迁移清除，视觉 props 保留
    expect(updates.props).toEqual({ title: '销售' });
    // 不涉及其他层
    expect(updates).not.toHaveProperty('logic');
    expect(updates).not.toHaveProperty('interaction');
    expect(updates).not.toHaveProperty('style');
  });

  it('非法 JSON 被拒绝：展示可读错误且不写入组件', () => {
    const { onUpdate } = renderSections(
      makeBarChart({ props: { title: '销售', data: LEGACY_DATA } }),
    );

    fireEvent.change(screen.getByTestId('static-data-editor'), { target: { value: 'not json' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('JSON 格式错误');
  });

  it('非法结构（非数组）被拒绝且不写入组件', () => {
    const { onUpdate } = renderSections(
      makeBarChart({ props: { title: '销售', data: LEGACY_DATA } }),
    );

    fireEvent.change(screen.getByTestId('static-data-editor'), { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('对象数组');
  });

  it('非法结构（数组条目非对象）被拒绝且不写入组件', () => {
    const { onUpdate } = renderSections(
      makeBarChart({ props: { title: '销售', data: LEGACY_DATA } }),
    );

    fireEvent.change(screen.getByTestId('static-data-editor'), { target: { value: '[1,2]' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('第 1 条数据必须是对象');
  });

  it('无变化提交不写入（不产生空历史）', () => {
    const { onUpdate } = renderSections(
      makeBarChart({ props: { title: '销售', data: LEGACY_DATA } }),
    );

    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('取消恢复草稿且不写入', () => {
    const { onUpdate } = renderSections(
      makeBarChart({ props: { title: '销售', data: LEGACY_DATA } }),
    );

    const editor = screen.getByTestId('static-data-editor');
    const original = asTextarea(editor).value;
    fireEvent.change(editor, { target: { value: '[{"name":"x","value":1}]' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(asTextarea(editor).value).toBe(original);
  });
});

describe('4.3 字段映射配置', () => {
  it('基于静态数据样本推断可选字段（区分字符串/数值）', async () => {
    renderSections(makeBarChart({ dataSource: { type: 'static', staticData: CUSTOM_DATA } }));

    // 维度下拉列出字符串字段
    fireEvent.keyDown(screen.getByRole('combobox', { name: '维度字段' }), { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: 'city' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'sales' })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    // 数值下拉列出数值字段
    fireEvent.keyDown(screen.getByRole('combobox', { name: '数值字段' }), { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: 'sales' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'city' })).toBeNull();
  });

  it('未配置映射时展示默认推断规则提示', () => {
    renderSections(makeBarChart({ dataSource: { type: 'static', staticData: CUSTOM_DATA } }));
    expect(screen.getByText(/按默认规则推断：name → 维度、value → 数值/)).toBeDefined();
  });

  it('映射修改只写数据层，不动逻辑/视觉/交互层', async () => {
    const component = makeBarChart({
      dataSource: { type: 'static', staticData: CUSTOM_DATA },
      logic: { limit: 5 },
      interaction: { tooltipOnHover: true },
    });
    const { onUpdate } = renderSections(component);

    await selectOption('维度字段', 'city');

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource).toEqual({
      type: 'static',
      staticData: CUSTOM_DATA,
      fieldMapping: { dimension: 'city', value: 'sales' },
    });
    expect(updates).not.toHaveProperty('logic');
    expect(updates).not.toHaveProperty('interaction');
    expect(updates).not.toHaveProperty('style');
    // 组件本无 props.data 时 props 原样透传（引用不变）
    expect(updates.props).toBe(component.props);
  });

  it('选回默认推断时清除字段映射', async () => {
    const component = makeBarChart({
      dataSource: {
        type: 'static',
        staticData: CUSTOM_DATA,
        fieldMapping: { dimension: 'city', value: 'sales' },
      },
    });
    const { onUpdate } = renderSections(component);

    await selectOption('维度字段', '默认推断');

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource?.fieldMapping).toBeUndefined();
  });
});

describe('4.4 逻辑层配置', () => {
  it('提交排序字段：只写 logic 层', async () => {
    const component = makeBarChart({
      dataSource: { type: 'static', staticData: LEGACY_DATA },
      interaction: { tooltipOnHover: false },
    });
    const { onUpdate } = renderSections(component);

    await selectOption('排序字段', '数值');

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.logic).toEqual({ sortField: 'value' });
    expect(updates).not.toHaveProperty('dataSource');
    expect(updates).not.toHaveProperty('interaction');
    expect(updates).not.toHaveProperty('style');
    expect(updates).not.toHaveProperty('props');
  });

  it('提交排序方向时保留既有排序字段', async () => {
    const component = makeBarChart({ logic: { sortField: 'dimension' } });
    const { onUpdate } = renderSections(component);

    await selectOption('排序方向', '降序');

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.logic).toEqual({ sortField: 'dimension', sortDirection: 'desc' });
  });

  it('提交条数限制（正整数）', () => {
    const { onUpdate } = renderSections(makeBarChart());

    const limitInput = screen.getByRole('spinbutton', { name: '条数限制' });
    fireEvent.focus(limitInput);
    fireEvent.change(limitInput, { target: { value: '3' } });
    fireEvent.blur(limitInput);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.logic).toEqual({ limit: 3 });
  });

  it('清空条数限制后逻辑层为空时移除 logic 配置', () => {
    const { onUpdate } = renderSections(makeBarChart({ logic: { limit: 3 } }));

    const limitInput = screen.getByRole('spinbutton', { name: '条数限制' });
    fireEvent.focus(limitInput);
    fireEvent.change(limitInput, { target: { value: '' } });
    fireEvent.blur(limitInput);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.logic).toBeUndefined();
  });

  it('非法条数（非正整数）回退不写入', () => {
    const { onUpdate } = renderSections(makeBarChart({ logic: { limit: 3 } }));

    const limitInput = screen.getByRole('spinbutton', { name: '条数限制' });
    fireEvent.focus(limitInput);
    fireEvent.change(limitInput, { target: { value: '2.5' } });
    fireEvent.blur(limitInput);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('条数未变化时提交不写入（不产生空历史）', () => {
    const { onUpdate } = renderSections(makeBarChart({ logic: { limit: 3 } }));

    const limitInput = screen.getByRole('spinbutton', { name: '条数限制' });
    fireEvent.focus(limitInput);
    fireEvent.blur(limitInput);

    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('4.5 交互层配置', () => {
  it('默认关闭，开启开关写入 interaction.tooltipOnHover', () => {
    const component = makeBarChart({
      dataSource: { type: 'static', staticData: LEGACY_DATA },
      logic: { limit: 2 },
    });
    const { onUpdate } = renderSections(component);

    const toggle = screen.getByRole('switch', { name: '悬停提示' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.interaction).toEqual({ tooltipOnHover: true });
    expect(updates).not.toHaveProperty('dataSource');
    expect(updates).not.toHaveProperty('logic');
    expect(updates).not.toHaveProperty('style');
    expect(updates).not.toHaveProperty('props');
  });

  it('已开启时开关为选中态，再次点击写回关闭', () => {
    const { onUpdate } = renderSections(makeBarChart({ interaction: { tooltipOnHover: true } }));

    const toggle = screen.getByRole('switch', { name: '悬停提示' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.interaction).toEqual({ tooltipOnHover: false });
  });
});

describe('5.2 API 数据源配置表单', () => {
  const API_CONFIG = {
    url: 'https://example.com/api/chart',
    method: 'GET' as const,
    headers: { 'X-Api-Key': 'secret-key' },
    params: { type: 'sales', year: 2026 },
    refreshInterval: 30,
  };

  it('静态组件默认选中静态数据；切换到 API 展示 API 表单（切换本身不写入）', () => {
    const { onUpdate } = renderSections(
      makeBarChart({ dataSource: { type: 'static', staticData: LEGACY_DATA } }),
    );

    expect(screen.getByRole('radio', { name: '静态数据' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByTestId('static-data-editor')).toBeDefined();

    fireEvent.click(screen.getByRole('radio', { name: 'API' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'API' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('textbox', { name: '请求地址' })).toBeDefined();
    expect(screen.getByTestId('api-params-editor')).toBeDefined();
    expect(screen.getByTestId('api-headers-editor')).toBeDefined();
    expect(screen.getByRole('spinbutton', { name: '刷新间隔' })).toBeDefined();
    expect(screen.queryByTestId('static-data-editor')).toBeNull();
  });

  it('API 组件默认展示 API 表单并预填既有配置（含非字符串参数值序列化）', () => {
    renderSections(makeBarChart({ dataSource: { type: 'api', apiConfig: API_CONFIG } }));

    expect(screen.getByRole('radio', { name: 'API' }).getAttribute('aria-checked')).toBe('true');
    expect(asInput(screen.getByRole('textbox', { name: '请求地址' })).value).toBe(API_CONFIG.url);
    const paramNames = screen.getAllByRole('textbox', { name: '参数名' });
    expect(paramNames.map((input) => asInput(input).value)).toEqual(['type', 'year']);
    const paramValues = screen.getAllByRole('textbox', { name: '参数值' });
    expect(paramValues.map((input) => asInput(input).value)).toEqual(['sales', '2026']);
    const headerNames = screen.getAllByRole('textbox', { name: '请求头名' });
    expect(headerNames.map((input) => asInput(input).value)).toEqual(['X-Api-Key']);
    const headerValues = screen.getAllByRole('textbox', { name: '请求头值' });
    expect(headerValues.map((input) => asInput(input).value)).toEqual(['secret-key']);
    expect(asInput(screen.getByRole('spinbutton', { name: '刷新间隔' })).value).toBe('30');
  });

  it('合法提交：一次更新写入数据层（遗留 props.data 迁移为静态数据保留，只写数据层）', () => {
    const component = makeBarChart({
      props: { title: '销售', data: LEGACY_DATA },
      logic: { limit: 3 },
      interaction: { tooltipOnHover: true },
    });
    const { onUpdate } = renderSections(component);

    fireEvent.click(screen.getByRole('radio', { name: 'API' }));
    fireEvent.change(screen.getByRole('textbox', { name: '请求地址' }), {
      target: { value: 'https://example.com/api/chart' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加参数' }));
    fireEvent.change(screen.getAllByRole('textbox', { name: '参数名' })[0], {
      target: { value: 'type' },
    });
    fireEvent.change(screen.getAllByRole('textbox', { name: '参数值' })[0], {
      target: { value: 'sales' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加请求头' }));
    fireEvent.change(screen.getAllByRole('textbox', { name: '请求头名' })[0], {
      target: { value: 'X-Api-Key' },
    });
    fireEvent.change(screen.getAllByRole('textbox', { name: '请求头值' })[0], {
      target: { value: 'secret' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: '刷新间隔' }), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource).toEqual({
      type: 'api',
      staticData: LEGACY_DATA,
      apiConfig: {
        url: 'https://example.com/api/chart',
        method: 'GET',
        params: { type: 'sales' },
        headers: { 'X-Api-Key': 'secret' },
        refreshInterval: 30,
      },
    });
    // 遗留 props.data 被迁移清除，视觉 props 保留
    expect(updates.props).toEqual({ title: '销售' });
    // 不涉及其他层
    expect(updates).not.toHaveProperty('logic');
    expect(updates).not.toHaveProperty('interaction');
    expect(updates).not.toHaveProperty('style');
  });

  it('空键行被忽略；删除行后不再提交对应键值', () => {
    const { onUpdate } = renderSections(
      makeBarChart({
        dataSource: { type: 'api', apiConfig: { url: API_CONFIG.url, method: 'GET' } },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '添加参数' }));
    fireEvent.click(screen.getByRole('button', { name: '添加参数' }));
    const paramNames = screen.getAllByRole('textbox', { name: '参数名' });
    fireEvent.change(paramNames[0], { target: { value: 'keep' } });
    // 第二行只填值不填键，应被忽略
    fireEvent.change(screen.getAllByRole('textbox', { name: '参数值' })[1], {
      target: { value: 'orphan' },
    });
    // 删除第二行
    fireEvent.click(screen.getAllByRole('button', { name: '删除参数行' })[1]);
    expect(screen.getAllByRole('textbox', { name: '参数名' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource?.apiConfig?.params).toEqual({ keep: '' });
  });

  it('非法 URL 被拒绝：展示可读错误且不写入组件', () => {
    const { onUpdate } = renderSections(
      makeBarChart({
        dataSource: { type: 'api', apiConfig: { url: API_CONFIG.url, method: 'GET' } },
      }),
    );

    fireEvent.change(screen.getByRole('textbox', { name: '请求地址' }), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('合法 URL');
  });

  it('空请求地址被拒绝且不写入组件', () => {
    const { onUpdate } = renderSections(makeBarChart());

    fireEvent.click(screen.getByRole('radio', { name: 'API' }));
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('请求地址不能为空');
  });

  it.each(['-1', '2.5'])('非法刷新间隔（%s）被拒绝且不写入组件', (value) => {
    const { onUpdate } = renderSections(
      makeBarChart({
        dataSource: { type: 'api', apiConfig: { url: API_CONFIG.url, method: 'GET' } },
      }),
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: '刷新间隔' }), {
      target: { value },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('刷新间隔');
  });

  it('无变化提交不写入（不产生空历史）', () => {
    const { onUpdate } = renderSections(
      makeBarChart({ dataSource: { type: 'api', apiConfig: API_CONFIG } }),
    );

    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('取消恢复草稿且不写入', () => {
    const { onUpdate } = renderSections(
      makeBarChart({ dataSource: { type: 'api', apiConfig: API_CONFIG } }),
    );

    const urlInput = screen.getByRole('textbox', { name: '请求地址' });
    fireEvent.change(urlInput, { target: { value: 'https://example.com/api/other' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(asInput(urlInput).value).toBe(API_CONFIG.url);
  });

  it('API 组件切换到静态并应用：类型翻转写入（保留 apiConfig 与静态数据）', () => {
    const { onUpdate } = renderSections(
      makeBarChart({
        dataSource: { type: 'api', staticData: CUSTOM_DATA, apiConfig: API_CONFIG },
      }),
    );

    fireEvent.click(screen.getByRole('radio', { name: '静态数据' }));
    // 静态表单预填保留的 staticData
    const editor = screen.getByTestId('static-data-editor');
    expect(asTextarea(editor).value).toBe(JSON.stringify(CUSTOM_DATA, null, 2));

    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource).toEqual({
      type: 'static',
      staticData: CUSTOM_DATA,
      apiConfig: API_CONFIG,
    });
  });
});

describe('集成（真实 store）：静态数据提交入历史与迁移', () => {
  function makeProject(components: ScreenComponent[]): ScreenProject {
    return {
      id: 'p1',
      name: '测试大屏',
      description: null,
      canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
      components,
      status: 'draft',
      thumbnail: null,
      createdAt: '2025-06-01 10:00:00',
      updatedAt: '2025-06-01 10:00:00',
    };
  }

  function getComponent(): ScreenComponent {
    const project = useScreenEditorStore.getState().project;
    if (!project) throw new Error('project 未加载');
    return project.components[0];
  }

  beforeEach(() => {
    useScreenEditorStore
      .getState()
      .loadProject(makeProject([makeBarChart({ props: { title: '销售', data: LEGACY_DATA } })]));
  });

  function renderWithStore() {
    const component = getComponent();
    return render(
      <BarChartConfigSections
        component={component}
        onUpdate={(updates) =>
          useScreenEditorStore.getState().updateComponent(component.id, updates)
        }
      />,
    );
  }

  it('合法提交入历史一条，迁移后 props.data 清除且数据层生效', () => {
    const before = useScreenEditorStore.getState().history.past.length;
    renderWithStore();

    fireEvent.change(screen.getByTestId('static-data-editor'), {
      target: { value: JSON.stringify(CUSTOM_DATA) },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(useScreenEditorStore.getState().history.past.length).toBe(before + 1);
    const migrated = getComponent();
    expect(migrated.dataSource).toEqual({ type: 'static', staticData: CUSTOM_DATA });
    expect(migrated.props).not.toHaveProperty('data');
    expect(migrated.props).toEqual({ title: '销售' });
  });

  it('非法提交不写入组件，画布保持上一份有效配置', () => {
    const before = useScreenEditorStore.getState().history.past.length;
    renderWithStore();

    fireEvent.change(screen.getByTestId('static-data-editor'), { target: { value: 'bad json' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(useScreenEditorStore.getState().history.past.length).toBe(before);
    const unchanged = getComponent();
    expect(unchanged.dataSource).toBeUndefined();
    expect(unchanged.props).toEqual({ title: '销售', data: LEGACY_DATA });
  });

  it('逻辑层每次提交产生一条历史', () => {
    const before = useScreenEditorStore.getState().history.past.length;
    renderWithStore();

    const limitInput = screen.getByRole('spinbutton', { name: '条数限制' });
    fireEvent.focus(limitInput);
    fireEvent.change(limitInput, { target: { value: '5' } });
    fireEvent.blur(limitInput);

    expect(useScreenEditorStore.getState().history.past.length).toBe(before + 1);
    expect(getComponent().logic).toEqual({ limit: 5 });
    // 逻辑层提交不影响遗留 props.data（未经过数据层 UI）
    expect(getComponent().props).toEqual({ title: '销售', data: LEGACY_DATA });
  });

  it('合法 API 配置提交入历史一条，遗留 props.data 迁移为静态数据保留', () => {
    const before = useScreenEditorStore.getState().history.past.length;
    renderWithStore();

    fireEvent.click(screen.getByRole('radio', { name: 'API' }));
    fireEvent.change(screen.getByRole('textbox', { name: '请求地址' }), {
      target: { value: 'https://example.com/api/chart' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(useScreenEditorStore.getState().history.past.length).toBe(before + 1);
    const updated = getComponent();
    expect(updated.dataSource).toEqual({
      type: 'api',
      staticData: LEGACY_DATA,
      apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
    });
    expect(updated.props).toEqual({ title: '销售' });
    // 非法/其他层不受影响
    expect(updated.logic).toBeUndefined();
    expect(updated.interaction).toBeUndefined();
  });

  it('非法 API 配置提交不写入组件，画布保持上一份有效配置', () => {
    const before = useScreenEditorStore.getState().history.past.length;
    renderWithStore();

    fireEvent.click(screen.getByRole('radio', { name: 'API' }));
    fireEvent.change(screen.getByRole('textbox', { name: '请求地址' }), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(useScreenEditorStore.getState().history.past.length).toBe(before);
    const unchanged = getComponent();
    expect(unchanged.dataSource).toBeUndefined();
    expect(unchanged.props).toEqual({ title: '销售', data: LEGACY_DATA });
  });
});

describe('5.3 请求测试与响应预览', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  function renderApiForm(component?: ScreenComponent) {
    const comp =
      component ??
      makeBarChart({
        dataSource: {
          type: 'api',
          apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
        },
      });
    return renderSections(comp);
  }

  it('成功请求展示状态码与截断响应预览', async () => {
    const responseData = [{ name: '一月', value: 30 }];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    renderApiForm();
    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));

    const result = await screen.findByTestId('request-test-result');
    expect(result.textContent).toContain('200');
    const preview = screen.getByTestId('request-test-preview');
    expect(preview.textContent).toContain('一月');
  });

  it('响应过长时截断展示', async () => {
    const longData = Array.from({ length: 100 }, (_, i) => ({ name: `项目${i}`, value: i }));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(longData),
    });

    renderApiForm();
    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));

    const preview = await screen.findByTestId('request-test-preview');
    expect(preview.textContent.length).toBeLessThanOrEqual(502);
    expect(preview.textContent).toContain('…');
  });

  it('非 2xx 响应展示可读错误（含状态码）', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    renderApiForm();
    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));

    const error = await screen.findByTestId('request-test-error');
    expect(error.textContent).toContain('404');
  });

  it('网络失败展示可读错误', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    renderApiForm();
    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));

    const error = await screen.findByTestId('request-test-error');
    expect(error.textContent).toContain('网络请求失败');
  });

  it('响应非合法 JSON 展示解析错误', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    renderApiForm();
    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));

    const error = await screen.findByTestId('request-test-error');
    expect(error.textContent).toContain('不是合法 JSON');
  });

  it('空请求地址时展示提示且不发起请求', () => {
    renderApiForm(makeBarChart());
    fireEvent.click(screen.getByRole('radio', { name: 'API' }));
    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));

    expect(screen.getByTestId('request-test-error').textContent).toContain('请先填写请求地址');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('请求测试不写入组件配置、不产生本地编辑历史', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    const { onUpdate } = renderApiForm();
    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));
    await screen.findByTestId('request-test-result');

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('请求测试使用当前草稿值（含查询参数和请求头）', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    renderApiForm();
    fireEvent.click(screen.getByRole('button', { name: '添加参数' }));
    fireEvent.change(screen.getAllByRole('textbox', { name: '参数名' })[0], {
      target: { value: 'type' },
    });
    fireEvent.change(screen.getAllByRole('textbox', { name: '参数值' })[0], {
      target: { value: 'sales' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加请求头' }));
    fireEvent.change(screen.getAllByRole('textbox', { name: '请求头名' })[0], {
      target: { value: 'Authorization' },
    });
    fireEvent.change(screen.getAllByRole('textbox', { name: '请求头值' })[0], {
      target: { value: 'Bearer token' },
    });

    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));
    await screen.findByTestId('request-test-result');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('type=sales');
    expect(options.headers).toEqual({ Authorization: 'Bearer token' });
  });
});

describe('5.4 API 数据路径与字段映射配置', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('API 表单展示数据路径输入框并预填既有配置', () => {
    renderSections(
      makeBarChart({
        dataSource: {
          type: 'api',
          apiConfig: { url: 'https://example.com/api', method: 'GET' },
          dataPath: 'data.list',
        },
      }),
    );

    const dataPathInput = screen.getByRole('textbox', { name: '数据路径' });
    expect(asInput(dataPathInput).value).toBe('data.list');
  });

  it('应用时数据路径写入数据层配置', () => {
    const { onUpdate } = renderSections(
      makeBarChart({
        dataSource: {
          type: 'api',
          apiConfig: { url: 'https://example.com/api', method: 'GET' },
        },
      }),
    );

    fireEvent.change(screen.getByRole('textbox', { name: '数据路径' }), {
      target: { value: 'result.items' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource?.dataPath).toBe('result.items');
  });

  it('数据路径为空时不写入 dataPath 字段', () => {
    const { onUpdate } = renderSections(
      makeBarChart({
        dataSource: {
          type: 'api',
          apiConfig: { url: 'https://example.com/api', method: 'GET' },
          dataPath: 'old.path',
        },
      }),
    );

    fireEvent.change(screen.getByRole('textbox', { name: '数据路径' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource?.dataPath).toBeUndefined();
  });

  it('请求测试成功后字段映射下拉从响应样本推断可选字段', async () => {
    const responseData = [
      { city: '北京', sales: 100, region: '华北' },
      { city: '上海', sales: 200, region: '华东' },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    renderSections(
      makeBarChart({
        dataSource: {
          type: 'api',
          apiConfig: { url: 'https://example.com/api', method: 'GET' },
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));
    await screen.findByTestId('request-test-result');

    // 维度下拉应包含字符串字段
    fireEvent.keyDown(screen.getByRole('combobox', { name: '维度字段' }), { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: 'city' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'region' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'sales' })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    // 数值下拉应包含数值字段
    fireEvent.keyDown(screen.getByRole('combobox', { name: '数值字段' }), { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: 'sales' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'city' })).toBeNull();
  });

  it('嵌套路径响应样本：配置数据路径后字段推断使用路径提取后的数组', async () => {
    const responseData = { data: { list: [{ label: 'A', count: 10 }] } };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    renderSections(
      makeBarChart({
        dataSource: {
          type: 'api',
          apiConfig: { url: 'https://example.com/api', method: 'GET' },
          dataPath: 'data.list',
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));
    await screen.findByTestId('request-test-result');

    // 字段推断应基于 data.list 路径提取后的数组
    fireEvent.keyDown(screen.getByRole('combobox', { name: '维度字段' }), { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: 'label' })).toBeDefined();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fireEvent.keyDown(screen.getByRole('combobox', { name: '数值字段' }), { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: 'count' })).toBeDefined();
  });

  it('字段映射修改只写数据层，不影响其他层', async () => {
    const responseData = [{ city: '北京', sales: 100 }];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    const component = makeBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api', method: 'GET' },
      },
      logic: { limit: 5 },
      interaction: { tooltipOnHover: true },
    });
    const { onUpdate } = renderSections(component);

    fireEvent.click(screen.getByRole('button', { name: '测试请求' }));
    await screen.findByTestId('request-test-result');

    await selectOption('维度字段', 'city');

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updates = onUpdate.mock.calls[0][0] as Partial<ScreenComponent>;
    expect(updates.dataSource?.fieldMapping).toEqual({ dimension: 'city', value: 'sales' });
    expect(updates).not.toHaveProperty('logic');
    expect(updates).not.toHaveProperty('interaction');
    expect(updates).not.toHaveProperty('style');
  });
});
