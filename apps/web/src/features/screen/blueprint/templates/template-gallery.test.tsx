/**
 * TemplateGallery 组件测试（任务 9.3）
 *
 * 验证点：
 * - 渲染三个模板卡片
 * - 每个卡片包含名称与描述
 * - 点击卡片触发 onSelect，传入正确的 templateId
 * - 卡片有正确的 data-testid 与 data-template-id
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateGallery } from './template-gallery';
import { BLUEPRINT_TEMPLATES } from './template-definitions';

describe('TemplateGallery（任务 9.3）', () => {
  describe('渲染', () => {
    it('渲染三个模板卡片', () => {
      render(<TemplateGallery onSelect={vi.fn()} />);

      const gallery = screen.getByTestId('template-gallery');
      expect(gallery).toBeInTheDocument();

      // 三个卡片（role=listitem 在 button 上）
      const cards = screen.getAllByRole('listitem');
      expect(cards).toHaveLength(3);
    });

    it('每个卡片显示模板名称', () => {
      render(<TemplateGallery onSelect={vi.fn()} />);

      for (const template of BLUEPRINT_TEMPLATES) {
        expect(screen.getByText(template.name)).toBeInTheDocument();
      }
    });

    it('每个卡片显示模板描述', () => {
      render(<TemplateGallery onSelect={vi.fn()} />);

      for (const template of BLUEPRINT_TEMPLATES) {
        expect(screen.getByText(template.description)).toBeInTheDocument();
      }
    });

    it('卡片按 BLUEPRINT_TEMPLATES 顺序渲染', () => {
      render(<TemplateGallery onSelect={vi.fn()} />);

      const cards = screen.getAllByRole('listitem');
      expect(cards[0]).toHaveAttribute('data-template-id', 'click-navigate');
      expect(cards[1]).toHaveAttribute('data-template-id', 'click-toggle-visibility');
      expect(cards[2]).toHaveAttribute('data-template-id', 'page-load-refresh');
    });
  });

  describe('点击交互', () => {
    it('点击 click-navigate 卡片触发 onSelect("click-navigate")', () => {
      const onSelect = vi.fn();
      render(<TemplateGallery onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('template-card-click-navigate'));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('click-navigate');
    });

    it('点击 click-toggle-visibility 卡片触发对应 onSelect', () => {
      const onSelect = vi.fn();
      render(<TemplateGallery onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('template-card-click-toggle-visibility'));

      expect(onSelect).toHaveBeenCalledWith('click-toggle-visibility');
    });

    it('点击 page-load-refresh 卡片触发对应 onSelect', () => {
      const onSelect = vi.fn();
      render(<TemplateGallery onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('template-card-page-load-refresh'));

      expect(onSelect).toHaveBeenCalledWith('page-load-refresh');
    });

    it('点击不同卡片传入不同 templateId（不混淆）', () => {
      const onSelect = vi.fn();
      render(<TemplateGallery onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('template-card-click-navigate'));
      fireEvent.click(screen.getByTestId('template-card-page-load-refresh'));

      expect(onSelect).toHaveBeenCalledTimes(2);
      expect(onSelect).toHaveBeenNthCalledWith(1, 'click-navigate');
      expect(onSelect).toHaveBeenNthCalledWith(2, 'page-load-refresh');
    });
  });

  describe('可访问性', () => {
    it('每个卡片是 button 元素（可聚焦可键盘激活）', () => {
      render(<TemplateGallery onSelect={vi.fn()} />);

      const cards = screen.getAllByRole('listitem');
      for (const card of cards) {
        expect(card.tagName).toBe('BUTTON');
        expect(card).toHaveAttribute('type', 'button');
      }
    });

    it('画廊容器是 list 角色', () => {
      render(<TemplateGallery onSelect={vi.fn()} />);

      expect(screen.getByRole('list')).toBeInTheDocument();
    });
  });
});
