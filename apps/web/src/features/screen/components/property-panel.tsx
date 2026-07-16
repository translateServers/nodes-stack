import { useCallback } from 'react';
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
      <label className="w-12 shrink-0 text-xs text-gray-500">{label}</label>
      <input
        type="number"
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
      <label className="w-12 shrink-0 text-xs text-gray-500">{label}</label>
      <input
        type="text"
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
      <label className="w-12 shrink-0 text-xs text-gray-500">{label}</label>
      <input
        type="color"
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-gray-300"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
      <div className="text-xs font-medium text-gray-600">位置与尺寸</div>
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
      <div className="text-xs font-medium text-gray-600">样式</div>
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
      <div className="text-xs font-medium text-gray-600">文本属性</div>
      <div className="flex items-center gap-2">
        <label className="w-12 shrink-0 text-xs text-gray-500">内容</label>
        <textarea
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
      <div className="text-xs font-medium text-gray-600">图表属性</div>
      <TextInput
        label="标题"
        value={(props.title as string) ?? ''}
        onChange={(v) => onUpdate({ props: { ...props, title: v } })}
      />
      <div className="flex items-center gap-2">
        <label className="w-12 shrink-0 text-xs text-gray-500">数据</label>
        <textarea
          className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
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
      <div className="text-xs font-medium text-gray-600">画布设置</div>
      <NumberInput label="宽度" value={canvas.width} onChange={(v) => onUpdate({ width: v })} />
      <NumberInput label="高度" value={canvas.height} onChange={(v) => onUpdate({ height: v })} />
      <ColorInput
        label="背景"
        value={canvas.backgroundColor}
        onChange={(v) => onUpdate({ backgroundColor: v })}
      />
      <div className="flex items-center gap-2">
        <label className="w-12 shrink-0 text-xs text-gray-500">缩放</label>
        <select
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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

export function PropertyPanel() {
  const project = useScreenEditorStore((s) => s.project);
  const selectedComponentId = useScreenEditorStore((s) => s.selectedComponentId);
  const updateComponent = useScreenEditorStore((s) => s.updateComponent);
  const updateCanvas = useScreenEditorStore((s) => s.updateCanvas);
  const removeComponent = useScreenEditorStore((s) => s.removeComponent);

  const selectedComponent = project?.components.find((c) => c.id === selectedComponentId);

  const handleComponentUpdate = useCallback(
    (updates: Partial<ScreenComponent>) => {
      if (selectedComponentId) {
        updateComponent(selectedComponentId, updates);
      }
    },
    [selectedComponentId, updateComponent],
  );

  if (!project) return null;

  return (
    <div className="flex h-full w-72 flex-col border-l bg-white">
      <div className="border-b px-4 py-3 font-medium">
        {selectedComponent ? selectedComponent.name : '属性'}
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
            <div className="border-t pt-3">
              <button
                type="button"
                className="w-full rounded bg-red-50 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-100"
                onClick={() => removeComponent(selectedComponent.id)}
              >
                删除组件
              </button>
            </div>
          </>
        ) : (
          <CanvasSettingsFields canvas={project.canvas} onUpdate={updateCanvas} />
        )}
      </div>
    </div>
  );
}
