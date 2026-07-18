/**
 * 保存冲突 AlertDialog
 *
 * 入口：保存 mutation 失败且错误为 SCREEN_SAVE_CONFLICT 业务码时打开（任务 9.3 接入）。
 *
 * 行为：
 * - 阻塞式 modal，用户必须选择"继续编辑"或"重新加载"。
 * - 选择"继续编辑"：保持本地未保存内容，基线不变，可继续编辑或重试保存。
 * - 选择"重新加载"：放弃本地未保存内容，从服务端拉取最新版本覆盖 Store。
 *
 * 注意：本组件仅负责 UI 与回调通知，不直接调用 mutation 或 store，
 * 保存 mutation 接入留给任务 9.3。
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

interface SaveConflictDialogProps {
  open: boolean;
  onReload: () => void;
  onCancel: () => void;
}

export function SaveConflictDialog({ open, onReload, onCancel }: SaveConflictDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>保存冲突</AlertDialogTitle>
          <AlertDialogDescription>
            项目已在其他窗口或会话中被修改。重新加载将放弃当前未保存内容。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onCancel()}>继续编辑</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // 阻止 AlertDialog 自动关闭，由父组件通过 open prop 控制关闭时机
              e.preventDefault();
              onReload();
            }}
          >
            重新加载
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
