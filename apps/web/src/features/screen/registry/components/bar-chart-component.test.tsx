/**
 * BarChartComponent 测试（阶段 2 任务 3.2）
 *
 * 验证点（对应 tasks.md 3.2 验证要求）：
 * - 渲染数据来自数据层解析结果，不再把 props.data 作为优先数据源
 * - 数据为空时展示空态
 * - 解析失败展示错误占位（6.x 统一契约前的简化形态）
 * - 标题与样式渲染不回退
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DataSourceConfig, InteractionConfig, LogicConfig } from '@nebula/shared';
import { BarChartComponent } from './bar-chart-component';

const SAMPLE_DATA = [
  { name: '一月', value: 30 },
  { name: '二月', value: 80 },
  { name: '三月', value: 45 },
];

function renderBarChart(overrides: {
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  dataSource?: DataSourceConfig;
  logic?: LogicConfig;
  interaction?: InteractionConfig;
}) {
  return render(
    <BarChartComponent
      props={overrides.props ?? {}}
      style={overrides.style ?? {}}
      dataSource={overrides.dataSource}
      logic={overrides.logic}
      interaction={overrides.interaction}
    />,
  );
}

describe('BarChartComponent（数据源驱动渲染）', () => {
  it('渲染数据层静态数据解析结果', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
    });
    expect(container.querySelectorAll('rect')).toHaveLength(3);
    expect(container.textContent).toContain('一月');
    expect(container.textContent).toContain('80');
  });

  it('无数据层配置时回退渲染遗留 props.data（任务 3.3）', () => {
    const { container } = renderBarChart({
      props: { data: SAMPLE_DATA },
    });
    expect(container.querySelectorAll('rect')).toHaveLength(3);
    expect(container.textContent).toContain('一月');
    expect(container.textContent).not.toContain('暂无数据');
  });

  it('props.data 为非法结构时回退解析返回错误占位', () => {
    const { container } = renderBarChart({
      props: { data: 'not-an-array' },
    });
    expect(container.textContent).toContain('数据解析失败');
  });

  it('数据层与 props.data 同时存在时，数据层为生效数据源', () => {
    const layerData = [{ name: '来自数据层', value: 66 }];
    const { container } = renderBarChart({
      props: { data: SAMPLE_DATA },
      dataSource: { type: 'static', staticData: layerData },
    });
    expect(container.textContent).toContain('来自数据层');
    expect(container.textContent).not.toContain('一月');
  });

  it('静态空数组展示空态', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: [] },
    });
    expect(container.textContent).toContain('暂无数据');
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('解析失败展示错误占位与可读信息', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: 'not-an-array' },
    });
    expect(container.textContent).toContain('数据解析失败');
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('应用逻辑层排序与条数限制', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
      logic: { sortField: 'value', sortDirection: 'desc', limit: 1 },
    });
    expect(container.querySelectorAll('rect')).toHaveLength(1);
    expect(container.textContent).toContain('二月');
    expect(container.textContent).not.toContain('一月');
  });

  it('字段映射配置生效', () => {
    const { container } = renderBarChart({
      dataSource: {
        type: 'static',
        staticData: [{ city: '北京', sales: 100 }],
        fieldMapping: { dimension: 'city', value: 'sales' },
      },
    });
    expect(container.textContent).toContain('北京');
    expect(container.textContent).toContain('100');
  });

  it('标题渲染不回退（视觉层 props）', () => {
    const { container } = renderBarChart({
      props: { title: '月度销售' },
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
    });
    expect(container.textContent).toContain('月度销售');
  });

  it('柱条颜色取 style.backgroundColor，不回退', () => {
    const { container } = renderBarChart({
      style: { backgroundColor: '#ff0000' },
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
    });
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0].getAttribute('fill')).toBe('#ff0000');
  });
});

describe('BarChartComponent（交互层悬停提示，阶段 2 任务 4.5）', () => {
  it('tooltipOnHover 开启时每个柱条渲染 SVG <title> 提示', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
      interaction: { tooltipOnHover: true },
    });
    const titles = container.querySelectorAll('title');
    expect(titles).toHaveLength(3);
    expect(titles[0].textContent).toBe('一月: 30');
    expect(titles[1].textContent).toBe('二月: 80');
    expect(titles[2].textContent).toBe('三月: 45');
  });

  it('tooltipOnHover 关闭时不渲染 <title>', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
      interaction: { tooltipOnHover: false },
    });
    expect(container.querySelectorAll('title')).toHaveLength(0);
  });

  it('未配置 interaction 时默认关闭，不渲染 <title>', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
    });
    expect(container.querySelectorAll('title')).toHaveLength(0);
  });

  it('字段映射后 tooltip 内容使用映射后的维度与数值字段', () => {
    const { container } = renderBarChart({
      dataSource: {
        type: 'static',
        staticData: [
          { city: '北京', sales: 100 },
          { city: '上海', sales: 200 },
        ],
        fieldMapping: { dimension: 'city', value: 'sales' },
      },
      interaction: { tooltipOnHover: true },
    });
    const titles = container.querySelectorAll('title');
    expect(titles).toHaveLength(2);
    expect(titles[0].textContent).toBe('北京: 100');
    expect(titles[1].textContent).toBe('上海: 200');
  });

  it('逻辑层排序与条数限制后 tooltip 与可见柱条一致', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
      logic: { sortField: 'value', sortDirection: 'desc', limit: 1 },
      interaction: { tooltipOnHover: true },
    });
    const titles = container.querySelectorAll('title');
    const rects = container.querySelectorAll('rect');
    expect(titles).toHaveLength(1);
    expect(rects).toHaveLength(1);
    expect(titles[0].textContent).toBe('二月: 80');
  });

  it('空数据时无柱条也无 <title>', () => {
    const { container } = renderBarChart({
      dataSource: { type: 'static', staticData: [] },
      interaction: { tooltipOnHover: true },
    });
    expect(container.querySelectorAll('rect')).toHaveLength(0);
    expect(container.querySelectorAll('title')).toHaveLength(0);
    expect(container.textContent).toContain('暂无数据');
  });
});

describe('BarChartComponent（API 数据源画布渲染，任务 5.5）', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('API 请求成功后渲染解析结果', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { name: 'A', value: 10 },
          { name: 'B', value: 20 },
        ]),
    });

    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    // 初始为加载态
    expect(container.textContent).toContain('加载中');

    // 等待请求完成后渲染柱条
    await screen.findByText('A');
    expect(container.querySelectorAll('rect')).toHaveLength(2);
    expect(container.textContent).toContain('B');
    expect(container.textContent).toContain('20');
  });

  it('API 请求成功后配合数据路径与字段映射渲染', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { list: [{ city: '北京', sales: 100 }] } }),
    });

    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
        dataPath: 'data.list',
        fieldMapping: { dimension: 'city', value: 'sales' },
      },
    });

    await screen.findByText('北京');
    expect(container.querySelectorAll('rect')).toHaveLength(1);
    expect(container.textContent).toContain('100');
  });

  it('非 GET 方法返回结构化"不支持"错误且不发请求', () => {
    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'POST' },
      },
    });

    expect(container.textContent).toContain('仅支持 GET');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('API 请求失败展示错误信息', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    await screen.findByText(/500/);
    expect(container.textContent).toContain('500');
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('API 响应解析失败展示错误信息', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { list: [{ city: '北京', sales: 100 }] } }),
    });

    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
        dataPath: 'nonexistent.path',
      },
    });

    await screen.findByText(/数据解析失败/);
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('API 空数据展示空态而非错误态', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    await screen.findByText('暂无数据');
    expect(container.querySelectorAll('rect')).toHaveLength(0);
    expect(container.textContent).not.toContain('失败');
  });
});

describe('BarChartComponent（三态统一契约，任务 6）', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('静态空数据与 API 空数据展示统一空态文案', async () => {
    // 静态空数据
    const { container: staticContainer } = renderBarChart({
      dataSource: { type: 'static', staticData: [] },
    });
    expect(staticContainer.textContent).toContain('暂无数据');

    // API 空数据
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
    const { container: apiContainer } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });
    await screen.findAllByText('暂无数据');
    expect(apiContainer.textContent).toContain('暂无数据');
  });

  it('错误态展示可读信息，不泄露原始响应全文', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });

    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    await screen.findByText(/502/);
    // 错误信息简短可读，不包含 URL 或响应体
    expect(container.textContent).not.toContain('https://example.com');
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('配置修正后自动恢复渲染（错误 → 成功）', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const { container, rerender } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/bad', method: 'GET' },
      },
    });

    await screen.findByText(/500/);
    expect(container.querySelectorAll('rect')).toHaveLength(0);

    // 修正配置（新 URL 触发新请求）
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ name: 'X', value: 42 }]),
    });

    rerender(
      <BarChartComponent
        props={{}}
        style={{}}
        dataSource={{
          type: 'api',
          apiConfig: { url: 'https://example.com/api/good', method: 'GET' },
        }}
      />,
    );

    await screen.findByText('X');
    expect(container.querySelectorAll('rect')).toHaveLength(1);
    expect(container.textContent).toContain('42');
  });

  it('加载态与错误态使用相同容器尺寸（h-full w-full），不抖动', async () => {
    // 用一个永不 resolve 的 fetch 保持加载态
    let resolveFetch: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    const loadingDiv = container.firstElementChild as HTMLElement;
    expect(loadingDiv.className).toContain('h-full');
    expect(loadingDiv.className).toContain('w-full');

    // 让请求完成并返回错误
    resolveFetch!({ ok: false, status: 503 });
    await screen.findByText(/503/);

    const errorDiv = container.firstElementChild as HTMLElement;
    expect(errorDiv.className).toContain('h-full');
    expect(errorDiv.className).toContain('w-full');
  });

  it('三态互斥：同一时刻只展示一种状态', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ name: 'A', value: 1 }]),
    });

    const { container } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    // 加载态：只有加载文案
    expect(container.textContent).toContain('加载中');
    expect(container.textContent).not.toContain('暂无数据');
    expect(container.querySelectorAll('rect')).toHaveLength(0);

    // 成功态：只有图表
    await screen.findByText('A');
    expect(container.textContent).not.toContain('加载中');
    expect(container.textContent).not.toContain('暂无数据');
    expect(container.querySelectorAll('rect')).toHaveLength(1);
  });
});
