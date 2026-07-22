/**
 * 发布确认 AlertDialog（任务 5.3）
 *
 * 入口：发布前蓝图编译存在 error 级诊断时打开。
 *
 * 行为：
 * - 阻塞式 modal，展示 error 级诊断摘要（数量 + 列表）。
 * - 选择"仍然发布"：忽略诊断继续发布。
 * - 选择"取消"：放弃本次发布，返回编辑器。
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Diagnostic } from '../blueprint/compiler';

interface PublishConfirmDialogProps {
  open: boolean;
  diagnostics: Diagnostic[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function PublishConfirmDialog({
  open,
  diagnostics,
  onConfirm,
  onCancel,
}: PublishConfirmDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>蓝图存在错误</AlertDialogTitle>
          <AlertDialogDescription>
            蓝图编译发现 {diagnostics.length} 个错误，发布后相关规则可能无法正常执行。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-destructive">
          {diagnostics.map((d, i) => (
            <li key={`${d.code}-${d.nodeId ?? d.edgeId ?? i}`}>{d.message}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onCancel()}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            仍然发布
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
