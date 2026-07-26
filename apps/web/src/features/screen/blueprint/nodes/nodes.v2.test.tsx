/**
 * V2 蓝图节点组件测试
 *
 * 验证点（对应 tasks.md 4.1-4.6 验证要求）：
 * - ComponentNode：动态派生事件/动作锚点，emerald 配色，dangling 标记
 * - GlobalNode：4 种子类型（pageLoad / navigate / requestApi / scrollTo），虚线边框，配置摘要
 * - DelayNode：amber 配色，in + out 单输出，显示 delayMs
 * - BaseNodeShell V2 扩展：动态锚点布局、虚线边框
 *
 * 测试策略：
 * - mock @xyflow/react 的 Handle 与 Position，避免依赖 ReactFlowProvider/NodeIdContext
 * - mock 组件注册表 getComponentEvents / getComponentActions，验证锚点派生
 * - 专注验证节点外壳的渲染逻辑（标签、图标、配色、状态属性、锚点显隐）
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';

// ===== Mock @xyflow/react =====
// 仅 mock Handle 组件；Position 为枚举常量，工厂中通过 actual 拿到后转发。
// Handle 在 NodeIdContext 外会调用 onError 警告，mock 后避免此依赖。

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    Handle: ({
      type,
      position,
      id,
      style,
    }: {
      type: string;
      position: string;
      id?: string;
      style?: React.CSSProperties;
    }) => (
      <div
        data-testid="rf-handle"
        data-handle-type={type}
        data-handle-position={position}
        data-handle-id={id}
        style={style}
      />
    ),
  };
});

// ===== Mock 组件注册表 =====
// 验证 ComponentNode 从注册表派生锚点的逻辑

vi.mock('../../registry/component-events-actions', () => ({
  getComponentEvents: (type: string) => {
    if (type === 'bar-chart') {
      return [
        { id: 'click', name: '点击' },
        { id: 'hover', name: '悬停' },
        { id: 'dataLoaded', name: '数据加载完成' },
      ];
    }
    return [
      { id: 'click', name: '点击' },
      { id: 'hover', name: '悬停' },
    ];
  },
  getComponentActions: (type: string) => {
    if (type === 'bar-chart') {
      return [
        { id: 'show', name: '显示' },
        { id: 'hide', name: '隐藏' },
        { id: 'toggleVisibility', name: '切换显隐' },
        { id: 'refreshData', name: '刷新数据' },
      ];
    }
    return [
      { id: 'show', name: '显示' },
      { id: 'hide', name: '隐藏' },
      { id: 'toggleVisibility', name: '切换显隐' },
    ];
  },
}));

import { ComponentNode, type ComponentNode as ComponentNodeType } from './component-node';
import { GlobalNode, type GlobalNode as GlobalNodeType } from './global-node';
import { DelayNode, type DelayNode as DelayNodeType } from './delay-node';
import type { ComponentNodeData, DelayNodeData, GlobalNodeData } from './v2-node-data-types';

afterEach(() => {
  vi.clearAllMocks();
});

// ===== NodeProps 工厂 =====

function makeComponentProps(
  id: string,
  data: ComponentNodeData,
  selected: boolean,
): NodeProps<ComponentNodeType> {
  return {
    id,
    type: 'component',
    data,
    selected,
    dragging: false,
    zIndex: 0,
    selectable: true,
    deletable: true,
    draggable: true,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
}

function makeGlobalProps(
  id: string,
  data: GlobalNodeData,
  selected: boolean,
): NodeProps<GlobalNodeType> {
  return {
    id,
    type: 'global',
    data,
    selected,
    dragging: false,
    zIndex: 0,
    selectable: true,
    deletable: true,
    draggable: true,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
}

function makeDelayProps(
  id: string,
  data: DelayNodeData,
  selected: boolean,
): NodeProps<DelayNodeType> {
  return {
    id,
    type: 'delay',
    data,
    selected,
    dragging: false,
    zIndex: 0,
    selectable: true,
    deletable: true,
    draggable: true,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
}

// ===== 构造器 =====

function makeComponentData(overrides?: Partial<ComponentNodeData>): ComponentNodeData {
  return {
    componentId: 'comp-a',
    componentType: 'text',
    label: '组件 A',
    ...overrides,
  };
}

function makeGlobalData(
  globalType: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo',
  overrides?: Partial<GlobalNodeData>,
): GlobalNodeData {
  return {
    componentId: 'global',
    globalType,
    label: `全局 · ${globalType}`,
    ...overrides,
  };
}

function makeDelayData(overrides?: Partial<DelayNodeData>): DelayNodeData {
  return {
    config: { delayMs: 500 },
    label: '延时 500ms',
    ...overrides,
  };
}

// ===== ComponentNode 渲染 =====

describe('ComponentNode 渲染', () => {
  it('渲染组件名与组件类型标签', () => {
    const data = makeComponentData({ componentType: 'bar-chart', label: '柱状图 A' });
    render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    expect(screen.getByText('柱状图 A')).toBeInTheDocument();
    expect(screen.getByText('组件 · bar-chart')).toBeInTheDocument();
  });

  it('componentType 缺省时显示通用 "组件" 标签', () => {
    const data = makeComponentData({ componentType: undefined, label: '未配置组件' });
    render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    expect(screen.getByText('组件')).toBeInTheDocument();
  });

  it('从组件注册表派生事件/动作锚点', () => {
    const data = makeComponentData({ componentType: 'bar-chart' });
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    // bar-chart 派生：3 个事件 + 4 个动作 = 7 个 Handle
    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(7);

    // 验证事件锚点 id
    const sourceIds = Array.from(handles)
      .filter((h) => h.getAttribute('data-handle-type') === 'source')
      .map((h) => h.getAttribute('data-handle-id'));
    expect(sourceIds).toContain('evt:click');
    expect(sourceIds).toContain('evt:hover');
    expect(sourceIds).toContain('evt:dataLoaded');

    // 验证动作锚点 id
    const targetIds = Array.from(handles)
      .filter((h) => h.getAttribute('data-handle-type') === 'target')
      .map((h) => h.getAttribute('data-handle-id'));
    expect(targetIds).toContain('act:show');
    expect(targetIds).toContain('act:hide');
    expect(targetIds).toContain('act:toggleVisibility');
    expect(targetIds).toContain('act:refreshData');
  });

  it('锚点标签在节点正文以行列表显示（与 Handle 对齐）', () => {
    const data = makeComponentData({ componentType: 'text' });
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    // text 组件派生默认事件/动作
    expect(screen.getByText('点击')).toBeInTheDocument();
    expect(screen.getByText('悬停')).toBeInTheDocument();
    expect(screen.getByText('显示')).toBeInTheDocument();
    expect(screen.getByText('隐藏')).toBeInTheDocument();

    // 锚点行容器存在，且每行高度固定为 24px
    const rows = container.querySelectorAll('[data-anchor-row]');
    expect(rows.length).toBe(3); // max(2 events, 3 actions) = 3 行
    expect(rows[0]?.getAttribute('style')).toContain('height: 24px');

    // source 标签带 data-anchor-side="source"
    const sourceLabels = container.querySelectorAll('[data-anchor-side="source"]');
    expect(sourceLabels.length).toBe(2); // 点击 / 悬停

    // target 标签带 data-anchor-side="target"
    const targetLabels = container.querySelectorAll('[data-anchor-side="target"]');
    expect(targetLabels.length).toBe(3); // 显示 / 隐藏 / 切换显隐
  });

  it('使用 emerald 配色', () => {
    const data = makeComponentData();
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    const node = container.querySelector('[data-node-kind]');
    expect(node?.getAttribute('data-node-kind')).toBe('component');
    expect(node?.className).toContain('emerald');
  });

  it('dangling=true 时显示红色边框', () => {
    const data = makeComponentData({ dangling: true });
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-dangling]');
    expect(node?.getAttribute('data-blueprint-node-dangling')).toBe('true');
    expect(node?.className).toContain('border-red-500');
  });

  it('启用动态锚点模式（data-dynamic-anchors=true）', () => {
    const data = makeComponentData();
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    const node = container.querySelector('[data-dynamic-anchors]');
    expect(node?.getAttribute('data-dynamic-anchors')).toBe('true');
  });

  it('普通组件节点不启用虚线边框', () => {
    const data = makeComponentData();
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    // 不存在 data-dashed 属性的元素
    const node = container.querySelector('[data-dashed]');
    expect(node).toBeNull();
  });
});

// ===== GlobalNode 渲染 =====

describe('GlobalNode 渲染', () => {
  it('pageLoad 子类型渲染 "全局 · 页面加载" 标签与 evt:pageLoad 锚点', () => {
    const data = makeGlobalData('pageLoad');
    const { container } = render(<GlobalNode {...makeGlobalProps('g1', data, false)} />);

    expect(screen.getByText('全局 · 页面加载')).toBeInTheDocument();
    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(1);
    expect(handles[0]?.getAttribute('data-handle-type')).toBe('source');
    expect(handles[0]?.getAttribute('data-handle-id')).toBe('evt:pageLoad');
  });

  it('navigate 子类型渲染 act:navigate 锚点与 URL 摘要', () => {
    const data = makeGlobalData('navigate', {
      config: {
        globalType: 'navigate',
        url: 'https://example.com',
        target: '_blank',
      },
    });
    const { container } = render(<GlobalNode {...makeGlobalProps('g2', data, false)} />);

    expect(screen.getByText('全局 · 导航跳转')).toBeInTheDocument();
    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(1);
    expect(handles[0]?.getAttribute('data-handle-type')).toBe('target');
    expect(handles[0]?.getAttribute('data-handle-id')).toBe('act:navigate');

    // 配置摘要
    expect(screen.getByText(/example\.com/)).toBeInTheDocument();
  });

  it('requestApi 子类型渲染 act:requestApi 锚点与 method+URL 摘要', () => {
    const data = makeGlobalData('requestApi', {
      config: {
        globalType: 'requestApi',
        method: 'POST',
        url: 'https://api.example.com/login',
        headers: {},
        body: '',
        secretHeaderKeys: [],
        timeoutMs: 10000,
      },
    });
    const { container } = render(<GlobalNode {...makeGlobalProps('g3', data, false)} />);

    expect(screen.getByText('全局 · 请求接口')).toBeInTheDocument();
    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(1);
    expect(handles[0]?.getAttribute('data-handle-id')).toBe('act:requestApi');

    // 摘要包含 method
    expect(screen.getByText(/POST/)).toBeInTheDocument();
  });

  it('scrollTo 子类型渲染 act:scrollTo 锚点与目标组件摘要', () => {
    const data = makeGlobalData('scrollTo', {
      config: {
        globalType: 'scrollTo',
        targetComponentId: 'comp-target',
      },
    });
    const { container } = render(<GlobalNode {...makeGlobalProps('g4', data, false)} />);

    expect(screen.getByText('全局 · 滚动定位')).toBeInTheDocument();
    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(1);
    expect(handles[0]?.getAttribute('data-handle-id')).toBe('act:scrollTo');

    expect(screen.getByText(/comp-target/)).toBeInTheDocument();
  });

  it('启用虚线边框（data-dashed=true）', () => {
    const data = makeGlobalData('pageLoad');
    const { container } = render(<GlobalNode {...makeGlobalProps('g1', data, false)} />);

    const node = container.querySelector('[data-dashed]');
    expect(node?.getAttribute('data-dashed')).toBe('true');
    expect(node?.className).toContain('border-dashed');
  });

  it('pageLoad 子类型无配置摘要（不渲染 children）', () => {
    const data = makeGlobalData('pageLoad');
    const { container } = render(<GlobalNode {...makeGlobalProps('g1', data, false)} />);

    const summary = container.querySelector('[data-summary]');
    expect(summary).toBeNull();
  });

  it('使用 emerald 配色', () => {
    const data = makeGlobalData('pageLoad');
    const { container } = render(<GlobalNode {...makeGlobalProps('g1', data, false)} />);

    const node = container.querySelector('[data-node-kind]');
    expect(node?.className).toContain('emerald');
  });
});

// ===== DelayNode 渲染 =====

describe('DelayNode 渲染', () => {
  it('渲染延时标签与延时时长', () => {
    const data = makeDelayData({ config: { delayMs: 1000 }, label: '延时 1000ms' });
    render(<DelayNode {...makeDelayProps('d1', data, false)} />);

    expect(screen.getByText('延时 1000ms')).toBeInTheDocument();
    expect(screen.getByText('1000ms')).toBeInTheDocument();
  });

  it('渲染输入与输出引脚（in + out）', () => {
    const data = makeDelayData();
    const { container } = render(<DelayNode {...makeDelayProps('d1', data, false)} />);

    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(2);
    const types = Array.from(handles).map((h) => h.getAttribute('data-handle-type'));
    expect(types).toContain('target');
    expect(types).toContain('source');
  });

  it('使用 amber 配色', () => {
    const data = makeDelayData();
    const { container } = render(<DelayNode {...makeDelayProps('d1', data, false)} />);

    const node = container.querySelector('[data-node-kind]');
    expect(node?.getAttribute('data-node-kind')).toBe('delay');
    expect(node?.className).toContain('amber');
  });

  it('inCycle=true 时显示橙色虚线边框', () => {
    const data = makeDelayData({ inCycle: true });
    const { container } = render(<DelayNode {...makeDelayProps('d1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-cycle]');
    expect(node?.getAttribute('data-blueprint-node-cycle')).toBe('true');
    expect(node?.className).toContain('border-orange-500');
    expect(node?.className).toContain('border-dashed');
  });

  it('不启用动态锚点模式（data-dynamic-anchors 缺省）', () => {
    const data = makeDelayData();
    const { container } = render(<DelayNode {...makeDelayProps('d1', data, false)} />);

    const node = container.querySelector('[data-dynamic-anchors]');
    expect(node).toBeNull();
  });

  it('不启用虚线边框（data-dashed 缺省）', () => {
    const data = makeDelayData();
    const { container } = render(<DelayNode {...makeDelayProps('d1', data, false)} />);

    const node = container.querySelector('[data-dashed]');
    expect(node).toBeNull();
  });
});

// ===== 选中态与边框优先级 =====

describe('V2 节点选中态与边框优先级', () => {
  it('ComponentNode selected=true 时 data-blueprint-node-selected=true', () => {
    const data = makeComponentData();
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.getAttribute('data-blueprint-node-selected')).toBe('true');
  });

  it('GlobalNode selected=true 时显示蓝色边框', () => {
    const data = makeGlobalData('pageLoad');
    const { container } = render(<GlobalNode {...makeGlobalProps('g1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.getAttribute('data-blueprint-node-selected')).toBe('true');
    // 选中态优先于虚线边框
    expect(node?.className).toContain('border-blue-500');
  });

  it('ComponentNode dangling 优先于 selected', () => {
    const data = makeComponentData({ dangling: true });
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.className).toContain('border-red-500');
    expect(node?.className).not.toContain('border-blue-500');
  });

  it('DelayNode inCycle 优先于 selected', () => {
    const data = makeDelayData({ inCycle: true });
    const { container } = render(<DelayNode {...makeDelayProps('d1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.className).toContain('border-orange-500');
    expect(node?.className).not.toContain('border-blue-500');
  });
});

// ===== 动态锚点布局（行对齐） =====

describe('动态锚点布局', () => {
  it('单锚点：Handle top 居中于第 0 行（anchorOffset + 12px）', () => {
    const data = makeGlobalData('pageLoad'); // 仅 1 个 source 锚点
    const { container } = render(<GlobalNode {...makeGlobalProps('g1', data, false)} />);

    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(1);
    // jsdom 中 getBoundingClientRect 全 0 → anchorOffset=0
    // Handle top = 0 + 0 * 24 + 12 = 12px
    expect(handles[0]?.getAttribute('style')).toContain('top: 12px');
  });

  it('多锚点：source 与 target 同行对齐，top 按行索引递增', () => {
    const data = makeComponentData({ componentType: 'bar-chart' });
    const { container } = render(<ComponentNode {...makeComponentProps('c1', data, false)} />);

    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(7); // 3 source + 4 target

    // 3 个 source 锚点：行 0 / 1 / 2 → top = 12 / 36 / 60 px
    const sourceTops = Array.from(handles)
      .filter((h) => h.getAttribute('data-handle-type') === 'source')
      .map((h) => h.getAttribute('style'));
    expect(sourceTops.some((s) => s?.includes('top: 12px'))).toBe(true);
    expect(sourceTops.some((s) => s?.includes('top: 36px'))).toBe(true);
    expect(sourceTops.some((s) => s?.includes('top: 60px'))).toBe(true);

    // 4 个 target 锚点：行 0 / 1 / 2 / 3 → top = 12 / 36 / 60 / 84 px
    const targetTops = Array.from(handles)
      .filter((h) => h.getAttribute('data-handle-type') === 'target')
      .map((h) => h.getAttribute('style'));
    expect(targetTops.some((s) => s?.includes('top: 12px'))).toBe(true);
    expect(targetTops.some((s) => s?.includes('top: 84px'))).toBe(true);

    // source[0] 与 target[0] 在同一行（top 相同 = 12px）
    expect(sourceTops.some((s) => s?.includes('top: 12px'))).toBe(true);
    expect(targetTops.some((s) => s?.includes('top: 12px'))).toBe(true);
  });
});
