/**
 * BarChartComponent 测试（阶段 2 任务 3.2）
 *
 * 验证点（对应 tasks.md 3.2 验证要求）：
 * - 渲染数据来自数据层解析结果，不再把 props.data 作为优先数据源
 * - 数据为空时展示空态
 * - 解析失败展示错误占位（6.x 统一契约前的简化形态）
 * - 标题与样式渲染不回退
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
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
