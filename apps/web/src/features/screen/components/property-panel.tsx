import { memo, useCallback, useMemo } from 'react';
import type { ComponentType } from 'react';
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
import { ColorInput, numberInputClass } from './panel-fields';
import { PanelSection } from './ui-primitives';
// Phase 2 Slice B：属性面板 Schema 化（注册表驱动 + 声明式字段 + customRender 逃生舱）
import { getSchemaForComponentType, PropertySchemaRenderer } from '../property-schema';

/**
 * rerender-no-inline-components：对齐命令表提升到模块级。
 *
 * 原实现 6 个对齐按钮各自内联 Tooltip+Button 块，代码重复且每次渲染都重建 JSX。
 * 提取为 ALIGN_COMMANDS 后：
 * - 数组在模块级初始化一次，不随组件重渲染重建
 * - apply 函数闭包捕获对齐函数，类型安全（horizontal 分支只接受 'left'|'center'|'right'）
 * - 渲染从 6 个重复块简化为 1 个 map
 */
type AlignHorizontalFn = (alignment: 'left' | 'center' | 'right') => void;
type AlignVerticalFn = (alignment: 'top' | 'middle' | 'bottom') => void;

interface AlignCommand {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  apply: (h: AlignHorizontalFn, v: AlignVerticalFn) => void;
}

const ALIGN_COMMANDS: ReadonlyArray<AlignCommand> = [
  { key: 'left', label: '左对齐', Icon: AlignLeft, apply: (h) => h('left') },
  { key: 'h-center', label: '水平居中', Icon: AlignCenter, apply: (h) => h('center') },
  { key: 'right', label: '右对齐', Icon: AlignRight, apply: (h) => h('right') },
  { key: 'top', label: '顶对齐', Icon: AlignStartVertical, apply: (_, v) => v('top') },
  { key: 'v-center', label: '垂直居中', Icon: AlignCenterVertical, apply: (_, v) => v('middle') },
  { key: 'bottom', label: '底对齐', Icon: AlignEndVertical, apply: (_, v) => v('bottom') },
];

/**
 * H5 性能优化：memo 化画布设置字段。
 *
 * 父组件 PropertyPanel 在拖拽期间会因 components 数组引用变化而重渲染，
 * 即使 canvas 对象未变，CanvasSettingsFields 也会跟着重渲染，导致 4 个 NumberInput
 * 与 Select 重建。memo 后仅在 canvas prop 引用变化时重渲染。
 */
const CanvasSettingsFields = memo(function CanvasSettingsFields({
  canvas,
  onUpdate,
}: {
  canvas: CanvasConfig;
  onUpdate: (updates: Partial<CanvasConfig>) => void;
}) {
  return (
    <div className="space-y-2">
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
});

/**
 * H5 性能优化：memo 化多选面板。
 *
 * 原实现订阅 `s.project` 仅为 null 检查，但父组件 PropertyPanel 已在
 * `if (!components || !canvas) return null;` 处保证 project 存在，此处订阅冗余，
 * 反而每次拖拽（components 变化）都触发 MultiSelectPanel 重渲染。
 * memo 后仅在 selectedIds 引用变化时重渲染。
 */
const MultiSelectPanel = memo(function MultiSelectPanel({
  selectedIds,
}: {
  selectedIds: string[];
}) {
  const removeSelectedComponents = useScreenEditorStore((s) => s.removeSelectedComponents);
  const alignSelectedHorizontal = useScreenEditorStore((s) => s.alignSelectedHorizontal);
  const alignSelectedVertical = useScreenEditorStore((s) => s.alignSelectedVertical);

  return (
    <TooltipProvider>
      <div>
        <div className="p-3 text-sm text-muted-foreground">已选中 {selectedIds.length} 个组件</div>

        <PanelSection title="对齐">
          <div className="grid grid-cols-6 gap-1">
            {ALIGN_COMMANDS.map(({ key, label, Icon, apply }) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    onClick={() => apply(alignSelectedHorizontal, alignSelectedVertical)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </PanelSection>

        <div className="p-3">
          <Button variant="destructive" className="w-full" onClick={removeSelectedComponents}>
            删除选中 ({selectedIds.length})
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
});

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

  // Phase 2 Slice B：按组件类型查找 Schema（注册表驱动，消除 type === 'bar-chart' 硬编码分支）
  const schema = useMemo(
    () => (selectedComponent ? getSchemaForComponentType(selectedComponent.type) : []),
    [selectedComponent],
  );

  if (!components || !canvas) return null;

  const isMultiSelect = selectedComponentIds.length > 1;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-card text-foreground">
      <div className="flex h-10 items-center border-b border-border px-3 text-sm font-medium">
        {selectedComponent
          ? selectedComponent.name
          : isMultiSelect
            ? `多选 (${selectedComponentIds.length})`
            : '属性'}
      </div>
      <div className="flex-1 overflow-y-auto">
        {selectedComponent ? (
          <>
            {/* Phase 2 Slice B：Schema 驱动渲染（声明式字段 + customRender 逃生舱） */}
            <PropertySchemaRenderer
              schema={schema}
              component={selectedComponent}
              onUpdate={handleComponentUpdate}
            />
            <div className="p-3">
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
          <>
            {/* 空选中态提示：引导用户点击画布组件 */}
            <div className="flex flex-col items-center gap-1 py-6 text-center">
              <p className="text-xs text-muted-foreground">未选中组件</p>
              <p className="text-xs text-muted-foreground">点击画布组件以编辑属性</p>
            </div>
            <PanelSection title="画布设置" testId="canvas-settings-section">
              <CanvasSettingsFields canvas={canvas} onUpdate={updateCanvas} />
            </PanelSection>
          </>
        )}
      </div>
    </div>
  );
}
