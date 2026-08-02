import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { formatZoom, ViewportToolbar } from './viewport-toolbar';

describe('viewport-toolbar', () => {
  describe('formatZoom', () => {
    it('1.0 格式化为 100%', () => {
      expect(formatZoom(1)).toBe('100%');
    });

    it('0.5 格式化为 50%', () => {
      expect(formatZoom(0.5)).toBe('50%');
    });

    it('0.25 格式化为 25%', () => {
      expect(formatZoom(0.25)).toBe('25%');
    });

    it('2.0 格式化为 200%', () => {
      expect(formatZoom(2)).toBe('200%');
    });

    it('1.5 四舍五入为 150%', () => {
      expect(formatZoom(1.5)).toBe('150%');
    });

    it('0.75 四舍五入为 75%', () => {
      expect(formatZoom(0.75)).toBe('75%');
    });

    it('0.333 四舍五入为 33%', () => {
      expect(formatZoom(0.333)).toBe('33%');
    });
  });

  describe('ViewportToolbar 渲染', () => {
    const defaultCallbacks = {
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onFitView: vi.fn(),
      onFitViewToSelection: vi.fn(),
      onReset: vi.fn(),
    };

    it('渲染所有控制按钮', () => {
      render(<ViewportToolbar zoom={1} spacePressed={false} {...defaultCallbacks} />);

      expect(screen.getByLabelText('放大')).toBeInTheDocument();
      expect(screen.getByLabelText('缩小')).toBeInTheDocument();
      expect(screen.getByLabelText('适配视图')).toBeInTheDocument();
      expect(screen.getByLabelText('缩放到选区')).toBeInTheDocument();
      expect(screen.getByLabelText('重置视口')).toBeInTheDocument();
    });

    it('渲染当前缩放百分比', () => {
      render(<ViewportToolbar zoom={1.5} spacePressed={false} {...defaultCallbacks} />);

      const label = screen.getByTestId('zoom-label');
      expect(label.textContent).toBe('150%');
    });

    it('渲染缩放级别 0.5 时显示 50%', () => {
      render(<ViewportToolbar zoom={0.5} spacePressed={false} {...defaultCallbacks} />);

      expect(screen.getByTestId('zoom-label').textContent).toBe('50%');
    });

    it('Space 按下时显示高亮环', () => {
      render(<ViewportToolbar zoom={1} spacePressed {...defaultCallbacks} />);

      const toolbar = screen.getByTestId('viewport-toolbar');
      expect(toolbar.getAttribute('data-space-pressed')).toBe('true');
    });

    it('Space 未按下时不显示高亮环', () => {
      render(<ViewportToolbar zoom={1} spacePressed={false} {...defaultCallbacks} />);

      const toolbar = screen.getByTestId('viewport-toolbar');
      expect(toolbar.getAttribute('data-space-pressed')).toBe('false');
    });
  });

  describe('按钮交互', () => {
    it('点击放大按钮触发 onZoomIn', () => {
      const onZoomIn = vi.fn();
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          onZoomIn={onZoomIn}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByLabelText('放大'));
      expect(onZoomIn).toHaveBeenCalledTimes(1);
    });

    it('点击缩小按钮触发 onZoomOut', () => {
      const onZoomOut = vi.fn();
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          onZoomIn={vi.fn()}
          onZoomOut={onZoomOut}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByLabelText('缩小'));
      expect(onZoomOut).toHaveBeenCalledTimes(1);
    });

    it('点击适配视图按钮触发 onFitView', () => {
      const onFitView = vi.fn();
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={onFitView}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByLabelText('适配视图'));
      expect(onFitView).toHaveBeenCalledTimes(1);
    });

    it('点击缩放到选区按钮触发 onFitViewToSelection', () => {
      const onFitViewToSelection = vi.fn();
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          selectedCount={2}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={onFitViewToSelection}
          onReset={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByLabelText('缩放到选区'));
      expect(onFitViewToSelection).toHaveBeenCalledTimes(1);
    });

    it('点击重置视口按钮触发 onReset', () => {
      const onReset = vi.fn();
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={onReset}
        />,
      );

      fireEvent.click(screen.getByLabelText('重置视口'));
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('缩放到选区按钮状态', () => {
    const baseProps = {
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onFitView: vi.fn(),
      onFitViewToSelection: vi.fn(),
      onReset: vi.fn(),
    };

    it('selectedCount=0 时按钮禁用', () => {
      render(<ViewportToolbar zoom={1} spacePressed={false} selectedCount={0} {...baseProps} />);

      expect(screen.getByLabelText('缩放到选区')).toBeDisabled();
    });

    it('selectedCount 未提供时按钮禁用（默认值 0）', () => {
      render(<ViewportToolbar zoom={1} spacePressed={false} {...baseProps} />);

      expect(screen.getByLabelText('缩放到选区')).toBeDisabled();
    });

    it('selectedCount>0 时按钮可用', () => {
      render(<ViewportToolbar zoom={1} spacePressed={false} selectedCount={1} {...baseProps} />);

      expect(screen.getByLabelText('缩放到选区')).not.toBeDisabled();
    });

    it('selectedCount=2 时按钮可用', () => {
      render(<ViewportToolbar zoom={1} spacePressed={false} selectedCount={2} {...baseProps} />);

      expect(screen.getByLabelText('缩放到选区')).not.toBeDisabled();
    });

    it('禁用按钮点击不触发回调', () => {
      const onFitViewToSelection = vi.fn();
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          selectedCount={0}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={onFitViewToSelection}
          onReset={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByLabelText('缩放到选区'));
      expect(onFitViewToSelection).not.toHaveBeenCalled();
    });
  });

  describe('事件冒泡', () => {
    it('点击按钮事件不冒泡到父容器', () => {
      const parentOnClick = vi.fn();
      const onZoomIn = vi.fn();

      render(
        <div onClick={parentOnClick} data-testid="parent">
          <ViewportToolbar
            zoom={1}
            spacePressed={false}
            onZoomIn={onZoomIn}
            onZoomOut={vi.fn()}
            onFitView={vi.fn()}
            onFitViewToSelection={vi.fn()}
            onReset={vi.fn()}
          />
        </div>,
      );

      fireEvent.click(screen.getByLabelText('放大'));

      // onZoomIn 应该被调用
      expect(onZoomIn).toHaveBeenCalledTimes(1);
      // 父容器 onClick 不应该被触发（事件被 stopPropagation）
      expect(parentOnClick).not.toHaveBeenCalled();
    });
  });

  describe('自定义类名', () => {
    it('支持传入自定义类名', () => {
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          className="custom-class"
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      const toolbar = screen.getByTestId('viewport-toolbar');
      expect(toolbar.className).toContain('custom-class');
    });
  });

  describe('按钮 data-zoom-action 属性', () => {
    it('放大按钮 data-zoom-action=zoom-in', () => {
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      const btn = screen.getByLabelText('放大');
      expect(btn.getAttribute('data-zoom-action')).toBe('zoom-in');
    });

    it('缩小按钮 data-zoom-action=zoom-out', () => {
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      const btn = screen.getByLabelText('缩小');
      expect(btn.getAttribute('data-zoom-action')).toBe('zoom-out');
    });

    it('适配视图按钮 data-zoom-action=fit-view', () => {
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      const btn = screen.getByLabelText('适配视图');
      expect(btn.getAttribute('data-zoom-action')).toBe('fit-view');
    });

    it('缩放到选区按钮 data-zoom-action=fit-view-to-selection', () => {
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          selectedCount={1}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      const btn = screen.getByLabelText('缩放到选区');
      expect(btn.getAttribute('data-zoom-action')).toBe('fit-view-to-selection');
    });

    it('重置视口按钮 data-zoom-action=reset', () => {
      render(
        <ViewportToolbar
          zoom={1}
          spacePressed={false}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitView={vi.fn()}
          onFitViewToSelection={vi.fn()}
          onReset={vi.fn()}
        />,
      );

      const btn = screen.getByLabelText('重置视口');
      expect(btn.getAttribute('data-zoom-action')).toBe('reset');
    });
  });
});
