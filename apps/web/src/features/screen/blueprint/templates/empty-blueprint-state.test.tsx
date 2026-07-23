/**
 * EmptyBlueprintState 组件测试（任务 9.3）
 *
 * 验证点：
 * - 渲染标题与引导文案
 * - 渲染 TemplateGallery（含三个模板卡片）
 * - 渲染"从空白开始"按钮
 * - 点击模板卡片：校验通过时调用 onInsertTemplate，传入完整蓝图
 * - 点击模板卡片：校验失败时调用 onError（通过 mock buildValidatedTemplate 注入）
 * - 点击"从空白开始"按钮：调用 onStartFromScratch
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyBlueprintState } from './empty-blueprint-state';
import * as buildModule from './build-validated-template';
import type { EventBlueprint } from '@nebula/shared';

describe('EmptyBlueprintState（任务 9.3）', () => {
  beforeEach(() => {
    // 默认不 mock buildValidatedTemplate，让组件调用真实实现
    // 仅在"校验失败路径"测试中显式 mock 为 failure
    vi.restoreAllMocks();
  });

  describe('渲染', () => {
    it('渲染标题"从模板开始"', () => {
      render(
        <EmptyBlueprintState
          onInsertTemplate={vi.fn()}
          onError={vi.fn()}
          onStartFromScratch={vi.fn()}
        />,
      );

      expect(screen.getByText('从模板开始')).toBeInTheDocument();
    });

    it('渲染引导文案', () => {
      render(
        <EmptyBlueprintState
          onInsertTemplate={vi.fn()}
          onError={vi.fn()}
          onStartFromScratch={vi.fn()}
        />,
      );

      expect(screen.getByText(/选择一个常用模板快速开始/)).toBeInTheDocument();
    });

    it('渲染三个模板卡片（TemplateGallery 子组件）', () => {
      render(
        <EmptyBlueprintState
          onInsertTemplate={vi.fn()}
          onError={vi.fn()}
          onStartFromScratch={vi.fn()}
        />,
      );

      expect(screen.getByTestId('template-gallery')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('渲染"从空白开始"按钮', () => {
      render(
        <EmptyBlueprintState
          onInsertTemplate={vi.fn()}
          onError={vi.fn()}
          onStartFromScratch={vi.fn()}
        />,
      );

      expect(screen.getByTestId('empty-blueprint-start-from-scratch')).toBeInTheDocument();
      expect(screen.getByText('从空白开始')).toBeInTheDocument();
    });
  });

  describe('点击模板卡片 - 校验通过路径', () => {
    it('点击 click-navigate 卡片调用 onInsertTemplate，传入完整蓝图', () => {
      const onInsertTemplate = vi.fn();
      render(
        <EmptyBlueprintState
          onInsertTemplate={onInsertTemplate}
          onError={vi.fn()}
          onStartFromScratch={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('template-card-click-navigate'));

      expect(onInsertTemplate).toHaveBeenCalledTimes(1);
      const arg = onInsertTemplate.mock.calls[0]?.[0] as EventBlueprint;
      expect(arg).toBeDefined();
      expect(arg.version).toBe(1);
      expect(arg.nodes).toHaveLength(2);
      expect(arg.edges).toHaveLength(1);
    });

    it('点击不同模板卡片调用 onInsertTemplate，传入不同蓝图', () => {
      const onInsertTemplate = vi.fn();
      render(
        <EmptyBlueprintState
          onInsertTemplate={onInsertTemplate}
          onError={vi.fn()}
          onStartFromScratch={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('template-card-click-navigate'));
      fireEvent.click(screen.getByTestId('template-card-page-load-refresh'));

      expect(onInsertTemplate).toHaveBeenCalledTimes(2);
      const bp1 = onInsertTemplate.mock.calls[0]?.[0] as EventBlueprint;
      const bp2 = onInsertTemplate.mock.calls[1]?.[0] as EventBlueprint;

      // 两个蓝图的 trigger config 不同（componentClick vs pageLoad）
      const trigger1 = bp1.nodes[0];
      const trigger2 = bp2.nodes[0];
      expect(trigger1?.kind).toBe('trigger');
      expect(trigger2?.kind).toBe('trigger');
      if (trigger1?.kind === 'trigger' && trigger2?.kind === 'trigger') {
        expect(trigger1.config.type).not.toBe(trigger2.config.type);
      }
    });
  });

  describe('点击模板卡片 - 校验失败路径', () => {
    it('buildValidatedTemplate 返回 failure 时调用 onError，不调用 onInsertTemplate', () => {
      // 注入失败结果
      vi.spyOn(buildModule, 'buildValidatedTemplate').mockReturnValue({
        success: false,
        error: '模拟校验失败',
      });

      const onInsertTemplate = vi.fn();
      const onError = vi.fn();
      render(
        <EmptyBlueprintState
          onInsertTemplate={onInsertTemplate}
          onError={onError}
          onStartFromScratch={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('template-card-click-navigate'));

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith('模拟校验失败');
      // 校验失败不应入栈（不调用 onInsertTemplate）
      expect(onInsertTemplate).not.toHaveBeenCalled();
    });
  });

  describe('点击"从空白开始"按钮', () => {
    it('点击调用 onStartFromScratch', () => {
      const onStartFromScratch = vi.fn();
      render(
        <EmptyBlueprintState
          onInsertTemplate={vi.fn()}
          onError={vi.fn()}
          onStartFromScratch={onStartFromScratch}
        />,
      );

      fireEvent.click(screen.getByTestId('empty-blueprint-start-from-scratch'));

      expect(onStartFromScratch).toHaveBeenCalledTimes(1);
    });

    it('点击"从空白开始"不触发模板插入', () => {
      const onInsertTemplate = vi.fn();
      const onError = vi.fn();
      render(
        <EmptyBlueprintState
          onInsertTemplate={onInsertTemplate}
          onError={onError}
          onStartFromScratch={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('empty-blueprint-start-from-scratch'));

      expect(onInsertTemplate).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
