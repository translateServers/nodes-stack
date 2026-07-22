/**
 * 蓝图节点组件测试（任务 4.2）
 *
 * 验证点（对应 tasks.md 4.2 验证要求）：
 * - 组件测试覆盖渲染：trigger/action/comment 三类节点渲染组件名与类型图标
 * - 选中态样式：data-blueprint-node-selected 属性反映 selected
 * - dangling 标记态：data-blueprint-node-dangling 属性反映 dangling
 * - cycle 标记态：data-blueprint-node-cycle 属性反映 inCycle
 * - 引脚显示/隐藏：trigger 无输入引脚、comment 无引脚、action 有输入+输出
 *
 * 测试策略：
 * - mock @xyflow/react 的 Handle 与 Position，避免依赖 ReactFlowProvider/NodeIdContext
 * - 专注验证节点外壳的渲染逻辑（标签、图标、配色、状态属性、引脚显隐）
 * - lucide-react 图标保留真实实现，通过 className 验证图标选择
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import type {
  BlueprintActionConfig,
  BlueprintTriggerConfig,
  CommentNodeConfig,
} from '@nebula/shared';

// ===== Mock @xyflow/react =====
// 仅 mock Handle 组件；Position 为枚举常量，工厂中通过 actual 拿到后转发。
// Handle 在 NodeIdContext 外会调用 onError 警告，mock 后避免此依赖。

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    Handle: ({ type, position }: { type: string; position: string }) => (
      <div data-testid="rf-handle" data-handle-type={type} data-handle-position={position} />
    ),
  };
});

import { ActionNode } from './action-node';
import { CommentNode } from './comment-node';
import { TriggerNode } from './trigger-node';
import type { ActionNodeData } from './node-data-types';
import type { CommentNodeData } from './node-data-types';
import type { TriggerNodeData } from './node-data-types';

afterEach(() => {
  vi.clearAllMocks();
});

// ===== NodeProps 工厂 =====
// NodeProps 中 Required<Pick<...>> 字段在测试中需要补齐（实际运行时由 React Flow 注入）。

function makeTriggerProps(
  id: string,
  data: TriggerNodeData,
  selected: boolean,
): NodeProps<TriggerNode> {
  return {
    id,
    type: 'trigger',
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

function makeActionProps(
  id: string,
  data: ActionNodeData,
  selected: boolean,
): NodeProps<ActionNode> {
  return {
    id,
    type: 'action',
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

function makeCommentProps(
  id: string,
  data: CommentNodeData,
  selected: boolean,
): NodeProps<CommentNode> {
  return {
    id,
    type: 'comment',
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

function makeTriggerData(
  config: BlueprintTriggerConfig,
  overrides?: Partial<TriggerNodeData>,
): TriggerNodeData {
  return {
    config,
    label: '触发器节点',
    ...overrides,
  };
}

function makeActionData(
  config: BlueprintActionConfig,
  overrides?: Partial<ActionNodeData>,
): ActionNodeData {
  return {
    config,
    label: '动作节点',
    ...overrides,
  };
}

function makeCommentData(
  config: CommentNodeConfig,
  overrides?: Partial<CommentNodeData>,
): CommentNodeData {
  return {
    config,
    label: config.text,
    ...overrides,
  };
}

// ===== TriggerNode 渲染 =====

describe('TriggerNode 渲染', () => {
  it('componentClick 类型渲染 "点击触发" 标签', () => {
    const data = makeTriggerData({ type: 'componentClick', componentId: 'comp-a' });
    render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    expect(screen.getByText('点击触发')).toBeInTheDocument();
    expect(screen.getByText('触发器节点')).toBeInTheDocument();
  });

  it('pageLoad 类型渲染 "页面加载" 标签', () => {
    const data = makeTriggerData({ type: 'pageLoad' });
    render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    expect(screen.getByText('页面加载')).toBeInTheDocument();
  });

  it('仅渲染输出引脚（无输入引脚）', () => {
    const data = makeTriggerData({ type: 'pageLoad' });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(1);
    expect(handles[0]?.getAttribute('data-handle-type')).toBe('source');
  });
});

// ===== ActionNode 渲染 =====

describe('ActionNode 渲染', () => {
  it('setVisibility 类型渲染 "设置可见性" 标签', () => {
    const data = makeActionData({
      type: 'setVisibility',
      targetComponentId: 'comp-a',
      visible: 'hide',
    });
    render(<ActionNode {...makeActionProps('a1', data, false)} />);

    expect(screen.getByText('设置可见性')).toBeInTheDocument();
  });

  it('navigate 类型渲染 "导航跳转" 标签', () => {
    const data = makeActionData({
      type: 'navigate',
      url: 'https://example.com',
      target: '_self',
    });
    render(<ActionNode {...makeActionProps('a1', data, false)} />);

    expect(screen.getByText('导航跳转')).toBeInTheDocument();
  });

  it('scrollToComponent 类型渲染 "滚动定位" 标签', () => {
    const data = makeActionData({
      type: 'scrollToComponent',
      targetComponentId: 'comp-a',
    });
    render(<ActionNode {...makeActionProps('a1', data, false)} />);

    expect(screen.getByText('滚动定位')).toBeInTheDocument();
  });

  it('refreshDataSource 类型渲染 "刷新数据源" 标签', () => {
    const data = makeActionData({
      type: 'refreshDataSource',
      targetComponentId: 'comp-a',
    });
    render(<ActionNode {...makeActionProps('a1', data, false)} />);

    expect(screen.getByText('刷新数据源')).toBeInTheDocument();
  });

  it('渲染输入与输出引脚（链式触发）', () => {
    const data = makeActionData({
      type: 'setVisibility',
      targetComponentId: 'comp-a',
      visible: 'hide',
    });
    const { container } = render(<ActionNode {...makeActionProps('a1', data, false)} />);

    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(2);
    const types = Array.from(handles).map((h) => h.getAttribute('data-handle-type'));
    expect(types).toContain('target');
    expect(types).toContain('source');
  });
});

// ===== CommentNode 渲染 =====

describe('CommentNode 渲染', () => {
  it('渲染注释文本', () => {
    const data = makeCommentData({ text: '此分支处理用户登出流程' });
    render(<CommentNode {...makeCommentProps('c1', data, false)} />);

    expect(screen.getByText('此分支处理用户登出流程')).toBeInTheDocument();
    expect(screen.getByText('注释')).toBeInTheDocument();
  });

  it('不渲染任何引脚', () => {
    const data = makeCommentData({ text: '注释' });
    const { container } = render(<CommentNode {...makeCommentProps('c1', data, false)} />);

    const handles = container.querySelectorAll('[data-testid="rf-handle"]');
    expect(handles).toHaveLength(0);
  });
});

// ===== 选中态样式 =====

describe('节点选中态样式', () => {
  it('TriggerNode selected=true 时 data-blueprint-node-selected=true', () => {
    const data = makeTriggerData({ type: 'pageLoad' });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.getAttribute('data-blueprint-node-selected')).toBe('true');
  });

  it('TriggerNode selected=false 时 data-blueprint-node-selected=false', () => {
    const data = makeTriggerData({ type: 'pageLoad' });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.getAttribute('data-blueprint-node-selected')).toBe('false');
  });

  it('ActionNode selected=true 时 data-blueprint-node-selected=true', () => {
    const data = makeActionData({
      type: 'setVisibility',
      targetComponentId: 'comp-a',
      visible: 'hide',
    });
    const { container } = render(<ActionNode {...makeActionProps('a1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.getAttribute('data-blueprint-node-selected')).toBe('true');
  });

  it('CommentNode selected=true 时 data-blueprint-node-selected=true', () => {
    const data = makeCommentData({ text: '注释' });
    const { container } = render(<CommentNode {...makeCommentProps('c1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.getAttribute('data-blueprint-node-selected')).toBe('true');
  });
});

// ===== dangling 标记态样式 =====

describe('节点 dangling 标记态样式', () => {
  it('TriggerNode dangling=true 时 data-blueprint-node-dangling=true', () => {
    const data = makeTriggerData(
      { type: 'componentClick', componentId: 'missing' },
      { dangling: true },
    );
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-dangling]');
    expect(node?.getAttribute('data-blueprint-node-dangling')).toBe('true');
  });

  it('ActionNode dangling=true 时 data-blueprint-node-dangling=true', () => {
    const data = makeActionData(
      { type: 'setVisibility', targetComponentId: 'missing', visible: 'hide' },
      { dangling: true },
    );
    const { container } = render(<ActionNode {...makeActionProps('a1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-dangling]');
    expect(node?.getAttribute('data-blueprint-node-dangling')).toBe('true');
  });

  it('dangling=false 时 data-blueprint-node-dangling=false', () => {
    const data = makeTriggerData({ type: 'pageLoad' }, { dangling: false });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-dangling]');
    expect(node?.getAttribute('data-blueprint-node-dangling')).toBe('false');
  });
});

// ===== cycle 标记态样式 =====

describe('节点 cycle 标记态样式', () => {
  it('TriggerNode inCycle=true 时 data-blueprint-node-cycle=true', () => {
    const data = makeTriggerData({ type: 'pageLoad' }, { inCycle: true });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-cycle]');
    expect(node?.getAttribute('data-blueprint-node-cycle')).toBe('true');
  });

  it('ActionNode inCycle=true 时 data-blueprint-node-cycle=true', () => {
    const data = makeActionData(
      { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'hide' },
      { inCycle: true },
    );
    const { container } = render(<ActionNode {...makeActionProps('a1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-cycle]');
    expect(node?.getAttribute('data-blueprint-node-cycle')).toBe('true');
  });

  it('inCycle=false 时 data-blueprint-node-cycle=false', () => {
    const data = makeTriggerData({ type: 'pageLoad' }, { inCycle: false });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-cycle]');
    expect(node?.getAttribute('data-blueprint-node-cycle')).toBe('false');
  });
});

// ===== 配色方案 =====

describe('节点配色方案（与编辑器深色主题一致）', () => {
  it('TriggerNode 使用琥珀色配色', () => {
    const data = makeTriggerData({ type: 'pageLoad' });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    // trigger 配色应包含 amber 类（bg-amber-500/10）
    expect(node?.className).toContain('amber');
  });

  it('ActionNode 使用绿色配色', () => {
    const data = makeActionData({
      type: 'setVisibility',
      targetComponentId: 'comp-a',
      visible: 'hide',
    });
    const { container } = render(<ActionNode {...makeActionProps('a1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    // action 配色应包含 emerald 类
    expect(node?.className).toContain('emerald');
  });

  it('CommentNode 使用灰色配色', () => {
    const data = makeCommentData({ text: '注释' });
    const { container } = render(<CommentNode {...makeCommentProps('c1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    // comment 配色应包含 gray 类
    expect(node?.className).toContain('gray');
  });
});

// ===== 边框样式优先级 =====

describe('边框样式优先级', () => {
  it('dangling 优先级高于 selected：同时为 true 时显示红色边框', () => {
    const data = makeTriggerData(
      { type: 'componentClick', componentId: 'missing' },
      { dangling: true },
    );
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    // dangling 优先：应包含 border-red-500，不应包含 border-blue-500
    expect(node?.className).toContain('border-red-500');
    expect(node?.className).not.toContain('border-blue-500');
  });

  it('inCycle 优先级高于 selected：同时为 true 时显示橙色虚线边框', () => {
    const data = makeTriggerData({ type: 'pageLoad' }, { inCycle: true });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.className).toContain('border-orange-500');
    expect(node?.className).toContain('border-dashed');
    expect(node?.className).not.toContain('border-blue-500');
  });

  it('仅 selected=true 时显示蓝色边框', () => {
    const data = makeTriggerData({ type: 'pageLoad' });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, true)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    expect(node?.className).toContain('border-blue-500');
    expect(node?.className).not.toContain('border-red-500');
    expect(node?.className).not.toContain('border-orange-500');
  });

  it('默认态使用类型配色边框（trigger=amber）', () => {
    const data = makeTriggerData({ type: 'pageLoad' });
    const { container } = render(<TriggerNode {...makeTriggerProps('t1', data, false)} />);

    const node = container.querySelector('[data-blueprint-node-selected]');
    // 默认态应使用 amber 配色边框
    expect(node?.className).toContain('border-amber');
    expect(node?.className).not.toContain('border-red-500');
    expect(node?.className).not.toContain('border-blue-500');
  });
});
