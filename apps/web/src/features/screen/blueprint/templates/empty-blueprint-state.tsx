/**
 * 空蓝图引导态（任务 9.3）
 *
 * 当蓝图为空（无节点）时显示：
 * - 引导文案
 * - 模板画廊（TemplateGallery）：3 个一键模板
 * - "从空白开始"按钮：调用 onStartFromScratch（创建空蓝图状态供用户自由编排）
 *
 * 模板选择流程：
 * 1. 用户点击模板卡片 → onSelect(templateId)
 * 2. 本组件调用 buildValidatedTemplate(id) 校验
 * 3. success → 调用 onInsertTemplate(blueprint)（由调用方调 updateBlueprint 入栈一条历史）
 * 4. failure → 调用 onError(error)（不入栈，由调用方提示用户）
 *
 * 设计理由：将"校验 → 入栈/不入栈"分支决策收口在此组件，
 * TemplateGallery 保持纯展示，调用方 Sheet 只需提供 onInsertTemplate/onError/onStartFromScratch。
 */

import { useCallback } from 'react';
import type { JSX } from 'react';
import { Sparkles, SquarePen } from 'lucide-react';
import type { EventBlueprint } from '@nebula/shared';
import { TemplateGallery } from './template-gallery';
import { buildValidatedTemplate } from './build-validated-template';
import type { BlueprintTemplateId } from './template-definitions';

export interface EmptyBlueprintStateProps {
  /** 模板校验通过时调用，传入完整蓝图（调用方 updateBlueprint 入栈一条历史） */
  onInsertTemplate: (blueprint: EventBlueprint) => void;
  /** 模板校验失败时调用，传入错误信息（调用方提示用户，不入栈） */
  onError: (error: string) => void;
  /** "从空白开始"按钮点击（调用方创建空蓝图状态进入自由编排） */
  onStartFromScratch: () => void;
}

/**
 * 空蓝图引导态：标题 + 描述 + 模板画廊 + 从空白开始按钮。
 */
export function EmptyBlueprintState({
  onInsertTemplate,
  onError,
  onStartFromScratch,
}: EmptyBlueprintStateProps): JSX.Element {
  const handleSelectTemplate = useCallback(
    (templateId: BlueprintTemplateId): void => {
      const result = buildValidatedTemplate(templateId);
      if (result.success) {
        onInsertTemplate(result.blueprint);
      } else {
        onError(result.error);
      }
    },
    [onInsertTemplate, onError],
  );

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-6 p-8"
      data-testid="empty-blueprint-state"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">从模板开始</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          选择一个常用模板快速开始，或从空白画布自由编排你的事件蓝图。
        </p>
      </div>

      <TemplateGallery onSelect={handleSelectTemplate} />

      <button
        type="button"
        onClick={onStartFromScratch}
        data-testid="empty-blueprint-start-from-scratch"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SquarePen className="h-4 w-4" />
        从空白开始
      </button>
    </div>
  );
}
