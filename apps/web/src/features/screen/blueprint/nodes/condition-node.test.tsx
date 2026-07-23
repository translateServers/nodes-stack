/**
 * ConditionNode 组件测试（任务 10.2）
 *
 * 验证点：
 * - 渲染条件节点（紫色配色，then/else 双输出引脚）
 * - 节点正文显示表达式摘要
 * - 节点显示 THEN / ELSE 引脚标签
 * - summarizeCondition 纯函数
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import type { ConditionNodeConfig } from '@nebula/shared';
import { ConditionNode, summarizeCondition } from './condition-node';
import type { ConditionNodeData } from './node-data-types';

// Mock @xyflow/react 的 Handle 组件，避免依赖 ReactFlowProvider/NodeIdContext
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    Handle: ({ type, id, position }: { type: string; id?: string; position: string }) => (
      <div
        data-testid="rf-handle"
        data-handle-type={type}
        data-handle-id={id}
        data-handle-position={position}
      />
    ),
  };
});

// Mock useBlueprintDiagnosticMap 避免依赖 Context Provider
vi.mock('../hooks/blueprint-diagnostic-context', () => ({
  useBlueprintDiagnosticMap: () => new Map(),
}));

function makeConfig(overrides: Partial<ConditionNodeConfig> = {}): ConditionNodeConfig {
  return {
    type: 'condition',
    expression: {
      source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
      operator: 'eq',
      value: '1',
    },
    ...overrides,
  };
}

function makeProps(
  configOverrides: Partial<ConditionNodeConfig> = {},
  extra: Partial<ConditionNodeData> = {},
): NodeProps<ConditionNode> {
  return {
    id: 'cd-1',
    type: 'condition',
    position: { x: 0, y: 0 },
    data: {
      config: makeConfig(configOverrides),
      label: '条件',
      ...extra,
    },
    selected: false,
    draggable: true,
    dragging: false,
    sourcePosition: 'right' as never,
    targetPosition: 'left' as never,
    zIndex: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    width: 0,
    height: 0,
  } as unknown as NodeProps<ConditionNode>;
}

describe('summarizeCondition 纯函数', () => {
  it('eq + string value', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'eq',
            value: 'abc',
          },
        }),
      ),
    ).toBe('属性 value 等于 "abc"');
  });

  it('eq + number value', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: 'count' },
            operator: 'eq',
            value: 42,
          },
        }),
      ),
    ).toBe('属性 count 等于 42');
  });

  it('eq + boolean value', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: 'visible' },
            operator: 'eq',
            value: true,
          },
        }),
      ),
    ).toBe('属性 visible 等于 true');
  });

  it('empty 无 value', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'empty',
          },
        }),
      ),
    ).toBe('属性 value 为空');
  });

  it('notEmpty 无 value', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'notEmpty',
          },
        }),
      ),
    ).toBe('属性 value 非空');
  });

  it('componentData 来源', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentData', componentId: 'c1', path: 'list.0.value' },
            operator: 'gt',
            value: 100,
          },
        }),
      ),
    ).toBe('数据 list.0.value 大于 100');
  });

  it('空字符串 value 显示为 ∅', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
            operator: 'eq',
            value: '',
          },
        }),
      ),
    ).toBe('属性 value 等于 ∅');
  });

  it('空 key 显示为 ?', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: '' },
            operator: 'eq',
            value: '1',
          },
        }),
      ),
    ).toBe('属性 ? 等于 "1"');
  });

  it('空 path 显示为 ?', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentData', componentId: 'c1', path: '' },
            operator: 'eq',
            value: '1',
          },
        }),
      ),
    ).toBe('数据 ? 等于 "1"');
  });

  it('包含运算符 contains', () => {
    expect(
      summarizeCondition(
        makeConfig({
          expression: {
            source: { kind: 'componentProp', componentId: 'c1', key: 'text' },
            operator: 'contains',
            value: 'sub',
          },
        }),
      ),
    ).toBe('属性 text 包含 "sub"');
  });
});

describe('ConditionNode 组件', () => {
  it('渲染条件节点配色为 condition', () => {
    render(<ConditionNode {...makeProps()} />);
    const node = screen.getByTestId('blueprint-node');
    expect(node.getAttribute('data-node-kind')).toBe('condition');
  });

  it('渲染 "条件分支" 类型标签', () => {
    render(<ConditionNode {...makeProps()} />);
    expect(screen.getByText('条件分支')).toBeInTheDocument();
  });

  it('渲染表达式摘要', () => {
    render(<ConditionNode {...makeProps()} />);
    // makeProps 默认 config: 属性 value 等于 "1"
    expect(screen.getByText('属性 value 等于 "1"')).toBeInTheDocument();
  });

  it('渲染 THEN / ELSE 引脚标签', () => {
    render(<ConditionNode {...makeProps()} />);
    expect(screen.getByText('THEN')).toBeInTheDocument();
    expect(screen.getByText('ELSE')).toBeInTheDocument();
  });

  it('未选中时无 selected 标记', () => {
    const props = makeProps();
    render(<ConditionNode {...props} />);
    const node = screen.getByTestId('blueprint-node');
    expect(node.getAttribute('data-blueprint-node-selected')).toBe('false');
  });

  it('选中时 data-blueprint-node-selected=true', () => {
    const props = makeProps();
    props.selected = true;
    render(<ConditionNode {...props} />);
    const node = screen.getByTestId('blueprint-node');
    expect(node.getAttribute('data-blueprint-node-selected')).toBe('true');
  });

  it('dangling=true 时 data-blueprint-node-dangling=true', () => {
    const props = makeProps({}, { dangling: true });
    render(<ConditionNode {...props} />);
    const node = screen.getByTestId('blueprint-node');
    expect(node.getAttribute('data-blueprint-node-dangling')).toBe('true');
  });

  it('inCycle=true 时 data-blueprint-node-cycle=true', () => {
    const props = makeProps({}, { inCycle: true });
    render(<ConditionNode {...props} />);
    const node = screen.getByTestId('blueprint-node');
    expect(node.getAttribute('data-blueprint-node-cycle')).toBe('true');
  });

  it('渲染节点 id（用于 E2E 定位）', () => {
    render(<ConditionNode {...makeProps()} />);
    const node = screen.getByTestId('blueprint-node');
    expect(node.getAttribute('data-node-id')).toBe('cd-1');
  });

  it('渲染 3 个 handle：1 target + 2 source (then/else)', () => {
    render(<ConditionNode {...makeProps()} />);
    const handles = screen.getAllByTestId('rf-handle');
    expect(handles).toHaveLength(3);
    const sources = handles.filter((h) => h.getAttribute('data-handle-type') === 'source');
    const targets = handles.filter((h) => h.getAttribute('data-handle-type') === 'target');
    expect(sources).toHaveLength(2);
    expect(targets).toHaveLength(1);
    // then / else handle id
    const handleIds = sources.map((h) => h.getAttribute('data-handle-id'));
    expect(handleIds).toContain('then');
    expect(handleIds).toContain('else');
  });
});
