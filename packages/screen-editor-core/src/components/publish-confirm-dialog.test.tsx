import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PublishConfirmDialog } from './publish-confirm-dialog';
import type { Diagnostic } from '../blueprint/compiler';

describe('PublishConfirmDialog（任务 5.3）', () => {
  const makeDiag = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
    level: 'error',
    code: 'cycle',
    message: '默认错误消息',
    ...overrides,
  });

  it('open=false 时不渲染对话框', () => {
    render(
      <PublishConfirmDialog
        open={false}
        diagnostics={[makeDiag()]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('open=true 时渲染对话框标题与诊断数量', () => {
    render(
      <PublishConfirmDialog
        open
        diagnostics={[makeDiag(), makeDiag({ message: '第二个错误' })]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('蓝图存在错误')).toBeInTheDocument();
    expect(screen.getByText(/2 个错误/)).toBeInTheDocument();
  });

  it('渲染所有诊断消息', () => {
    const diags = [
      makeDiag({ message: '循环引用：A → B → A' }),
      makeDiag({ code: 'empty-param', message: '动作缺少必填参数 navigate.url' }),
    ];
    render(
      <PublishConfirmDialog open diagnostics={diags} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('循环引用：A → B → A')).toBeInTheDocument();
    expect(screen.getByText('动作缺少必填参数 navigate.url')).toBeInTheDocument();
  });

  it('点击"仍然发布"触发 onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <PublishConfirmDialog
        open
        diagnostics={[makeDiag()]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('仍然发布'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('点击"取消"触发 onCancel', () => {
    const onCancel = vi.fn();
    render(
      <PublishConfirmDialog
        open
        diagnostics={[makeDiag()]}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
