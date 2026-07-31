import { act, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import type {
  ComponentStyle,
  DataSourceConfig,
  InteractionConfig,
  LogicConfig,
} from '@nebula/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarChartComponent } from './bar-chart-component';
import { setTestDatasetState } from '../../../test/fetch-runtime-profile';

type DatasetStateMock =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown }
  | {
      status: 'error';
      error: { reason: 'http' | 'network' | 'parse' | 'timeout'; message: string };
    };

interface CapturedGradient {
  colorStops?: Array<{ offset: number; color: string }>;
}

interface CapturedSeries {
  type?: string;
  name?: string;
  data?: number[];
  silent?: boolean;
  itemStyle?: { color?: CapturedGradient };
  label?: { color?: string; formatter?: string; show?: boolean };
  animationDelay?: (dataIndex: number) => number;
}

interface CapturedBarOption {
  animation?: boolean;
  title?: { text?: string; textStyle?: { color?: string } };
  tooltip?: { show?: boolean; trigger?: string; formatter?: string };
  xAxis?: { data?: string[] };
  yAxis?: { splitNumber?: number; splitLine?: { lineStyle?: { type?: string } } };
  series?: CapturedSeries[];
}

const {
  echartsMocks,
  mockDatasetStateRef,
  mockEmitEventRef,
  mockNativeEventsRef,
  resizeObserverMocks,
} = vi.hoisted(() => {
  const setOption = vi.fn<(option: unknown, settings?: unknown) => void>();
  const resize = vi.fn<() => void>();
  const dispose = vi.fn<() => void>();
  const chart = { setOption, resize, dispose };
  const datasetStateRef: { current: DatasetStateMock } = { current: { status: 'idle' } };
  const emitEventRef: {
    current: ((componentId: string, eventId: string, payload?: unknown) => void) | null;
  } = { current: null };

  return {
    echartsMocks: {
      chart,
      setOption,
      resize,
      dispose,
      init: vi.fn<(element: unknown, theme?: unknown, settings?: unknown) => typeof chart>(
        () => chart,
      ),
      use: vi.fn<(modules: unknown[]) => void>(),
      modifyAlpha: vi.fn((color: string, alpha: number) => `${color}@${alpha}`),
    },
    mockDatasetStateRef: datasetStateRef,
    mockEmitEventRef: emitEventRef,
    mockNativeEventsRef: { current: true },
    resizeObserverMocks: {
      callback: null as (() => void) | null,
      observe: vi.fn<(target: Element) => void>(),
      disconnect: vi.fn<() => void>(),
    },
  };
});

vi.mock('echarts/core', () => ({
  color: { modifyAlpha: echartsMocks.modifyAlpha },
  init: echartsMocks.init,
  use: echartsMocks.use,
}));

vi.mock('echarts/charts', () => ({ BarChart: { type: 'bar' } }));

vi.mock('echarts/components', () => ({
  GridComponent: { type: 'grid' },
  TitleComponent: { type: 'title' },
  TooltipComponent: { type: 'tooltip' },
}));

vi.mock('echarts/renderers', () => ({ CanvasRenderer: { type: 'canvas' } }));

vi.mock('../../blueprint/runtime/component-event-context', () => ({
  useComponentEvent: () => mockEmitEventRef.current,
}));

vi.mock('../../lib/canvas-interaction-context', () => ({
  useCanvasInteraction: () => ({
    mode: mockNativeEventsRef.current ? 'interactive' : 'design',
    canEditCanvas: !mockNativeEventsRef.current,
    canDispatchNativeEvents: mockNativeEventsRef.current,
    canDispatchBlueprintEvents: mockNativeEventsRef.current,
  }),
}));

const SAMPLE_DATA = [
  { name: '一月', value: 30 },
  { name: '二月', value: 80 },
  { name: '三月', value: 45 },
];

const TEST_COMPONENT_ID = 'test-bar-chart-component';

