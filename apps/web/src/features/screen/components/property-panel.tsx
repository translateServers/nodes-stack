import { useCallback, useMemo } from 'react';
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
// 数值字段统一使用 PS 风格 NumberInput（↑↓ 微调 + draft 提交，避免每次按键入历史栈）
import { NumberInput } from './number-input';

/** 属性面板内数值字段的统一样式（与新 NumberInput 默认 h-8 视觉对齐到原 h-7 紧凑外观） */
const numberInputClass = 'h-7 px-2 py-1 text-sm';

/** 与 Input 同款样式的 textarea，项目暂无 Textarea shadcn 组件，本地复用样式 */
const textareaClass =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';

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
          className={numberInputClass}
        />
        <NumberInput
          label="Y"
          value={position.y}
          onChange={(v) => onUpdate({ position: { ...position, y: v } })}
          className={numberInputClass}
        />
        <NumberInput
          label="宽"
          value={position.width}
          min={1}
          onChange={(v) => onUpdate({ position: { ...position, width: v } })}
          className={numberInputClass}
        />
        <NumberInput
          label="高"
          value={position.height}
          min={1}
          onChange={(v) => onUpdate({ position: { ...position, height: v } })}
          className={numberInputClass}
        />
        {position.rotation != null && position.rotation !== 0 && (
          <NumberInput
            label="旋转"
            value={position.rotation}
            onChange={(v) => onUpdate({ position: { ...position, rotation: v } })}
            className={numberInputClass}
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
        step={0.1}
        shiftStep={0.5}
        min={0}
        max={1}
        onChange={(v) => onUpdate({ style: { ...style, opacity: v } })}
        className={numberInputClass}
      />
      <NumberInput
        label="边框"
        value={style.borderWidth ?? 0}
        min={0}
        onChange={(v) => onUpdate({ style: { ...style, borderWidth: v } })}
        className={numberInputClass}
      />
      <ColorInput
        label="边框色"
        value={style.borderColor ?? '#000000'}
        onChange={(v) => onUpdate({ style: { ...style, borderColor: v } })}
      />
      <NumberInput
        label="圆角"
        value={style.borderRadius ?? 0}
        min={0}
        onChange={(v) => onUpdate({ style: { ...style, borderRadius: v } })}
        className={numberInputClass}
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
        min={1}
        onChange={(v) => onUpdate({ style: { ...style, fontSize: v } })}
        className={numberInputClass}
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
              // JSON.parse 返回 any，显式声明 unknown 阻断 any 扩散
              const parsed: unknown = JSON.parse(e.target.value);
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
      <NumberInput
        label="宽度"
        value={canvas.width}
        min={1}
        onChange={(v) => onUpdate({ width: v })}
        className={numberInputClass}
      />
      <NumberInput
        label="高度"
        value={canvas.height}
        min={1}
        onChange={(v) => onUpdate({ height: v })}
        className={numberInputClass}
      />
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
  const alignSelectedHorizontal = useScreenEditorStore((s) => s.alignSelectedHorizontal);
  const alignSelectedVertical = useScreenEditorStore((s) => s.alignSelectedVertical);

  if (!project) return null;

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
                  onClick={() => alignSelectedHorizontal('left')}
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
                  onClick={() => alignSelectedHorizontal('center')}
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
                  onClick={() => alignSelectedHorizontal('right')}
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
                  onClick={() => alignSelectedVertical('top')}
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
                  onClick={() => alignSelectedVertical('middle')}
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
                  onClick={() => alignSelectedVertical('bottom')}
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
  // 细粒度订阅：仅当 components 数组引用变化时重渲染（拖拽 onDragEnd / onResizeEnd 通过
  // updateComponent 创建新数组引用，确保属性面板数值实时同步，肉眼无滞后）
  const components = useScreenEditorStore((s) => s.project?.components);
  const canvas = useScreenEditorStore((s) => s.project?.canvas);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const updateComponent = useScreenEditorStore((s) => s.updateComponent);
  const updateCanvas = useScreenEditorStore((s) => s.updateCanvas);
  const removeComponent = useScreenEditorStore((s) => s.removeComponent);

  const singleSelectedId = selectedComponentIds.length === 1 ? selectedComponentIds[0] : null;
  const selectedComponent = useMemo(
    () =>
      components && singleSelectedId
        ? components.find((c) => c.id === singleSelectedId)
        : undefined,
    [components, singleSelectedId],
  );

  const handleComponentUpdate = useCallback(
    (updates: Partial<ScreenComponent>) => {
      if (singleSelectedId) {
        updateComponent(singleSelectedId, updates);
      }
    },
    [singleSelectedId, updateComponent],
  );

  if (!components || !canvas) return null;

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
          <CanvasSettingsFields canvas={canvas} onUpdate={updateCanvas} />
        )}
      </div>
    </div>
  );
}
