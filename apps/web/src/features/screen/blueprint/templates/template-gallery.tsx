/**
 * 模板库卡片画廊（任务 9.3）
 *
 * 渲染 BLUEPRINT_TEMPLATES 中的三个模板为可点击卡片。
 * 点击卡片 → onSelect(templateId)，由调用方（EmptyBlueprintState）决定后续：
 * - 调用 buildValidatedTemplate(id)
 * - success → 调用 updateBlueprint 入栈一条历史
 * - failure → 不入栈，提示错误
 *
 * 不在此组件内做校验，保持组件纯展示职责单一。
 */

import type { JSX } from 'react';
import { BLUEPRINT_TEMPLATES } from './template-definitions';
import type { BlueprintTemplateId } from './template-definitions';

export interface TemplateGalleryProps {
  /** 模板被选中时调用，传入模板 id */
  onSelect: (templateId: BlueprintTemplateId) => void;
}

/**
 * 模板画廊：渲染所有可用模板为卡片网格。
 */
export function TemplateGallery({ onSelect }: TemplateGalleryProps): JSX.Element {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      role="list"
      data-testid="template-gallery"
    >
      {BLUEPRINT_TEMPLATES.map((template) => {
        const Icon = template.icon;
        return (
          <button
            key={template.id}
            type="button"
            role="listitem"
            onClick={() => onSelect(template.id)}
            data-testid={`template-card-${template.id}`}
            data-template-id={template.id}
            className="flex flex-col items-start gap-2 rounded-md border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">{template.name}</span>
              <span className="text-xs text-muted-foreground">{template.description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
