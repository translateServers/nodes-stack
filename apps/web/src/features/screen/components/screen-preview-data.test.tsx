import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * 阶段 2 任务 3.4：公开预览接入同一数据解析路径。
 *
 * 与 screen-preview.test.tsx 的关键差异：本文件不 mock ComponentRenderer，
 * 预览走真实渲染链路（PreviewCanvas → ComponentRenderer → BarChartComponent
 * → useChartData → parseChartData），与编辑器画布（screen-canvas.tsx）完全同源，
 * 用于断言：
 * - 数据层静态数据在预览真实可见（渲染内容来自解析结果，而非默认示例）
 * - 编辑器渲染路径与预览渲染结果一致（同一 ComponentRenderer）
 * - 旧项目（仅 props.data、无数据层配置）预览不回退
 * - 逻辑层（排序/条数限制）与交互层（悬停提示）配置在预览透传生效
 */
vi.mock('@tanstack/react-router', () => ({
  useParams: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useScreenPreview: vi.fn(),
}));

import { useParams } from '@tanstack/react-router';
import { useScreenPreview } from '../hooks';
import { ComponentRenderer } from '../registry/renderer';
import { ScreenPreview } from './screen-preview';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';

const mockUseParams = useParams as unknown as ReturnType<typeof vi.fn>;
const mockUseScreenPreview = useScreenPreview as unknown as ReturnType<typeof vi.fn>;

const STATIC_ROWS = [
  { category: '苹果', sales: 120 },
  { category: '香蕉', sales: 80 },
  { category: '橙子', sales: 200 },
];

function makeBarChart(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
  return {
    id: 'chart-1',
    type: 'bar-chart',
    name: '销售柱状图',
    position: { x: 0, y: 0, width: 400, height: 300 },
    style: {},
    props: {},
    status: { locked: false, hidden: false },
    zIndex: 0,
    ...overrides,
  };
}

function makeProject(components: ScreenComponent[]): ScreenProject {
  return {
    id: 'proj-1',
    name: '预览项目',
    canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
    components,
    status: 'published',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function setProject(project: ScreenProject): void {
  mockUseParams.mockReturnValue({ id: project.id });
  mockUseScreenPreview.mockReturnValue({ data: project, isLoading: false });
}

/** 收集容器内全部 SVG text 节点的文本内容（柱条名称与数值标签） */
function collectSvgTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('svg text')).map((node) => node.textContent ?? '');
}

describe('ScreenPreview 数据解析链路（任务 3.4）', () => {
  beforeEach(() => {
    mockUseParams.mockReset();
    mockUseScreenPreview.mockReset();
  });

  it('数据层静态数据在预览真实渲染（名称与数值来自解析结果）', () => {
    const chart = makeBarChart({
      dataSource: {
        type: 'static',
        staticData: STATIC_ROWS,
        fieldMapping: { dimension: 'category', value: 'sales' },
      },
    });
    setProject(makeProject([chart]));

    const { container } = render(<ScreenPreview />);

    const texts = collectSvgTexts(container);
    for (const row of STATIC_ROWS) {
      expect(texts).toContain(row.category);
      expect(texts).toContain(String(row.sales));
    }
    // 渲染柱条数量与解析结果一致
    expect(container.querySelectorAll('svg rect')).toHaveLength(STATIC_ROWS.length);
  });

  it('预览渲染结果与编辑器渲染路径（同一 ComponentRenderer）一致', () => {
    const chart = makeBarChart({
      dataSource: {
        type: 'static',
        staticData: STATIC_ROWS,
        fieldMapping: { dimension: 'category', value: 'sales' },
      },
    });
    setProject(makeProject([chart]));

    // 编辑器画布路径：screen-canvas.tsx 直接渲染 <ComponentRenderer component={...} />
    const editorRender = render(<ComponentRenderer component={chart} />);
    const editorTexts = collectSvgTexts(editorRender.container);
    editorRender.unmount();

    const previewRender = render(<ScreenPreview />);
    const previewTexts = collectSvgTexts(previewRender.container);

    expect(previewTexts).toEqual(editorTexts);
  });

  it('旧项目预览不回退：仅 props.data 的组件仍渲染遗留数据', () => {
    const legacyRows = [
      { name: '一月', value: 10 },
      { name: '二月', value: 30 },
    ];
    const chart = makeBarChart({ props: { data: legacyRows } });
    setProject(makeProject([chart]));

    const { container } = render(<ScreenPreview />);

    const texts = collectSvgTexts(container);
    for (const row of legacyRows) {
      expect(texts).toContain(row.name);
      expect(texts).toContain(String(row.value));
    }
    expect(container.querySelectorAll('svg rect')).toHaveLength(legacyRows.length);
  });

  it('逻辑层配置在预览透传生效（按数值降序 + 条数限制 2）', () => {
    const chart = makeBarChart({
      dataSource: {
        type: 'static',
        staticData: STATIC_ROWS,
        fieldMapping: { dimension: 'category', value: 'sales' },
      },
      logic: { sortField: 'value', sortDirection: 'desc', limit: 2 },
    });
    setProject(makeProject([chart]));

    const { container } = render(<ScreenPreview />);

    // 数值降序前两条：橙子 200、苹果 120；香蕉 80 被截断
    expect(container.querySelectorAll('svg rect')).toHaveLength(2);
    const texts = collectSvgTexts(container);
    expect(texts).toContain('橙子');
    expect(texts).toContain('苹果');
    expect(texts).not.toContain('香蕉');
    // 排序生效：橙子的名称标签先于苹果出现
    expect(texts.indexOf('橙子')).toBeLessThan(texts.indexOf('苹果'));
  });

  it('交互层悬停提示开启时预览渲染 <title>，默认关闭时不渲染', () => {
    const base = {
      type: 'static' as const,
      staticData: STATIC_ROWS,
      fieldMapping: { dimension: 'category', value: 'sales' },
    };

    // 开启悬停提示
    const withTooltip = makeBarChart({
      dataSource: base,
      interaction: { tooltipOnHover: true },
    });
    setProject(makeProject([withTooltip]));
    const enabled = render(<ScreenPreview />);
    const titles = Array.from(enabled.container.querySelectorAll('svg title')).map(
      (node) => node.textContent,
    );
    expect(titles).toContain('苹果: 120');
    expect(titles).toHaveLength(STATIC_ROWS.length);
    enabled.unmount();

    // 默认关闭
    const withoutTooltip = makeBarChart({ dataSource: base });
    setProject(makeProject([withoutTooltip]));
    const disabled = render(<ScreenPreview />);
    expect(disabled.container.querySelectorAll('svg title')).toHaveLength(0);
  });

  it('空静态数据在预览展示统一空态而非错误', () => {
    const chart = makeBarChart({ dataSource: { type: 'static', staticData: [] } });
    setProject(makeProject([chart]));

    render(<ScreenPreview />);

    expect(screen.getByText('暂无数据')).toBeDefined();
    expect(screen.queryByText(/数据解析失败/)).toBeNull();
  });
});