function getLatestOption(): CapturedBarOption {
  const call = echartsMocks.setOption.mock.calls.at(-1);
  if (call === undefined) throw new Error('ECharts setOption was not called');
  return call[0] as CapturedBarOption;
}

function expectChartData(names: string[], values: number[]): void {
  const option = getLatestOption();
  expect(option.xAxis?.data).toEqual(names);
  expect(option.series?.[0]?.data).toEqual(values);
}

async function waitForChartData(names: string[], values: number[]): Promise<void> {
  await waitFor(() => expectChartData(names, values));
}

function renderBarChart(overrides: {
  props?: Record<string, unknown>;
  style?: ComponentStyle;
  dataSource?: DataSourceConfig;
  logic?: LogicConfig;
  interaction?: InteractionConfig;
  componentId?: string;
  apiRawDataOverride?: unknown;
}): RenderResult {
  return render(
    <BarChartComponent
      componentId={overrides.componentId ?? TEST_COMPONENT_ID}
      props={overrides.props ?? {}}
      style={overrides.style ?? {}}
      dataSource={overrides.dataSource}
      logic={overrides.logic}
      interaction={overrides.interaction}
      apiRawDataOverride={overrides.apiRawDataOverride}
    />,
  );
}

beforeEach(() => {
  echartsMocks.init.mockClear();
  echartsMocks.setOption.mockClear();
  echartsMocks.resize.mockClear();
  echartsMocks.dispose.mockClear();
  echartsMocks.modifyAlpha.mockClear();
  mockDatasetStateRef.current = { status: 'idle' };
  setTestDatasetState(mockDatasetStateRef.current);
  mockEmitEventRef.current = null;
  mockNativeEventsRef.current = true;
  resizeObserverMocks.callback = null;
  resizeObserverMocks.observe.mockClear();
  resizeObserverMocks.disconnect.mockClear();

  class ResizeObserverMock {
    constructor(callback: ResizeObserverCallback) {
      resizeObserverMocks.callback = () => callback([], this);
    }

    observe(target: Element): void {
      resizeObserverMocks.observe(target);
    }

    unobserve(): void {}

    disconnect(): void {
      resizeObserverMocks.disconnect();
    }
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BarChartComponent ECharts 渲染', () => {
  it('按需初始化 CanvasRenderer 并写入静态数据 option', () => {
    renderBarChart({ dataSource: { type: 'static', staticData: SAMPLE_DATA } });

    const chartElement = screen.getByRole('img', { name: '柱状图，共 3 项数据' });
    expect(echartsMocks.init).toHaveBeenCalledWith(chartElement, undefined, {
      renderer: 'canvas',
    });
    expect(echartsMocks.setOption).toHaveBeenCalledWith(expect.any(Object), {
      notMerge: true,
      lazyUpdate: true,
    });
    expectChartData(['一月', '二月', '三月'], [30, 80, 45]);
    expect(getLatestOption().series?.[0]?.type).toBe('bar');
  });

  it('无数据层配置时回退遗留 props.data', () => {
    renderBarChart({ props: { data: SAMPLE_DATA } });
    expectChartData(['一月', '二月', '三月'], [30, 80, 45]);
  });

  it('数据层与 props.data 同时存在时仅使用数据层', () => {
    renderBarChart({
      props: { data: SAMPLE_DATA },
      dataSource: { type: 'static', staticData: [{ name: '来自数据层', value: 66 }] },
    });
    expectChartData(['来自数据层'], [66]);
  });

  it('非法数据与空数组分别展示错误态和空态，不初始化 ECharts', () => {
    const { rerender } = renderBarChart({
      dataSource: { type: 'static', staticData: 'not-an-array' },
    });
    expect(screen.getByText(/数据解析失败/)).toBeInTheDocument();
    expect(echartsMocks.init).not.toHaveBeenCalled();

    rerender(
      <BarChartComponent
        componentId={TEST_COMPONENT_ID}
        props={{}}
        style={{}}
        dataSource={{ type: 'static', staticData: [] }}
      />,
    );
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
    expect(echartsMocks.init).not.toHaveBeenCalled();
  });

  it('应用字段映射、排序和条数限制', () => {
    renderBarChart({
      dataSource: {
        type: 'static',
        staticData: [
          { city: '北京', sales: 100 },
          { city: '上海', sales: 200 },
        ],
        fieldMapping: { dimension: 'city', value: 'sales' },
      },
      logic: { sortField: 'value', sortDirection: 'desc', limit: 1 },
    });
    expectChartData(['上海'], [200]);
  });

  it('标题、文本色和柱条渐变继承视觉层配置', () => {
    renderBarChart({
      props: { title: '月度销售' },
      style: { backgroundColor: '#ff0000', color: '#00ff00' },
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
    });

    const option = getLatestOption();
    const gradient = option.series?.[0]?.itemStyle?.color;
    expect(option.title?.text).toBe('月度销售');
    expect(option.title?.textStyle?.color).toBe('#00ff00');
    expect(option.series?.[0]?.label?.color).toBe('#00ff00');
    expect(gradient?.colorStops).toEqual([
      { offset: 0, color: '#ff0000' },
      { offset: 0.58, color: '#ff0000@0.82' },
      { offset: 1, color: '#ff0000@0.42' },
    ]);
    expect(screen.getByRole('img')).toHaveAccessibleName('月度销售，共 3 项数据');
  });

  it('保留四段网格和交错柱条动画', () => {
    renderBarChart({ dataSource: { type: 'static', staticData: SAMPLE_DATA } });
    const option = getLatestOption();
    const animationDelay = option.series?.[0]?.animationDelay;

    expect(option.yAxis?.splitNumber).toBe(4);
    expect(option.yAxis?.splitLine?.lineStyle?.type).toBe('dashed');
    expect(animationDelay?.(0)).toBe(100);
    expect(animationDelay?.(1)).toBe(180);
    expect(animationDelay?.(2)).toBe(260);
  });

  it('随容器尺寸变化 resize，并在卸载时断开观察和销毁实例', () => {
    const { unmount } = renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
    });

    expect(resizeObserverMocks.observe).toHaveBeenCalledWith(screen.getByRole('img'));
    act(() => resizeObserverMocks.callback?.());
    expect(echartsMocks.resize).toHaveBeenCalledOnce();

    unmount();
    expect(resizeObserverMocks.disconnect).toHaveBeenCalledOnce();
    expect(echartsMocks.dispose).toHaveBeenCalledOnce();
  });
});

