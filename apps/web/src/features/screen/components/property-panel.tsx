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
import { ColorInput, StyleFields, numberInputClass, textareaClass } from './panel-fields';
import { BarChartConfigSections } from './bar-chart-config-sections';

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
          syncKey={`${component.id}:position.x`}
        />
        <NumberInput
          label="Y"
          value={position.y}
          onChange={(v) => onUpdate({ position: { ...position, y: v } })}
          className={numberInputClass}
          syncKey={`${component.id}:position.y`}
        />
        <NumberInput
          label="宽"
          value={position.width}
          min={1}
          onChange={(v) => onUpdate({ position: { ...position, width: v } })}
          className={numberInputClass}
          syncKey={`${component.id}:position.width`}
        />
        <NumberInput
          label="高"
          value={position.height}
          min={1}
          onChange={(v) => onUpdate({ position: { ...position, height: v } })}
          className={numberInputClass}
          syncKey={`${component.id}:position.height`}
        />
        {position.rotation != null && position.rotation !== 0 && (
          <NumberInput
            label="旋转"
            value={position.rotation}
            onChange={(v) => onUpdate({ position: { ...position, rotation: v } })}
            className={numberInputClass}
            syncKey={`${component.id}:position.rotation`}
          />
        )}
      </div>
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
        syncKey={`${component.id}:style.fontSize`}
      />
      <ColorInput
        label="字色"
        value={style.color ?? '#ffffff'}
        onChange={(v) => onUpdate({ style: { ...style, color: v } })}
      />
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
        syncKey="canvas:width"
      />
      <NumberInput
        label="高度"
        value={canvas.height}
        min={1}
        onChange={(v) => onUpdate({ height: v })}
        className={numberInputClass}
        syncKey="canvas:height"
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
            {selectedComponent.type === 'bar-chart' ? (
              // bar-chart 按"数据、逻辑、视觉、交互"四层分组（阶段 2 任务 4.1）；
              // key 确保切换组件时重建分组内本地编辑状态
              <BarChartConfigSections
                key={selectedComponent.id}
                component={selectedComponent}
                onUpdate={handleComponentUpdate}
              />
            ) : (
              <>
                <StyleFields component={selectedComponent} onUpdate={handleComponentUpdate} />
                {selectedComponent.type === 'text' && (
                  <TextPropsFields component={selectedComponent} onUpdate={handleComponentUpdate} />
                )}
              </>
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
          <section data-testid="canvas-settings-section">
            <CanvasSettingsFields canvas={canvas} onUpdate={updateCanvas} />
          </section>
        )}
      </div>
    </div>
  );
}
