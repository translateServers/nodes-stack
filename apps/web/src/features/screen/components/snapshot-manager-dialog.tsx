/**
 * 本地快照管理 Dialog
 *
 * 入口：项目菜单·文件 → "本地快照管理..."
 *
 * 功能：
 * - 顶部：创建快照 / 清空全部
 * - 列表：每条显示时间戳 + 组件数 + 画布尺寸 + 恢复/删除操作
 * - 恢复时二次确认（会覆盖当前未保存内容）
 *
 * 数据存储在 localStorage，与服务端保存隔离。
 */

import { useCallback, useState } from 'react';
import { History, RotateCcw, Trash2, Plus, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useScreenEditorStore } from '../stores/editor-store';
import { useLocalSnapshots, type SnapshotMeta } from '../hooks/use-local-snapshots';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface SnapshotManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | undefined;
}

/** 格式化时间戳为本地可读字符串 */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SnapshotManagerDialog({
  open,
  onOpenChange,
  projectId,
}: SnapshotManagerDialogProps) {
  const storeProject = useScreenEditorStore((s) => s.project);
  const loadProject = useScreenEditorStore((s) => s.loadProject);
  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot, clearAllSnapshots } =
    useLocalSnapshots(projectId);

  // 待确认的恢复目标（null 表示无 AlertDialog 显示）
  const [pendingRestore, setPendingRestore] = useState<SnapshotMeta | null>(null);
  // 清空全部确认
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleCreate = useCallback(() => {
    if (!storeProject) return;
    try {
      createSnapshot(storeProject);
      toast.success('已创建本地快照');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '快照创建失败');
    }
  }, [storeProject, createSnapshot]);

  const handleRestoreConfirm = useCallback(() => {
    if (!pendingRestore) return;
    const data = restoreSnapshot(pendingRestore.timestamp);
    if (!data) {
      toast.error('快照数据已损坏或被删除');
      setPendingRestore(null);
      return;
    }
    loadProject(data);
    toast.success(`已恢复至 ${formatTimestamp(pendingRestore.timestamp)} 的快照`);
    setPendingRestore(null);
    onOpenChange(false);
  }, [pendingRestore, restoreSnapshot, loadProject, onOpenChange]);

  const handleDelete = useCallback(
    (ts: number) => {
      deleteSnapshot(ts);
      toast.success('快照已删除');
    },
    [deleteSnapshot],
  );

  const handleClearAll = useCallback(() => {
    clearAllSnapshots();
    setShowClearConfirm(false);
    toast.success('已清空所有本地快照');
  }, [clearAllSnapshots]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>本地快照管理</DialogTitle>
            <DialogDescription>
              快照保存在浏览器本地，与服务端保存隔离。最多保留 20 条，超出自动删除最旧。
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!storeProject}>
              <Plus className="size-3.5" />
              创建快照
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowClearConfirm(true)}
              disabled={snapshots.length === 0}
            >
              <Trash2 className="size-3.5" />
              清空全部
            </Button>
          </div>

          <Separator />

          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Inbox className="size-8" />
                <span className="text-xs">暂无本地快照</span>
              </div>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.timestamp}
                  className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-xs transition-colors hover:bg-accent/50"
                >
                  <History className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-foreground">
                      {formatTimestamp(snap.timestamp)}
                    </div>
                    <div className="text-muted-foreground">
                      {snap.componentCount} 个组件 · {snap.canvasWidth}×{snap.canvasHeight}
                    </div>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="恢复快照"
                    onClick={() => setPendingRestore(snap)}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="删除快照"
                    onClick={() => handleDelete(snap.timestamp)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 恢复确认 */}
      <AlertDialog
        open={pendingRestore !== null}
        onOpenChange={(v) => !v && setPendingRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复快照</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRestore &&
                `将覆盖当前未保存内容，恢复至 ${formatTimestamp(pendingRestore.timestamp)} 的快照。此操作不可撤销，建议先保存当前修改。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>确认恢复</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清空全部确认 */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空所有快照</AlertDialogTitle>
            <AlertDialogDescription>
              将删除该项目的全部 {snapshots.length} 条本地快照，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleClearAll}>
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
