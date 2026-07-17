/**
 * 事件蓝图 Sheet（占位骨架）
 *
 * 入口：项目菜单·工具 → "事件蓝图"
 *
 * v1 阶段仅提供入口与底部 Sheet 骨架，后续将集成可视化事件流编辑器
 * （节点拖拽、连线、属性配置等）。
 */

import { Workflow, AlertCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface EventBlueprintSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventBlueprintSheet({ open, onOpenChange }: EventBlueprintSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] sm:max-w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Workflow className="size-4" />
            事件蓝图
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-normal text-amber-600 dark:text-amber-400">
              Beta
            </span>
          </SheetTitle>
          <SheetDescription>可视化事件流编辑器（开发中）</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertCircle className="size-8 text-amber-500" />
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">功能开发中</div>
            <div className="mt-1 text-xs">
              该入口将在后续版本中提供节点式事件流编排能力， 支持组件间通信、状态联动与外部 API
              触发。
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
