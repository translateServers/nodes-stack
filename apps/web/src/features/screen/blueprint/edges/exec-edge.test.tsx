/**
 * 执行流边渲染测试（任务 4.3）
 *
 * 验证点（对应 tasks.md 4.3 验证要求）：
 * - ExecEdge 默认态渲染统一样式（slate-400 描边）
 * - 选中态显示蓝色描边与中点标签
 * - 模拟调试态（M2 data.animated=true）显示流动虚线
 *
 * 测试策略：
 * - mock @xyflow/react 的 BaseEdge / getBezierPath / EdgeLabelRenderer，
 *   避免 ReactFlowProvider/StoreContext 依赖
 */

import type { CSSProperties, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { EdgeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';

// ===== Mock @xyflow/react =====
// 仅 mock BaseEdge / EdgeLabelRenderer / getBezierPath，
// 避免 BaseEdge 内部依赖 useStoreApi 与 react-d3，

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    BaseEdge: ({
      id,
      path,
      className,
      style,
      markerEnd,
    }: {
      id?: string;
      path: string;
      className?: string;
      style?: CSSProperties;
      markerEnd?: string;
    }) => (
      <path
        data-testid="rf-base-edge"
        data-edge-id={id}
        d={path}
        className={className}
        style={style}
        markerEnd={markerEnd}
      />
    ),
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => (
      <div data-testid="rf-edge-label-renderer">{children}</div>
    ),
    getBezierPath: () => ['M 0 0 C 50 0, 50 100, 100 100', 50, 50],
  };
});

import { ExecEdge } from './exec-edge';
import type { ExecEdge as ExecEdgeType } from './exec-edge';

afterEach(() => {
  vi.clearAllMocks();
});

// ===== EdgeProps 工厂 =====

function makeEdgeProps(overrides?: Partial<EdgeProps<ExecEdgeType>>): EdgeProps<ExecEdgeType> {
  return {
    id: 'e1',
    type: 'exec',
    source: 't1',
    target: 'a1',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selected: false,
    animated: false,
    selectable: true,
    deletable: true,
    data: {},
    ...overrides,
  };
}

// ===== ExecEdge 渲染 =====

describe('ExecEdge 渲染', () => {
  it('默认态渲染 slate-400 描边、strokeWidth 1.5', () => {
    const props = makeEdgeProps();
    const { container } = render(<ExecEdge {...props} />);

    const edge = container.querySelector('[data-testid="rf-base-edge"]');
    expect(edge).not.toBeNull();
    expect(edge?.getAttribute('class')).toContain('stroke-slate-400');
    expect(edge?.getAttribute('style')).toContain('stroke-width: 1.5');
  });

  it('默认态不渲染中点标签', () => {
    const props = makeEdgeProps({ selected: false });
    const { container } = render(<ExecEdge {...props} />);

    const label = container.querySelector('[data-testid="exec-edge-label"]');
    expect(label).toBeNull();
  });
});

// ===== 选中态样式 =====

describe('ExecEdge 选中态样式', () => {
  it('选中态渲染 blue-500 描边、strokeWidth 2.5', () => {
    const props = makeEdgeProps({ selected: true });
    const { container } = render(<ExecEdge {...props} />);

    const edge = container.querySelector('[data-testid="rf-base-edge"]');
    expect(edge?.getAttribute('class')).toContain('stroke-blue-500');
    expect(edge?.getAttribute('style')).toContain('stroke-width: 2.5');
  });

  it('选中态显示中点标签（exec 文本）', () => {
    const props = makeEdgeProps({ selected: true });
    const { container } = render(<ExecEdge {...props} />);

    const label = container.querySelector('[data-testid="exec-edge-label"]');
    expect(label).not.toBeNull();
    expect(label?.textContent).toContain('exec');
    expect(label?.getAttribute('data-edge-id')).toBe('e1');
  });
});

// ===== 模拟调试态（M2）=====

describe('ExecEdge 模拟调试态（data.animated）', () => {
  it('data.animated=true 时启用 strokeDasharray 流动虚线', () => {
    const props = makeEdgeProps({ data: { animated: true } });
    const { container } = render(<ExecEdge {...props} />);

    const edge = container.querySelector('[data-testid="rf-base-edge"]');
    expect(edge?.getAttribute('style')).toContain('stroke-dasharray: 5 5');
  });

  it('data.animated=false 时不启用 strokeDasharray', () => {
    const props = makeEdgeProps({ data: { animated: false } });
    const { container } = render(<ExecEdge {...props} />);

    const edge = container.querySelector('[data-testid="rf-base-edge"]');
    expect(edge?.getAttribute('style') ?? '').not.toContain('stroke-dasharray');
  });

  it('data 为空时不启用 strokeDasharray', () => {
    const props = makeEdgeProps({ data: {} });
    const { container } = render(<ExecEdge {...props} />);

    const edge = container.querySelector('[data-testid="rf-base-edge"]');
    expect(edge?.getAttribute('style') ?? '').not.toContain('stroke-dasharray');
  });
});

// ===== 边 id 与 markerEnd 透传 =====

describe('边 id 与 markerEnd 透传', () => {
  it('id 透传到 BaseEdge', () => {
    const props = makeEdgeProps({ id: 'e-custom' });
    const { container } = render(<ExecEdge {...props} />);

    const edge = container.querySelector('[data-testid="rf-base-edge"]');
    expect(edge?.getAttribute('data-edge-id')).toBe('e-custom');
  });

  it('markerEnd 透传到 BaseEdge', () => {
    const props = makeEdgeProps({ markerEnd: 'url(#arrow)' });
    const { container } = render(<ExecEdge {...props} />);

    const edge = container.querySelector('[data-testid="rf-base-edge"]');
    expect(edge?.getAttribute('marker-end')).toBe('url(#arrow)');
  });
});
