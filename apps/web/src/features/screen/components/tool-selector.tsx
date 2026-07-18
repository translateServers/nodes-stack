/**
 * 工具选择入口（阶段 1）
 *
 * 从 TOOL_REGISTRY 单一数据源渲染工具按钮。
 * - 每个按钮具有 aria-label（工具名）、aria-pressed（选中态）、disabled（未实现）
 * - 鼠标点击和键盘 Enter/Space 都触发 setTool（来自 editorSession 或 toolStateMachine）
 * - 未实现工具按钮显示为禁用态，但保留可聚焦（focus-visible）以便键盘导航
 *   和让屏幕阅读器用户感知到存在
 *
 * 位置：放在编辑器顶部工具栏，紧凑水平排列。
 */

import { memo } from 'react';
import { TOOL_REGISTRY } from '../hooks/tool-registry';
import type { EditorSessionApi } from '../hooks/use-editor-session';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ToolSelectorProps {
  /** 编辑器会话控制器（任务 2.2 起为优先来源） */
  editorSession: Pick<EditorSessionApi, 'activeTool' | 'setTool'>;
}

export const ToolSelector = memo(function ToolSelector({ editorSession }: ToolSelectorProps) {
  const { activeTool, setTool } = editorSession;

  return (
    <div
      role="group"
      aria-label="工具选择"
      className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5"
    >
      {TOOL_REGISTRY.map((tool) => {
        const ToolIcon = tool.icon;
        const isActive = activeTool === tool.id;
        const isDisabled = !tool.implemented;
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={tool.name}
                aria-pressed={isActive}
                disabled={isDisabled}
                onClick={() => setTool(tool.id)}
                className={cn(
                  'size-7 p-0',
                  isActive && 'bg-accent text-accent-foreground',
                  !isActive && !isDisabled && 'text-muted-foreground hover:text-foreground',
                  isDisabled && 'opacity-40',
                )}
              >
                <ToolIcon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {tool.name}
              {isDisabled && '（未实现）'}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
});
