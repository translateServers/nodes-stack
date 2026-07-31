/**
 * JSON 导入 Dialog
 *
 * 入口：项目菜单·文件 → "导入 JSON..."
 *
 * 流程：
 * 1. 选择或拖拽 .json 文件
 * 2. 读取后用 ScreenProjectSchema 做 Zod 校验
 * 3. 显示预览（项目名/组件数/画布尺寸）
 * 4. 确认导入 → 调用 store.loadProject 替换当前项目（保留 URL 中的 id）
 *
 * 注意：导入会覆盖当前未保存内容，需用户先保存。
 */

import { useCallback, useId, useState } from 'react';
import { Upload, FileJson, AlertCircle } from 'lucide-react';
import { ScreenProjectSchema, type ScreenProject } from '@nebula/shared';
import {
  toScreenPublicError,
  type PreparedScreenImport,
  type ScreenHostController,
} from '@nebula/screen-editor-core/internal';
import { useScreenEditorStore } from '../stores/editor-store';
import { useScreenEditorNotifications } from './screen-editor-notifications';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@nebula/screen-editor-core/internal';
import { Button, Spinner } from '@nebula/screen-editor-core/internal';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前项目 ID（导入时保留，避免路由失配） */
  currentProjectId: string;
  hostController?: ScreenHostController;
  onConflict?: () => void;
}

interface ParsedPreview {
  canvasHeight: number;
  canvasWidth: number;
  componentCount: number;
  fileName: string;
  name: string;
  prepared?: PreparedScreenImport;
  project?: ScreenProject;
}

export function ImportDialog({
  open,
  onOpenChange,
  currentProjectId,
  hostController,
  onConflict,
}: ImportDialogProps) {
  const loadProject = useScreenEditorStore((s) => s.loadProject);
  const isDirty = useScreenEditorStore((s) => s.isDirty);
  const { notify } = useScreenEditorNotifications();
  const fileInputId = useId();
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setIsParsing(false);
    setIsDragging(false);
    setIsImporting(false);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (
        hostController === undefined &&
        !file.name.toLowerCase().endsWith('.json') &&
        file.type !== 'application/json'
      ) {
        setError('请选择 .json 文件');
        setPreview(null);
        return;
      }

      setIsParsing(true);
      setError(null);
      try {
        if (hostController !== undefined) {
          const prepared = await hostController.prepareImport(file);
          setPreview({
            fileName: file.name,
            name: prepared.preview.name,
            componentCount: prepared.preview.componentCount,
            canvasWidth: prepared.preview.canvasWidth,
            canvasHeight: prepared.preview.canvasHeight,
            prepared,
          });
          return;
        }
        const text = await file.text();
        const raw: unknown = JSON.parse(text);
        const parsed = ScreenProjectSchema.safeParse(raw);
        if (!parsed.success) {
          setError(`JSON 格式校验失败：${parsed.error.issues[0]?.message ?? '未知错误'}`);
          setPreview(null);
          return;
        }
        setPreview({
          project: parsed.data,
          fileName: file.name,
          name: parsed.data.name,
          componentCount: parsed.data.components.length,
          canvasWidth: parsed.data.canvas.width,
          canvasHeight: parsed.data.canvas.height,
        });
      } catch (e) {
        setError(
          hostController === undefined
            ? `解析失败：${e instanceof Error ? e.message : '未知错误'}`
            : toScreenPublicError(e).message,
        );
        setPreview(null);
      } finally {
        setIsParsing(false);
      }
    },
    [hostController],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      // 清空 input value 允许重复选择同一文件
      e.target.value = '';
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (!preview) return;
    if (hostController !== undefined && preview.prepared !== undefined) {
      setIsImporting(true);
      try {
        const envelope = await hostController.importProject(preview.prepared);
        notify('success', `已导入 ${envelope.name}`);
        onOpenChange(false);
        reset();
      } catch (importError) {
        const publicError = toScreenPublicError(importError);
        if (publicError.code === 'CONFLICT') {
          onOpenChange(false);
          reset();
          onConflict?.();
        } else {
          setError(publicError.message);
        }
      } finally {
        setIsImporting(false);
      }
      return;
    }
    if (preview.project === undefined) return;
    // 保留当前路由的 id，避免 URL 失配
    loadProject({ ...preview.project, id: currentProjectId });
    notify('success', `已导入 ${preview.project.name}`);
    onOpenChange(false);
    reset();
  }, [
    preview,
    hostController,
    loadProject,
    currentProjectId,
    notify,
    onOpenChange,
    onConflict,
    reset,
  ]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入 JSON</DialogTitle>
          <DialogDescription>
            {isDirty ? '导入将覆盖当前未保存内容，请确认后继续' : '选择 Nebula Screen JSON 文件'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 拖拽 / 选择区 */}
          <div
            className={`flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isParsing ? (
              <>
                <Spinner className="size-5" />
                <span>解析中...</span>
              </>
            ) : (
              <>
                <Upload className="size-5" />
                <span>点击选择或拖拽 .json 文件到此处</span>
              </>
            )}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleInputChange}
              // 用 label 触发更稳妥，这里用包裹式 label 替代会更优雅；为简洁起见用 ref-like 方式
              id={fileInputId}
            />
            <label
              htmlFor={fileInputId}
              className="cursor-pointer text-xs text-primary underline-offset-2 hover:underline"
            >
              浏览文件
            </label>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* 预览 */}
          {preview && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileJson className="size-4 text-muted-foreground" />
                {preview.fileName}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">项目名</dt>
                <dd className="text-foreground">{preview.name}</dd>
                <dt className="text-muted-foreground">组件数</dt>
                <dd className="text-foreground">{preview.componentCount}</dd>
                <dt className="text-muted-foreground">画布尺寸</dt>
                <dd className="text-foreground">
                  {preview.canvasWidth} × {preview.canvasHeight}
                </dd>
              </dl>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!preview || isParsing || isImporting}
          >
            {isImporting ? '导入中...' : '确认导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
