/**
 * AlignDistributeToolbar 组件测试（任务 9.4）
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AlignDistributeToolbar } from './align-distribute-toolbar';

describe('AlignDistributeToolbar', () => {
  describe('渲染', () => {
    it('渲染 6 个对齐按钮', () => {
      render(<AlignDistributeToolbar selectedCount={2} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByLabelText('左对齐')).toBeInTheDocument();
      expect(screen.getByLabelText('水平居中')).toBeInTheDocument();
      expect(screen.getByLabelText('右对齐')).toBeInTheDocument();
      expect(screen.getByLabelText('顶对齐')).toBeInTheDocument();
      expect(screen.getByLabelText('垂直居中')).toBeInTheDocument();
      expect(screen.getByLabelText('底对齐')).toBeInTheDocument();
    });

    it('渲染 2 个分布按钮', () => {
      render(<AlignDistributeToolbar selectedCount={3} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByLabelText('水平等距分布')).toBeInTheDocument();
      expect(screen.getByLabelText('垂直等距分布')).toBeInTheDocument();
    });

    it('渲染 toolbar role 与 aria-label', () => {
      render(<AlignDistributeToolbar selectedCount={3} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', '对齐与分布');
    });

    it('data-testid="align-distribute-toolbar" 存在', () => {
      render(<AlignDistributeToolbar selectedCount={3} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByTestId('align-distribute-toolbar')).toBeInTheDocument();
    });

    it('data-selected-count 反映传入的 selectedCount', () => {
      render(<AlignDistributeToolbar selectedCount={5} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      const toolbar = screen.getByTestId('align-distribute-toolbar');
      expect(toolbar).toHaveAttribute('data-selected-count', '5');
    });
  });

  describe('启用/禁用规则', () => {
    it('selectedCount=0：对齐与分布按钮全部禁用', () => {
      render(<AlignDistributeToolbar selectedCount={0} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByLabelText('左对齐')).toBeDisabled();
      expect(screen.getByLabelText('水平居中')).toBeDisabled();
      expect(screen.getByLabelText('右对齐')).toBeDisabled();
      expect(screen.getByLabelText('顶对齐')).toBeDisabled();
      expect(screen.getByLabelText('垂直居中')).toBeDisabled();
      expect(screen.getByLabelText('底对齐')).toBeDisabled();
      expect(screen.getByLabelText('水平等距分布')).toBeDisabled();
      expect(screen.getByLabelText('垂直等距分布')).toBeDisabled();
    });

    it('selectedCount=1：对齐与分布按钮全部禁用', () => {
      render(<AlignDistributeToolbar selectedCount={1} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByLabelText('左对齐')).toBeDisabled();
      expect(screen.getByLabelText('水平等距分布')).toBeDisabled();
    });

    it('selectedCount=2：对齐按钮启用，分布按钮禁用', () => {
      render(<AlignDistributeToolbar selectedCount={2} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByLabelText('左对齐')).toBeEnabled();
      expect(screen.getByLabelText('水平居中')).toBeEnabled();
      expect(screen.getByLabelText('右对齐')).toBeEnabled();
      expect(screen.getByLabelText('顶对齐')).toBeEnabled();
      expect(screen.getByLabelText('垂直居中')).toBeEnabled();
      expect(screen.getByLabelText('底对齐')).toBeEnabled();
      // 分布需要 >= 3
      expect(screen.getByLabelText('水平等距分布')).toBeDisabled();
      expect(screen.getByLabelText('垂直等距分布')).toBeDisabled();
    });

    it('selectedCount=3：对齐与分布按钮全部启用', () => {
      render(<AlignDistributeToolbar selectedCount={3} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByLabelText('左对齐')).toBeEnabled();
      expect(screen.getByLabelText('水平等距分布')).toBeEnabled();
      expect(screen.getByLabelText('垂直等距分布')).toBeEnabled();
    });

    it('data-align-disabled 属性反映禁用状态', () => {
      const { rerender } = render(
        <AlignDistributeToolbar selectedCount={1} onAlign={vi.fn()} onDistribute={vi.fn()} />,
      );
      expect(screen.getByLabelText('左对齐')).toHaveAttribute('data-align-disabled', 'true');

      rerender(
        <AlignDistributeToolbar selectedCount={2} onAlign={vi.fn()} onDistribute={vi.fn()} />,
      );
      expect(screen.getByLabelText('左对齐')).toHaveAttribute('data-align-disabled', 'false');
    });

    it('data-distribute-disabled 属性反映禁用状态', () => {
      const { rerender } = render(
        <AlignDistributeToolbar selectedCount={2} onAlign={vi.fn()} onDistribute={vi.fn()} />,
      );
      expect(screen.getByLabelText('水平等距分布')).toHaveAttribute(
        'data-distribute-disabled',
        'true',
      );

      rerender(
        <AlignDistributeToolbar selectedCount={3} onAlign={vi.fn()} onDistribute={vi.fn()} />,
      );
      expect(screen.getByLabelText('水平等距分布')).toHaveAttribute(
        'data-distribute-disabled',
        'false',
      );
    });
  });

  describe('data-mode 属性', () => {
    it('对齐按钮的 data-align-mode 与按钮对应', () => {
      render(<AlignDistributeToolbar selectedCount={2} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByLabelText('左对齐')).toHaveAttribute('data-align-mode', 'left');
      expect(screen.getByLabelText('水平居中')).toHaveAttribute('data-align-mode', 'center-h');
      expect(screen.getByLabelText('右对齐')).toHaveAttribute('data-align-mode', 'right');
      expect(screen.getByLabelText('顶对齐')).toHaveAttribute('data-align-mode', 'top');
      expect(screen.getByLabelText('垂直居中')).toHaveAttribute('data-align-mode', 'middle-v');
      expect(screen.getByLabelText('底对齐')).toHaveAttribute('data-align-mode', 'bottom');
    });

    it('分布按钮的 data-distribute-mode 与按钮对应', () => {
      render(<AlignDistributeToolbar selectedCount={3} onAlign={vi.fn()} onDistribute={vi.fn()} />);

      expect(screen.getByLabelText('水平等距分布')).toHaveAttribute(
        'data-distribute-mode',
        'horizontal',
      );
      expect(screen.getByLabelText('垂直等距分布')).toHaveAttribute(
        'data-distribute-mode',
        'vertical',
      );
    });
  });

  describe('回调', () => {
    it('点击对齐按钮调用 onAlign 并传 mode', () => {
      const onAlign = vi.fn();
      render(<AlignDistributeToolbar selectedCount={2} onAlign={onAlign} onDistribute={vi.fn()} />);

      fireEvent.click(screen.getByLabelText('左对齐'));
      expect(onAlign).toHaveBeenCalledWith('left');

      fireEvent.click(screen.getByLabelText('水平居中'));
      expect(onAlign).toHaveBeenCalledWith('center-h');

      fireEvent.click(screen.getByLabelText('右对齐'));
      expect(onAlign).toHaveBeenCalledWith('right');

      fireEvent.click(screen.getByLabelText('顶对齐'));
      expect(onAlign).toHaveBeenCalledWith('top');

      fireEvent.click(screen.getByLabelText('垂直居中'));
      expect(onAlign).toHaveBeenCalledWith('middle-v');

      fireEvent.click(screen.getByLabelText('底对齐'));
      expect(onAlign).toHaveBeenCalledWith('bottom');
    });

    it('点击分布按钮调用 onDistribute 并传 mode', () => {
      const onDistribute = vi.fn();
      render(
        <AlignDistributeToolbar selectedCount={3} onAlign={vi.fn()} onDistribute={onDistribute} />,
      );

      fireEvent.click(screen.getByLabelText('水平等距分布'));
      expect(onDistribute).toHaveBeenCalledWith('horizontal');

      fireEvent.click(screen.getByLabelText('垂直等距分布'));
      expect(onDistribute).toHaveBeenCalledWith('vertical');
    });

    it('禁用状态下点击不触发回调', () => {
      const onAlign = vi.fn();
      const onDistribute = vi.fn();
      render(
        <AlignDistributeToolbar selectedCount={0} onAlign={onAlign} onDistribute={onDistribute} />,
      );

      // disabled 按钮的 click 在 testing-library 中不会触发 onClick
      fireEvent.click(screen.getByLabelText('左对齐'), { bubbles: true });
      fireEvent.click(screen.getByLabelText('水平等距分布'), { bubbles: true });
      expect(onAlign).not.toHaveBeenCalled();
      expect(onDistribute).not.toHaveBeenCalled();
    });
  });

  describe('事件冒泡', () => {
    it('点击对齐按钮时阻止冒泡（避免触发 ReactFlow 取消选择）', () => {
      const parentHandler = vi.fn();
      const onAlign = vi.fn();
      render(
        <div onClick={parentHandler}>
          <AlignDistributeToolbar selectedCount={2} onAlign={onAlign} onDistribute={vi.fn()} />
        </div>,
      );

      fireEvent.click(screen.getByLabelText('左对齐'));
      expect(onAlign).toHaveBeenCalledTimes(1);
      // stopPropagation 阻止事件冒泡到父 div
      expect(parentHandler).not.toHaveBeenCalled();
    });

    it('点击分布按钮时阻止冒泡', () => {
      const parentHandler = vi.fn();
      const onDistribute = vi.fn();
      render(
        <div onClick={parentHandler}>
          <AlignDistributeToolbar selectedCount={3} onAlign={vi.fn()} onDistribute={onDistribute} />
        </div>,
      );

      fireEvent.click(screen.getByLabelText('水平等距分布'));
      expect(onDistribute).toHaveBeenCalledTimes(1);
      expect(parentHandler).not.toHaveBeenCalled();
    });
  });

  describe('自定义类名', () => {
    it('传入 className 合并到根容器', () => {
      render(
        <AlignDistributeToolbar
          selectedCount={2}
          onAlign={vi.fn()}
          onDistribute={vi.fn()}
          className="custom-class"
        />,
      );

      const toolbar = screen.getByTestId('align-distribute-toolbar');
      expect(toolbar.className).toContain('custom-class');
    });
  });
});
