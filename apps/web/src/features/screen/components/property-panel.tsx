import { useCallback } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';
import type { ScreenComponent, CanvasConfig } from '@nebula/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** 与 Input 同款样式的 textarea，项目暂无 Textarea shadcn 组件，本地复用样式 */
const textareaClass =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';

function NumberInput({
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
      <label className="w-12 shrink-0 text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        className="h-7 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function TextInput({
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
      <label className="w-12 shrink-0 text-xs text-muted-foreground">{label}</label>
      <Input
        type="text"
        className="h-7 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ColorInput({
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
      <label className="w-12 shrink-0 text-xs text-muted-foreground">{label}</label>
      <input
        type="color"
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-input bg-card"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <Input
        type="text"
        className="h-7 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PositionFields({
  component,
  onUpdate,
}: {
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const { position } = component;
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">位置与尺寸</div>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="X"
          value={position.x}
          onChange={(v) => onUpdate({ position: { ...position, x: v } })}
        />
        <NumberInput
          label="Y"
          value={position.y}
          onChange={(v) => onUpdate({ position: { ...position, y: v } })}
        />
        <NumberInput
          label="宽"
          value={position.width}
          onChange={(v) => onUpdate({ position: { ...position, width: v } })}
        />
        <NumberInput
          label="高"
          value={position.height}
          onChange={(v) => onUpdate({ position: { ...position, height: v } })}
        />
        {position.rotation != null && position.rotation !== 0 && (
          <NumberInput
            label="旋转"
            value={position.rotation}
            onChange={(v) => onUpdate({ position: { ...position, rotation: v } })}
          />
        )}
      </div>
    </div>
  );
}

function StyleFields({
  component,
  onUpdate,
}: {
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const { style } = component;
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">样式</div>
      <ColorInput
        label="背景"
        value={style.backgroundColor ?? '#ffffff'}
        onChange={(v) => onUpdate({ style: { ...style, backgroundColor: v } })}
      />
      <NumberInput
        label="透明度"
        value={style.opacity ?? 1}
        onChange={(v) => onUpdate({ style: { ...style, opacity: Math.min(1, Math.max(0, v)) } })}
      />
      <NumberInput
        label="边框"
        value={style.borderWidth ?? 0}
        onChange={(v) => onUpdate({ style: { ...style, borderWidth: v } })}
      />
      <ColorInput
        label="边框色"
        value={style.borderColor ?? '#000000'}
        onChange={(v) => onUpdate({ style: { ...style, borderColor: v } })}
      />
      <NumberInput
        label="圆角"
        value={style.borderRadius ?? 0}
        onChange={(v) => onUpdate({ style: { ...style, borderRadius: v } })}
      />
    </div>
  );
}

function TextPropsFields({
  component,
  onUpdate,
}: {
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const { props, style } = component;
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">文本属性</div>
      <div className="flex items-center gap-2">
        <label className="w-12 shrink-0 text-xs text-muted-foreground">内容</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={(props.content as string) ?? ''}
          onChange={(e) => onUpdate({ props: { ...props, content: e.target.value } })}
        />
      </div>
      <NumberInput
        label="字号"
        value={style.fontSize ?? 14}
        onChange={(v) => onUpdate({ style: { ...style, fontSize: v } })}
      />
      <ColorInput
        label="字色"
        value={style.color ?? '#ffffff'}
        onChange={(v) => onUpdate({ style: { ...style, color: v } })}
      />
    </div>
  );
}

function BarChartPropsFields({
  component,
  onUpdate,
}: {
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const { props } = component;
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">图表属性</div>
      <TextInput
        label="标题"
        value={(props.title as string) ?? ''}
        onChange={(v) => onUpdate({ props: { ...props, title: v } })}
      />
      <div className="flex items-center gap-2">
        <label className="w-12 shrink-0 text-xs text-muted-foreground">数据</label>
        <textarea
          className={`${textareaClass} font-mono text-xs`}
          rows={6}
          value={JSON.stringify(props.data ?? [], null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onUpdate({ props: { ...props, data: parsed } });
            } catch {
              // ignore invalid JSON during editing
            }
          }}
        />
      </div>
    </div>
  );
}

function CanvasSettingsFields({
  canvas,
  onUpdate,
}: {
  canvas: CanvasConfig;
  onUpdate: (updates: Partial<CanvasConfig>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">画布设置</div>
      <NumberInput label="宽度" value={canvas.width} onChange={(v) => onUpdate({ width: v })} />
      <NumberInput label="高度" value={canvas.height} onChange={(v) => onUpdate({ height: v })} />
      <ColorInput
        label="背景"
        value={canvas.backgroundColor}
        onChange={(v) => onUpdate({ backgroundColor: v })}
      />
      <div className="flex items-center gap-2">
        <label className="w-12 shrink-0 text-xs text-muted-foreground">缩放</label>
        <Select
          value={canvas.scaleMode}
          onValueChange={(v) => onUpdate({ scaleMode: v as CanvasConfig['scaleMode'] })}
        >
          <SelectTrigger size="sm" className="h-7 w-full text-sm">
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
    </div>
  );
}

function MultiSelectPanel({ selectedIds }: { selectedIds: string[] }) {
  const project = useScreenEditorStore((s) => s.project);
  const removeSelectedComponents = useScreenEditorStore((s) => s.removeSelectedComponents);
  const updateComponentsBatch = useScreenEditorStore((s) => s.updateComponentsBatch);

  if (!project) return null;

  const selectedComponents = selectedIds
    .map((id: string) => project.components.find((c: ScreenComponent) => c.id === id))
    .filter((c): c is ScreenComponent => c != null);

  const alignHorizontal = (alignment: 'left' | 'center' | 'right') => {
    if (selectedComponents.length < 2) return;
    const xs = selectedComponents.map((c) => c.position.x);
    const rights = selectedComponents.map((c) => c.position.x + c.position.width);
    const minX = Math.min(...xs);
    const maxRight = Math.max(...rights);
    const centerX = (minX + maxRight) / 2;

    const updates = selectedComponents.map((c) => {
      let x = c.position.x;
      if (alignment === 'left') x = minX;
      else if (alignment === 'right') x = maxRight - c.position.width;
      else x = centerX - c.position.width / 2;
      return { id: c.id, changes: { position: { ...c.position, x: Math.round(x) } } };
    });
    updateComponentsBatch(updates);
  };

  const alignVertical = (alignment: 'top' | 'middle' | 'bottom') => {
    if (selectedComponents.length < 2) return;
    const ys = selectedComponents.map((c) => c.position.y);
    const bottoms = selectedComponents.map((c) => c.position.y + c.position.height);
    const minY = Math.min(...ys);
    const maxBottom = Math.max(...bottoms);
    const centerY = (minY + maxBottom) / 2;

    const updates = selectedComponents.map((c) => {
      let y = c.position.y;
      if (alignment === 'top') y = minY;
      else if (alignment === 'bottom') y = maxBottom - c.position.height;
      else y = centerY - c.position.height / 2;
      return { id: c.id, changes: { position: { ...c.position, y: Math.round(y) } } };
    });
    updateComponentsBatch(updates);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">已选中 {selectedIds.length} 个组件</div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-foreground">对齐</div>
          <div className="grid grid-cols-6 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="左对齐"
                  onClick={() => alignHorizontal('left')}
                >
                  <AlignLeft />
                </Button>
              </TooltipTrigger>
              <TooltipContent>左对齐</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="水平居中"
                  onClick={() => alignHorizontal('center')}
                >
                  <AlignCenter />
                </Button>
              </TooltipTrigger>
              <TooltipContent>水平居中</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="右对齐"
                  onClick={() => alignHorizontal('right')}
                >
                  <AlignRight />
                </Button>
              </TooltipTrigger>
              <TooltipContent>右对齐</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="顶对齐"
                  onClick={() => alignVertical('top')}
                >
                  <AlignStartVertical />
                </Button>
              </TooltipTrigger>
              <TooltipContent>顶对齐</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="垂直居中"
                  onClick={() => alignVertical('middle')}
                >
                  <AlignCenterVertical />
                </Button>
              </TooltipTrigger>
              <TooltipContent>垂直居中</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="底对齐"
                  onClick={() => alignVertical('bottom')}
                >
                  <AlignEndVertical />
                </Button>
              </TooltipTrigger>
              <TooltipContent>底对齐</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <Button variant="destructive" className="w-full" onClick={removeSelectedComponents}>
            删除选中 ({selectedIds.length})
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function PropertyPanel() {
  const project = useScreenEditorStore((s) => s.project);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const updateComponent = useScreenEditorStore((s) => s.updateComponent);
  const updateCanvas = useScreenEditorStore((s) => s.updateCanvas);
  const removeComponent = useScreenEditorStore((s) => s.removeComponent);

  const selectedComponent =
    selectedComponentIds.length === 1
      ? project?.components.find((c: ScreenComponent) => c.id === selectedComponentIds[0])
      : undefined;

  const handleComponentUpdate = useCallback(
    (updates: Partial<ScreenComponent>) => {
      if (selectedComponentIds.length === 1) {
        updateComponent(selectedComponentIds[0], updates);
      }
    },
    [selectedComponentIds, updateComponent],
  );

  if (!project) return null;

  const isMultiSelect = selectedComponentIds.length > 1;

  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-card text-foreground">
      <div className="border-b border-border px-4 py-3 font-medium">
        {selectedComponent
          ? selectedComponent.name
          : isMultiSelect
            ? `多选 (${selectedComponentIds.length})`
            : '属性'}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {selectedComponent ? (
          <>
            <PositionFields component={selectedComponent} onUpdate={handleComponentUpdate} />
            <StyleFields component={selectedComponent} onUpdate={handleComponentUpdate} />
            {selectedComponent.type === 'text' && (
              <TextPropsFields component={selectedComponent} onUpdate={handleComponentUpdate} />
            )}
            {selectedComponent.type === 'bar-chart' && (
              <BarChartPropsFields component={selectedComponent} onUpdate={handleComponentUpdate} />
            )}
            <div className="border-t border-border pt-3">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => removeComponent(selectedComponent.id)}
              >
                删除组件
              </Button>
            </div>
          </>
        ) : isMultiSelect ? (
          <MultiSelectPanel selectedIds={selectedComponentIds} />
        ) : (
          <CanvasSettingsFields canvas={project.canvas} onUpdate={updateCanvas} />
        )}
      </div>
    </div>
  );
}
