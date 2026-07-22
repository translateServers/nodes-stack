import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProblemsPanel } from './problems-panel';
import type { Diagnostic } from '../compiler';

function makeDiag(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    level: 'error',
    code: 'cycle',
    message: '执行流存在循环',
    nodeId: 'node-1',
    ...overrides,
  };
}

describe('ProblemsPanel（任务 6.2）', () => {
  it('空诊断时显示"无问题"', () => {
    render(
      <ProblemsPanel
        diagnostics={[]}
        errorCount={0}
        warningCount={0}
        infoCount={0}
        onLocateNode={vi.fn()}
      />,
    );

    expect(screen.getByTestId('blueprint-problems-empty')).toBeInTheDocument();
    expect(screen.getByText('无问题')).toBeInTheDocument();
  });

  it('按分级列出诊断条目', () => {
    const diagnostics: Diagnostic[] = [
      makeDiag({ level: 'error', message: '循环引用' }),
      makeDiag({ level: 'warning', code: 'dangling-component', message: '悬空引用' }),
      makeDiag({ level: 'info', code: 'orphan-subgraph', message: '孤立子图' }),
    ];

    render(
      <ProblemsPanel
        diagnostics={diagnostics}
        errorCount={1}
        warningCount={1}
        infoCount={1}
        onLocateNode={vi.fn()}
      />,
    );

    expect(screen.getByTestId('blueprint-problems-panel')).toBeInTheDocument();
    expect(screen.getByText('循环引用')).toBeInTheDocument();
    expect(screen.getByText('悬空引用')).toBeInTheDocument();
    expect(screen.getByText('孤立子图')).toBeInTheDocument();

    // 分级计数
    expect(screen.getByTestId('problem-count-error')).toHaveTextContent('1 错误');
    expect(screen.getByTestId('problem-count-warning')).toHaveTextContent('1 警告');
    expect(screen.getByTestId('problem-count-info')).toHaveTextContent('1 信息');
  });

  it('诊断条目按 error > warning > info 排序', () => {
    const diagnostics: Diagnostic[] = [
      makeDiag({ level: 'info', code: 'orphan-subgraph', message: '孤立子图' }),
      makeDiag({ level: 'error', message: '循环引用' }),
      makeDiag({ level: 'warning', code: 'dangling-component', message: '悬空引用' }),
    ];

    render(
      <ProblemsPanel
        diagnostics={diagnostics}
        errorCount={1}
        warningCount={1}
        infoCount={1}
        onLocateNode={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('problem-item');
    expect(items).toHaveLength(3);
    // error 排第一
    expect(items[0]).toHaveAttribute('data-severity', 'error');
    // warning 排第二
    expect(items[1]).toHaveAttribute('data-severity', 'warning');
    // info 排第三
    expect(items[2]).toHaveAttribute('data-severity', 'info');
  });

  it('点击有条目 ID 的条目触发定位', () => {
    const onLocateNode = vi.fn();
    const diagnostics: Diagnostic[] = [makeDiag({ level: 'error', nodeId: 'node-1' })];

    render(
      <ProblemsPanel
        diagnostics={diagnostics}
        errorCount={1}
        warningCount={0}
        infoCount={0}
        onLocateNode={onLocateNode}
      />,
    );

    const item = screen.getByTestId('problem-item');
    fireEvent.click(item);

    expect(onLocateNode).toHaveBeenCalledWith('node-1');
  });

  it('仅显示有诊断的分级（不显示零计数）', () => {
    const diagnostics: Diagnostic[] = [makeDiag({ level: 'error', message: '循环引用' })];

    render(
      <ProblemsPanel
        diagnostics={diagnostics}
        errorCount={1}
        warningCount={0}
        infoCount={0}
        onLocateNode={vi.fn()}
      />,
    );

    expect(screen.getByTestId('problem-count-error')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-count-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('problem-count-info')).not.toBeInTheDocument();
  });

  it('显示节点 ID 信息', () => {
    const diagnostics: Diagnostic[] = [makeDiag({ level: 'error', nodeId: 'action-42' })];

    render(
      <ProblemsPanel
        diagnostics={diagnostics}
        errorCount={1}
        warningCount={0}
        infoCount={0}
        onLocateNode={vi.fn()}
      />,
    );

    expect(screen.getByText('action-42')).toBeInTheDocument();
  });
});
