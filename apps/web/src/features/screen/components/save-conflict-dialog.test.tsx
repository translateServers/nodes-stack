import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { SaveConflictDialog } from './save-conflict-dialog';

describe('SaveConflictDialog', () => {
  describe('open 状态', () => {
    it('open=true 时显示对话框', () => {
      render(<SaveConflictDialog open={true} onReload={vi.fn()} onCancel={vi.fn()} />);

      // AlertDialog 通过 role="alertdialog" 暴露给可访问性 API
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      // 标题与描述作为可访问名称/描述
      expect(screen.getByText('保存冲突')).toBeInTheDocument();
      expect(
        screen.getByText('项目已在其他窗口或会话中被修改。重新加载将放弃当前未保存内容。'),
      ).toBeInTheDocument();
      // 两个操作按钮均渲染
      expect(screen.getByText('继续编辑')).toBeInTheDocument();
      expect(screen.getByText('重新加载')).toBeInTheDocument();
    });

    it('open=false 时不显示', () => {
      render(<SaveConflictDialog open={false} onReload={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.queryByText('保存冲突')).toBeNull();
    });
  });

  describe('按钮交互', () => {
    it('点击"重新加载"调用 onReload', () => {
      const onReload = vi.fn();
      render(<SaveConflictDialog open={true} onReload={onReload} onCancel={vi.fn()} />);

      fireEvent.click(screen.getByText('重新加载'));

      expect(onReload).toHaveBeenCalledTimes(1);
    });

    it('点击"继续编辑"调用 onCancel', () => {
      const onCancel = vi.fn();
      render(<SaveConflictDialog open={true} onReload={vi.fn()} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('继续编辑'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