describe('BarChartComponent 交互层', () => {
  it('开启悬停提示时启用 ECharts item tooltip', () => {
    renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
      interaction: { tooltipOnHover: true },
    });

    expect(getLatestOption().tooltip).toEqual(
      expect.objectContaining({ show: true, trigger: 'item', formatter: '{b}: {c}' }),
    );
    expect(getLatestOption().series?.[0]?.silent).toBe(false);
  });

  it('未开启悬停提示时关闭 tooltip', () => {
    renderBarChart({ dataSource: { type: 'static', staticData: SAMPLE_DATA } });
    expect(getLatestOption().tooltip?.show).toBe(false);
  });

  it('设计模式禁用原生交互，即使配置开启也不响应 tooltip', () => {
    mockNativeEventsRef.current = false;
    renderBarChart({
      dataSource: { type: 'static', staticData: SAMPLE_DATA },
      interaction: { tooltipOnHover: true },
    });

    expect(getLatestOption().tooltip?.show).toBe(false);
    expect(getLatestOption().series?.[0]?.silent).toBe(true);
    expect(screen.getByRole('img')).toHaveStyle({ pointerEvents: 'none' });
  });
});

describe('BarChartComponent API 数据源', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('请求成功后将响应解析为 ECharts option', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { name: 'A', value: 10 },
          { name: 'B', value: 20 },
        ]),
    });

    renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    expect(screen.getByText(/加载中/)).toBeInTheDocument();
    await waitForChartData(['A', 'B'], [10, 20]);
    expect(screen.queryByText(/加载中/)).not.toBeInTheDocument();
  });

  it('支持 API 数据路径与字段映射', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { list: [{ city: '北京', sales: 100 }] } }),
    });

    renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
        dataPath: 'data.list',
        fieldMapping: { dimension: 'city', value: 'sales' },
      },
    });

    await waitForChartData(['北京'], [100]);
  });

  it('请求失败和响应解析失败展示可读错误，不初始化图表', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const { unmount } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    expect(await screen.findByText(/500/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    unmount();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { list: [] } }),
    });
    renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart-2', method: 'GET' },
        dataPath: 'missing.path',
      },
    });

    expect(await screen.findByText(/数据解析失败/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('API 空数组展示与静态数据一致的空态', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
    renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    expect(await screen.findByText('暂无数据')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('配置从错误修正为成功后自动恢复图表', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const { rerender } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/bad', method: 'GET' },
      },
    });
    expect(await screen.findByText(/500/)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ name: 'X', value: 42 }]),
    });
    rerender(
      <BarChartComponent
        componentId={TEST_COMPONENT_ID}
        props={{}}
        style={{}}
        dataSource={{
          type: 'api',
          apiConfig: { url: 'https://example.com/api/good', method: 'GET' },
        }}
      />,
    );

    await waitForChartData(['X'], [42]);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('加载态和错误态保持全尺寸容器', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
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

    expect(container.firstElementChild).toHaveClass('h-full', 'w-full');
    act(() => resolveFetch({ ok: false, status: 503 }));
    expect(await screen.findByText(/503/)).toHaveClass('h-full', 'w-full');
  });
});

