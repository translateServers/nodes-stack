/**
 * CanvasFlashOverlay 组件测试（任务 9.1）
 *
 * 验证点：
 * - flashingComponentId 为 null 时不渲染
 * - 目标组件不存在时不渲染
 * - 目标组件存在时渲染闪烁框，定位到组件位置
 * - 闪烁框含正确的 data-testid 与 data-flashing-component-id
 * - pointer-events: none（不拦截交互）
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasFlashOverlay } from './canvas-flash-overlay';
import type { ScreenComponent } from '@nebula/shared';

function makeComponent(id: string, x = 100, y = 200, width = 80, height = 60): ScreenComponent {
  return {
    id,
    type: 'rect',
    name: `comp-${id}`,
    position: { x, y, width, height, rotation: 0 },
    style: {},
    props: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
  };
}

describe('CanvasFlashOverlay（任务 9.1）', () => {
  it('flashingComponentId 为 null 时不渲染', () => {
    const { container } = render(
      <CanvasFlashOverlay flashingComponentId={null} components={[makeComponent('c1')]} />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('canvas-flash-overlay')).toBeNull();
  });

  it('目标组件不存在时不渲染', () => {
    const { container } = render(
      <CanvasFlashOverlay flashingComponentId="non-existent" components={[makeComponent('c1')]} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('目标组件存在时渲染闪烁框', () => {
    const component = makeComponent('target-comp', 100, 200, 80, 60);
    render(<CanvasFlashOverlay flashingComponentId="target-comp" components={[component]} />);

    const overlay = screen.getByTestId('canvas-flash-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.getAttribute('data-flashing-component-id')).toBe('target-comp');
  });

  it('闪烁框定位到目标组件位置与尺寸', () => {
    const component = makeComponent('positioned', 250, 350, 120, 90);
    render(<CanvasFlashOverlay flashingComponentId="positioned" components={[component]} />);

    const overlay = screen.getByTestId('canvas-flash-overlay');
    // Canvas Drag Optimization：位置由 transform translate 控制（left/top 固定为 0）
    expect(overlay.style.left).toBe('0px');
    expect(overlay.style.top).toBe('0px');
    expect(overlay.style.transform).toBe('translate(250px, 350px)');
    expect(overlay.style.width).toBe('120px');
    expect(overlay.style.height).toBe('90px');
  });

  it('闪烁框含 pointer-events: none（不拦截交互）', () => {
    const component = makeComponent('c1');
    render(<CanvasFlashOverlay flashingComponentId="c1" components={[component]} />);

    const overlay = screen.getByTestId('canvas-flash-overlay');
    expect(overlay.className).toContain('pointer-events-none');
  });

  it('从多个组件中匹配目标组件', () => {
    const components = [
      makeComponent('c1', 0, 0),
      makeComponent('target', 500, 600, 100, 50),
      makeComponent('c3', 10, 10),
    ];
    render(<CanvasFlashOverlay flashingComponentId="target" components={components} />);

    const overlay = screen.getByTestId('canvas-flash-overlay');
    // Canvas Drag Optimization：位置由 transform translate 控制
    expect(overlay.style.transform).toBe('translate(500px, 600px)');
    expect(overlay.style.width).toBe('100px');
    expect(overlay.style.height).toBe('50px');
  });
});
