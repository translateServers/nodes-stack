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
      <input
        type="number"
        className="w-full rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
      <input
        type="text"
        className="w-full rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
      <input
        type="text"
        className="w-full rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          className="w-full rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          className="w-full rounded border border-input bg-card px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
        <select
          className="w-full rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          value={canvas.scaleMode}
          onChange={(e) => onUpdate({ scaleMode: e.target.value as CanvasConfig['scaleMode'] })}
        >
          <option value="fit">等比缩放</option>
          <option value="full">拉伸铺满</option>
          <option value="width">宽度铺满</option>
          <option value="height">高度铺满</option>
          <option value="none">原始尺寸</option>
        </select>
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
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">已选中 {selectedIds.length} 个组件</div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-foreground">对齐</div>
        <div className="grid grid-cols-6 gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="左对齐"
            onClick={() => alignHorizontal('left')}
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="水平居中"
            onClick={() => alignHorizontal('center')}
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="右对齐"
            onClick={() => alignHorizontal('right')}
          >
            <AlignRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="顶对齐"
            onClick={() => alignVertical('top')}
          >
            <AlignStartVertical className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="垂直居中"
            onClick={() => alignVertical('middle')}
          >
            <AlignCenterVertical className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="底对齐"
            onClick={() => alignVertical('bottom')}
          >
            <AlignEndVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <button
          type="button"
          className="w-full rounded bg-destructive/10 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/20"
          onClick={removeSelectedComponents}
        >
          删除选中 ({selectedIds.length})
        </button>
      </div>
    </div>
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
              <button
                type="button"
                className="w-full rounded bg-destructive/10 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/20"
                onClick={() => removeComponent(selectedComponent.id)}
              >
                删除组件
              </button>
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
