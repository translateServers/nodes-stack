/**
 * 代码编辑 Sheet（占位骨架）
 *
 * 入口：项目菜单·工具 → "代码编辑"
 *
 * v1 阶段仅提供入口与底部 Sheet 骨架，后续将集成 Monaco/CodeMirror 编辑器，
 * 支持直接编辑项目 JSON、自定义脚本、样式覆盖等。
 */

import { Code2, AlertCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface CodeEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CodeEditorSheet({ open, onOpenChange }: CodeEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] sm:max-w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Code2 className="size-4" />
            代码编辑
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-normal text-amber-600 dark:text-amber-400">
              Beta
            </span>
          </SheetTitle>
          <SheetDescription>项目 JSON 与自定义脚本编辑器（开发中）</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertCircle className="size-8 text-amber-500" />
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">功能开发中</div>
            <div className="mt-1 text-xs">
              该入口将在后续版本中提供 Monaco 编辑器集成， 支持直接编辑项目
              JSON、自定义脚本与样式覆盖。
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
