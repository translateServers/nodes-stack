/**
 * 画布设置 Dialog
 *
 * 入口：项目菜单·视图 → "画布设置..." / 画布右键菜单 → "画布设置..."
 *
 * 编辑画布的尺寸/背景色/背景图/缩放模式，确认后通过 store.updateCanvas 提交。
 * 编辑过程中维护本地副本，避免直接修改 store 导致每次按键都触发画布重渲染。
 */

import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { CanvasConfig } from '@nebula/shared';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CanvasSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 数字输入字段：标签 + Input[number] */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-14 shrink-0 text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        className="h-8 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** 颜色字段：标签 + 原生 color picker + 文本输入 */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-14 shrink-0 text-xs text-muted-foreground">{label}</label>
      <input
        type="color"
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-input bg-card"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <Input
        type="text"
        className="h-8 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function CanvasSettingsDialog({ open, onOpenChange }: CanvasSettingsDialogProps) {
  const canvas = useScreenEditorStore((s) => s.project?.canvas);
  const updateCanvas = useScreenEditorStore((s) => s.updateCanvas);
  // 网格吸附为会话级配置（不入项目持久化），直接读写 store，无需 draft
  const gridEnabled = useScreenEditorStore((s) => s.gridEnabled);
  const gridSize = useScreenEditorStore((s) => s.gridSize);
  const setGridEnabled = useScreenEditorStore((s) => s.setGridEnabled);
  const setGridSize = useScreenEditorStore((s) => s.setGridSize);

  // 本地副本：仅在 open 切换为 true 时同步 store
  const [draft, setDraft] = useState<CanvasConfig | null>(null);

  useEffect(() => {
    if (open && canvas) {
      setDraft({ ...canvas });
    }
  }, [open, canvas]);

  if (!canvas || !draft) {
    return null;
  }

  const handleField = (updates: Partial<CanvasConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const handleConfirm = () => {
    updateCanvas({
      width: Math.max(1, Math.floor(draft.width)),
      height: Math.max(1, Math.floor(draft.height)),
      backgroundColor: draft.backgroundColor,
      backgroundImage: draft.backgroundImage,
      scaleMode: draft.scaleMode,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>画布设置</DialogTitle>
          <DialogDescription>调整画布尺寸、背景与缩放模式</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="宽度"
              value={draft.width}
              onChange={(v) => handleField({ width: v })}
            />
            <NumberField
              label="高度"
              value={draft.height}
              onChange={(v) => handleField({ height: v })}
            />
          </div>

          <ColorField
            label="背景色"
            value={draft.backgroundColor}
            onChange={(v) => handleField({ backgroundColor: v })}
          />

          <div className="flex items-center gap-2">
            <label className="w-14 shrink-0 text-xs text-muted-foreground">背景图</label>
            <div className="relative flex-1">
              <ImageIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="可选，输入图片 URL"
                className="h-8 px-2 py-1 pl-7 text-sm"
                value={draft.backgroundImage ?? ''}
                onChange={(e) => handleField({ backgroundImage: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="w-14 shrink-0 text-xs text-muted-foreground">缩放</label>
            <Select
              value={draft.scaleMode}
              onValueChange={(v) => handleField({ scaleMode: v as CanvasConfig['scaleMode'] })}
            >
              <SelectTrigger size="sm" className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fit">等比缩放</SelectItem>
                <SelectItem value="full">拉伸铺满</SelectItem>
                <SelectItem value="width">宽度铺满</SelectItem>
                <SelectItem value="height">高度铺满</SelectItem>
                <SelectItem value="none">原始尺寸</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 网格吸附：会话级配置，直接读写 store，无需 draft */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="grid-enabled" className="text-sm">
                网格吸附
              </Label>
              <Switch
                id="grid-enabled"
                checked={gridEnabled}
                onCheckedChange={(checked) => setGridEnabled(checked === true)}
              />
            </div>
            <div
              className={`flex items-center gap-2 transition-opacity ${
                gridEnabled ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <label className="w-14 shrink-0 text-xs text-muted-foreground">网格大小</label>
              <Input
                type="number"
                min={1}
                className="h-8 px-2 py-1 text-sm"
                value={gridSize}
                disabled={!gridEnabled}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 1) setGridSize(Math.floor(v));
                }}
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>应用</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
