import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Inbox, LoaderCircle, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { ScreenSnapshotHostAdapter } from '../adapters/screen-editor-host-adapter';
import {
  toScreenPublicError,
  type ScreenSnapshotSummary,
} from '@nebula/screen-editor-core/internal';
import type { ScreenHostControllerPort } from '../host/screen-host-controller-port.js';
import type { ScreenHostController } from '@nebula/screen-editor-core/internal';
import { useScreenEditorStore } from '../stores/editor-store';
import { useScreenEditorNotifications } from './screen-editor-notifications';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@nebula/screen-editor-core/internal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nebula/screen-editor-core/internal';
import { Button, Separator } from '@nebula/screen-editor-core/internal';

interface SnapshotManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  adapter?: ScreenSnapshotHostAdapter;
  hostController?: ScreenHostControllerPort | ScreenHostController;
  onConflict?: () => void;
  readonly?: boolean;
}

type SnapshotOperation = 'list' | 'create' | 'restore' | 'remove' | 'clear';

function formatCreatedAt(createdAt: string): string {
  return new Date(createdAt).toLocaleString('zh-CN', {
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
  adapter,
  hostController,
  onConflict,
  readonly = false,
}: SnapshotManagerDialogProps) {
  const storeProject = useScreenEditorStore((s) => s.project);
  const loadProject = useScreenEditorStore((s) => s.loadProject);
  const { notify } = useScreenEditorNotifications();
  const [snapshots, setSnapshots] = useState<ScreenSnapshotSummary[]>([]);
  const [operation, setOperation] = useState<SnapshotOperation | null>(null);
  const [pendingRestore, setPendingRestore] = useState<ScreenSnapshotSummary | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const operationControllerRef = useRef<AbortController | null>(null);

  const showOperationError = useCallback(
    (error: unknown, fallback: string): void => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const publicError = hostController === undefined ? undefined : toScreenPublicError(error);
      if (publicError?.code === 'ABORTED') return;
      if (publicError?.code === 'CONFLICT') {
        setPendingRestore(null);
        onOpenChange(false);
        onConflict?.();
        return;
      }
      notify(
        'error',
        hostController === undefined
          ? error instanceof Error
            ? error.message
            : fallback
          : (publicError?.message ?? fallback),
      );
    },
    [hostController, notify, onConflict, onOpenChange],
  );

  const beginOperation = useCallback((nextOperation: SnapshotOperation): AbortController => {
    operationControllerRef.current?.abort();
    const controller = new AbortController();
    operationControllerRef.current = controller;
    setOperation(nextOperation);
    return controller;
  }, []);

  const finishOperation = useCallback((controller: AbortController): void => {
    if (operationControllerRef.current !== controller) return;
    operationControllerRef.current = null;
    setOperation(null);
  }, []);

  const cancelPendingOperations = useCallback((): void => {
    operationControllerRef.current?.abort();
    hostController?.cancelSnapshotList();
    hostController?.cancelSnapshotMutations();
  }, [hostController]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) cancelPendingOperations();
      onOpenChange(nextOpen);
    },
    [cancelPendingOperations, onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    setSnapshots([]);
    const controller = beginOperation('list');
    const listPromise =
      hostController?.listSnapshots() ?? adapter?.list({ projectId, signal: controller.signal });
    if (listPromise === undefined) return;
    void listPromise
      .then((nextSnapshots) => {
        if (!controller.signal.aborted) setSnapshots(nextSnapshots);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) showOperationError(error, '快照列表加载失败');
      })
      .finally(() => finishOperation(controller));

    return () => {
      controller.abort();
      hostController?.cancelSnapshotList();
    };
  }, [
    adapter,
    beginOperation,
    finishOperation,
    hostController,
    open,
    projectId,
    showOperationError,
  ]);

  useEffect(() => {
    return cancelPendingOperations;
  }, [cancelPendingOperations]);

  useEffect(() => {
    if (open) return;
    cancelPendingOperations();
  }, [cancelPendingOperations, open]);

  const handleCreate = useCallback(async (): Promise<void> => {
    if (!storeProject) return;
    const controller = beginOperation('create');
    try {
      const snapshot =
        hostController === undefined
          ? await adapter?.create({
              projectId,
              revision: storeProject.updatedAt,
              project: structuredClone(storeProject),
              signal: controller.signal,
            })
          : await hostController.createSnapshot();
      if (snapshot === undefined) return;
      if (controller.signal.aborted) return;
      setSnapshots((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)]);
      notify('success', '已创建快照');
    } catch (error) {
      if (!controller.signal.aborted) showOperationError(error, '快照创建失败');
    } finally {
      finishOperation(controller);
    }
  }, [
    adapter,
    beginOperation,
    finishOperation,
    hostController,
    notify,
    projectId,
    showOperationError,
    storeProject,
  ]);

  const handleRestoreConfirm = useCallback(async (): Promise<void> => {
    if (!pendingRestore || !storeProject) return;
    const controller = beginOperation('restore');
    try {
      if (hostController === undefined) {
        const project = await adapter?.restore({
          projectId,
          snapshotId: pendingRestore.id,
          revision: storeProject.updatedAt,
          signal: controller.signal,
        });
        if (project === undefined) return;
        if (controller.signal.aborted) return;
        loadProject(project);
      } else {
        await hostController.restoreSnapshot(pendingRestore.id);
      }
      if (controller.signal.aborted) return;
      notify('success', `已恢复至 ${formatCreatedAt(pendingRestore.createdAt)} 的快照`);
      setPendingRestore(null);
      onOpenChange(false);
    } catch (error) {
      if (!controller.signal.aborted) showOperationError(error, '快照恢复失败');
    } finally {
      finishOperation(controller);
    }
  }, [
    adapter,
    beginOperation,
    finishOperation,
    hostController,
    loadProject,
    notify,
    onOpenChange,
    pendingRestore,
    projectId,
    showOperationError,
    storeProject,
  ]);

  const handleDelete = useCallback(
    async (snapshotId: string): Promise<void> => {
      const controller = beginOperation('remove');
      try {
        if (hostController === undefined) {
          await adapter?.remove({ projectId, snapshotId, signal: controller.signal });
        } else {
          await hostController.removeSnapshot(snapshotId);
        }
        if (controller.signal.aborted) return;
        setSnapshots((current) => current.filter((snapshot) => snapshot.id !== snapshotId));
        notify('success', '快照已删除');
      } catch (error) {
        if (!controller.signal.aborted) showOperationError(error, '快照删除失败');
      } finally {
        finishOperation(controller);
      }
    },
    [
      adapter,
      beginOperation,
      finishOperation,
      hostController,
      notify,
      projectId,
      showOperationError,
    ],
  );

  const handleClearAll = useCallback(async (): Promise<void> => {
    const controller = beginOperation('clear');
    try {
      if (hostController === undefined) {
        await adapter?.clear({ projectId, signal: controller.signal });
      } else {
        await hostController.clearSnapshots();
      }
      if (controller.signal.aborted) return;
      setSnapshots([]);
      setShowClearConfirm(false);
      notify('success', '已清空所有快照');
    } catch (error) {
      if (!controller.signal.aborted) showOperationError(error, '快照清空失败');
    } finally {
      finishOperation(controller);
    }
  }, [
    adapter,
    beginOperation,
    finishOperation,
    hostController,
    notify,
    projectId,
    showOperationError,
  ]);

  const isBusy = operation !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>快照管理</DialogTitle>
            <DialogDescription>快照由当前宿主提供，可用于保存和恢复编辑状态。</DialogDescription>
          </DialogHeader>

          {!readonly && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => void handleCreate()}
                disabled={!storeProject || isBusy}
              >
                {operation === 'create' ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                创建快照
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowClearConfirm(true)}
                disabled={snapshots.length === 0 || isBusy}
              >
                <Trash2 className="size-3.5" />
                清空全部
              </Button>
            </div>
          )}

          <Separator />

          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {operation === 'list' ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                正在加载快照...
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Inbox className="size-8" />
                <span className="text-xs">暂无快照</span>
              </div>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-xs transition-colors hover:bg-accent/50"
                >
                  <History className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-foreground">
                      {formatCreatedAt(snap.createdAt)}
                    </div>
                    <div className="text-muted-foreground">
                      {snap.componentCount} 个组件 · {snap.canvasWidth}×{snap.canvasHeight}
                    </div>
                  </div>
                  {!readonly && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="恢复快照"
                      onClick={() => setPendingRestore(snap)}
                      disabled={isBusy}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  )}
                  {!readonly && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="删除快照"
                      onClick={() => void handleDelete(snap.id)}
                      disabled={isBusy}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
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
                `将覆盖当前未保存内容，恢复至 ${formatCreatedAt(pendingRestore.createdAt)} 的快照。此操作不可撤销，建议先保存当前修改。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRestoreConfirm()} disabled={isBusy}>
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清空全部确认 */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空所有快照</AlertDialogTitle>
            <AlertDialogDescription>
              将删除该项目的全部 {snapshots.length} 条快照，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleClearAll()}
              disabled={isBusy}
            >
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
