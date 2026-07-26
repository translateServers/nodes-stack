/**
 * 属性 Schema 渲染器测试 · tab 容器策略（Task 1）
 *
 * 验证点：
 * - 单 tab schema 不启用 Tabs 容器（平铺渲染）
 * - 含 customRender 分区且涉及 2+ tab 时正确启用 Tabs 容器
 * - customRender 分区按其 `tab` 字段归入对应 tab 的 TabsContent
 * - customRender 收到正确的 SectionRenderContext（component / onUpdate）
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import { PropertySchemaRenderer } from './section-renderer';
import type { PropertySchema, SectionRenderContext } from './types';

/** 构造最小可用组件（type='shape' 不触发图表专属字段） */
function makeComponent(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
  return {
    id: 'comp-a',
    type: 'shape',
    name: 'Component A',
    position: { x: 0, y: 0, width: 100, height: 50 },
    style: {},
    props: {},
    status: { locked: false, hidden: false },
    zIndex: 0,
    ...overrides,
  };
}

/**
 * 构造与 bar-chart 同构的 schema：
 * - appearance tab：声明式字段分区
 * - data tab：customRender 逃生舱分区
 */
function buildSchemaWithCustomRender(
  customRender: (ctx: SectionRenderContext) => ReactNode,
): PropertySchema {
  return [
    {
      id: 'position',
      title: '位置与尺寸',
      tab: 'appearance',
      fields: [{ kind: 'field', control: 'number', label: 'X', path: 'position.x' }],
    },
    {
      id: 'chart-config',
      title: '',
      tab: 'data',
      customRender,
    },
  ];
}

describe('PropertySchemaRenderer · tab 容器策略', () => {
  describe('单 tab schema', () => {
    it('仅 1 个 tab 时平铺渲染，不启用 Tabs 容器', () => {
      const schema: PropertySchema = [
        {
          id: 'position',
          title: '位置与尺寸',
          tab: 'appearance',
          fields: [{ kind: 'field', control: 'number', label: 'X', path: 'position.x' }],
        },
      ];
      render(
        <PropertySchemaRenderer schema={schema} component={makeComponent()} onUpdate={vi.fn()} />,
      );

      // 无 tab 角色元素 → 未启用 Tabs 容器
      expect(screen.queryByRole('tab')).toBeNull();
      // 分区标题直接渲染（平铺）
      expect(screen.getByText('位置与尺寸')).toBeDefined();
      expect(screen.getByText('X')).toBeDefined();
    });
  });

  describe('含 customRender 分区的 schema（2+ tab）', () => {
    it('含 customRender 分区且涉及 2+ tab 时启用 Tabs 容器', () => {
      const customRender = (): ReactNode => <div data-testid="custom-content">自定义内容</div>;
      render(
        <PropertySchemaRenderer
          schema={buildSchemaWithCustomRender(customRender)}
          component={makeComponent()}
          onUpdate={vi.fn()}
        />,
      );

      // 启用 Tabs 容器：出现两个 TabsTrigger（外观 / 数据）
      const triggers = screen.getAllByRole('tab');
      expect(triggers).toHaveLength(2);
      expect(screen.getByText('外观')).toBeDefined();
      expect(screen.getByText('数据')).toBeDefined();
    });

    it('customRender 分区按 tab 字段归入对应 tab（默认激活首个 tab，customRender 未挂载）', async () => {
      const user = userEvent.setup();
      const customRender = (): ReactNode => <div data-testid="custom-content">自定义内容</div>;
      render(
        <PropertySchemaRenderer
          schema={buildSchemaWithCustomRender(customRender)}
          component={makeComponent()}
          onUpdate={vi.fn()}
        />,
      );

      // 默认激活 tabs[0]（appearance），customRender 在 data tab → 未挂载
      expect(screen.queryByTestId('custom-content')).toBeNull();

      // 切换到 data tab → customRender 内容挂载
      await user.click(screen.getByText('数据'));
      expect(screen.getByTestId('custom-content')).toBeDefined();
      expect(screen.getByText('自定义内容')).toBeDefined();
    });

    it('切换回原 tab 后 customRender 内容卸载', async () => {
      const user = userEvent.setup();
      const customRender = (): ReactNode => <div data-testid="custom-content">自定义内容</div>;
      render(
        <PropertySchemaRenderer
          schema={buildSchemaWithCustomRender(customRender)}
          component={makeComponent()}
          onUpdate={vi.fn()}
        />,
      );

      // 切到 data → 挂载
      await user.click(screen.getByText('数据'));
      expect(screen.getByTestId('custom-content')).toBeDefined();

      // 切回 appearance → 卸载（Radix TabsContent 默认不 forceMount）
      await user.click(screen.getByText('外观'));
      expect(screen.queryByTestId('custom-content')).toBeNull();
    });

    it('customRender 收到正确的 SectionRenderContext（component / onUpdate）', async () => {
      const user = userEvent.setup();
      const component = makeComponent({ id: 'comp-xyz', name: '测试组件' });
      const onUpdate = vi.fn();

      // 用 holder 对象避免 TypeScript 对闭包内赋值的 let 变量做过度 CFA 收窄
      const captured: { ctx: SectionRenderContext | null } = { ctx: null };
      const customRender = (ctx: SectionRenderContext): ReactNode => {
        captured.ctx = ctx;
        return <div data-testid="custom-content" />;
      };

      render(
        <PropertySchemaRenderer
          schema={buildSchemaWithCustomRender(customRender)}
          component={component}
          onUpdate={onUpdate}
        />,
      );

      // 切换到 data tab 触发 customRender 调用
      await user.click(screen.getByText('数据'));

      expect(captured.ctx).not.toBeNull();
      expect(captured.ctx?.component).toBe(component);
      expect(captured.ctx?.onUpdate).toBe(onUpdate);
    });
  });
});
