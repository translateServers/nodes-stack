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

import { useCallback, useState } from 'react';
import { Upload, FileJson, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ScreenProjectSchema, type ScreenProject } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前项目 ID（导入时保留，避免路由失配） */
  currentProjectId: string;
}

interface ParsedPreview {
  project: ScreenProject;
  fileName: string;
}

export function ImportDialog({ open, onOpenChange, currentProjectId }: ImportDialogProps) {
  const loadProject = useScreenEditorStore((s) => s.loadProject);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setIsParsing(false);
    setIsDragging(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError('请选择 .json 文件');
      setPreview(null);
      return;
    }

    setIsParsing(true);
    setError(null);
    try {
      const text = await file.text();
      const raw: unknown = JSON.parse(text);
      const parsed = ScreenProjectSchema.safeParse(raw);
      if (!parsed.success) {
        setError(`JSON 格式校验失败：${parsed.error.issues[0]?.message ?? '未知错误'}`);
        setPreview(null);
        return;
      }
      setPreview({ project: parsed.data, fileName: file.name });
    } catch (e) {
      setError(`解析失败：${e instanceof Error ? e.message : '未知错误'}`);
      setPreview(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

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

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    // 保留当前路由的 id，避免 URL 失配
    loadProject({ ...preview.project, id: currentProjectId });
    toast.success(`已导入 ${preview.project.name}`);
    onOpenChange(false);
    reset();
  }, [preview, loadProject, currentProjectId, onOpenChange, reset]);

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
          <DialogDescription>导入会覆盖当前项目内容，请先保存未提交的修改</DialogDescription>
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
              id="import-file-input"
            />
            <label
              htmlFor="import-file-input"
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
                <dd className="text-foreground">{preview.project.name}</dd>
                <dt className="text-muted-foreground">组件数</dt>
                <dd className="text-foreground">{preview.project.components.length}</dd>
                <dt className="text-muted-foreground">画布尺寸</dt>
                <dd className="text-foreground">
                  {preview.project.canvas.width} × {preview.project.canvas.height}
                </dd>
              </dl>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!preview || isParsing}>
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