describe('BarChartComponent 数据源事件派发', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('API 数据源成功和失败时分别派发 dataLoaded 与 dataError', async () => {
    const emitSpy = vi.fn();
    mockEmitEventRef.current = emitSpy;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_DATA),
    });
    const { unmount } = renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/success', method: 'GET' },
      },
    });

    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith(TEST_COMPONENT_ID, 'dataLoaded'));
    unmount();

    emitSpy.mockClear();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/error', method: 'GET' },
      },
    });
    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith(TEST_COMPONENT_ID, 'dataError'));
  });

  it('数据集数据源成功和失败时分别派发对应事件', () => {
    const emitSpy = vi.fn();
    mockEmitEventRef.current = emitSpy;
    mockDatasetStateRef.current = { status: 'success', data: SAMPLE_DATA };
    setTestDatasetState(mockDatasetStateRef.current);
    const { unmount } = renderBarChart({
      dataSource: { type: 'dataset', datasetId: 'test-dataset' },
    });
    expect(emitSpy).toHaveBeenCalledWith(TEST_COMPONENT_ID, 'dataLoaded');
    unmount();

    emitSpy.mockClear();
    mockDatasetStateRef.current = {
      status: 'error',
      error: { reason: 'http', message: '数据集执行失败' },
    };
    setTestDatasetState(mockDatasetStateRef.current);
    renderBarChart({ dataSource: { type: 'dataset', datasetId: 'test-dataset' } });
    expect(emitSpy).toHaveBeenCalledWith(TEST_COMPONENT_ID, 'dataError');
  });

  it('无运行时 Provider 时不派发数据事件', async () => {
    const emitSpy = vi.fn();
    mockEmitEventRef.current = null;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_DATA),
    });
    renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
    });

    await waitForChartData(['一月', '二月', '三月'], [30, 80, 45]);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('apiRawDataOverride 存在时不重复派发 hook 状态事件', async () => {
    const emitSpy = vi.fn();
    mockEmitEventRef.current = emitSpy;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_DATA),
    });
    renderBarChart({
      dataSource: {
        type: 'api',
        apiConfig: { url: 'https://example.com/api/chart', method: 'GET' },
      },
      apiRawDataOverride: SAMPLE_DATA,
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await act(async () => {
      await Promise.resolve();
    });
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
