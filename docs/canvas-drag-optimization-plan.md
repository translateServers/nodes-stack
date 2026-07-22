# 画布拖拽性能优化执行计划

> 状态：待执行
> 方案：A+C 合并（transform 定位 + Moveable 内置 snappable）
> 参考：light-chaser `DesignerMovable.tsx`
> 创建时间：2026-07-22

## 背景

大屏设计器画布拖拽组件时存在掉帧、鼠标偏移问题。对比 light-chaser 开源项目（`C:\Users\zhoua\Downloads\Refs\light-chaser-master`）发现其拖拽丝滑，根本原因在于：

1. **定位方式**：light-chaser 使用 `transform: translate()`（GPU 合成层），本项目使用 `left/top`（触发布局重排 + 重绘）
2. **throttleDrag 配置**：light-chaser 配置 `throttleDrag={1}`（整数对齐），本项目未配置（默认 0，亚像素渲染）
3. **onDrag 实现复杂度**：light-chaser onDrag 仅 2 行（写 transform），本项目每帧执行 `findAlignmentLines`（O(N×18)）+ rAF 节流 + dimension store 更新
4. **对齐线方案**：light-chaser 完全依赖 Moveable 内置 `snappable + elementGuidelines + snapThreshold`，本项目自实现 Smart Guides 双重计算
5. **onDragEnd 取值**：light-chaser 用 `lastEvent.beforeTranslate`，本项目回读 `parseFloat(target.style.left)` 有精度损失风险

## 目标

参考 light-chaser 实现：

1. 将组件容器定位从 `left/top` 迁移到 `transform: translate()`
2. 用 Moveable 内置 snappable 替代自定义 Smart Guides
3. 添加 `throttleDrag={1}` / `throttleResize={1}` 整数对齐配置
4. onDrag/onResize/onRotate 使用 `beforeTranslate` 而非 DOM 回读

## 影响范围

| 文件 | 改动类型 | 行数估计 |
|---|---|---|
| `apps/web/src/features/screen/registry/component-container-style.ts` | 渲染层：left/top → transform | ~5 |
| `apps/web/src/features/screen/components/screen-canvas.tsx` | 事件层：onDrag/onResize/onRotate/onDragGroup/onResizeGroup 重写 + Moveable 配置加 throttleDrag/snappable/elementGuidelines | ~70 |
| `apps/web/src/features/screen/components/smart-guides-overlay.tsx` | 简化：移除自定义对齐线 store 或保留作为 Moveable guidelines 容器 | ~20 |

**不改动**：

- `packages/shared/src/schemas/screen.schema.ts`（store schema 不变）
- `apps/web/src/features/screen/stores/editor-store.ts`
- `apps/web/src/features/screen/components/property-panel.tsx`
- `apps/web/src/features/screen/components/text-editor-overlay.tsx`
- `apps/web/src/features/screen/blueprint/*`
- `apps/web/src/features/screen/components/canvas-status-bar.tsx`

**关键洞察**：`position.x/y` 在 store 层是组件在画布坐标系下的绝对位置（语义不变），所有读取层（property-panel、text-editor-overlay、blueprint、editor-store 内部计算）都从 store 读 `position.x/y`，与 DOM 定位方式解耦。DOM 上的 `left/top` 只是渲染产物，改 transform 定位只影响渲染层与事件层，store schema 不变。

## 执行步骤

### 步骤 1：渲染层迁移（component-container-style.ts）

将 `left/top` 改为 `transform: translate()`，合并 rotate：

```ts
export function resolveComponentContainerStyle(component: ScreenComponent): CSSProperties {
  const { position, style, zIndex } = component;
  const rotation = position.rotation;
  const isEllipse = component.type === 'ellipse';
  const translate = `translate(${position.x}px, ${position.y}px)`;
  const rotate = rotation ? ` rotate(${rotation}deg)` : '';
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: position.width,
    height: position.height,
    zIndex,
    opacity: style.opacity ?? 1,
    borderRadius: isEllipse ? undefined : style.borderRadius,
    borderWidth: isEllipse ? undefined : style.borderWidth,
    borderColor: isEllipse ? undefined : style.borderColor,
    borderStyle: isEllipse ? undefined : style.borderStyle,
    backgroundColor: isEllipse ? undefined : style.backgroundColor,
    overflow: style.overflow ?? 'hidden',
    transform: `${translate}${rotate}`,
  };
}
```

**关键点**：`left: 0, top: 0` 占位（绝对定位锚点），实际位置由 transform 控制。

### 步骤 2：Moveable 配置增强

在 `<Moveable>` props 中添加：

```tsx
<Moveable
  // 现有 props 保留...
  throttleDrag={1}
  throttleResize={1}
  // 用 Moveable 内置 snappable 替代自定义 Smart Guides
  snappable={snapEnabled || smartGuidesEnabled || gridEnabled}
  snapThreshold={5}
  snapGap={false}
  snapDirections={{
    top: true, right: true, bottom: true, left: true,
    center: true, middle: true,
  }}
  elementSnapDirections={{
    top: true, right: true, bottom: true, left: true,
    center: true, middle: true,
  }}
  elementGuidelines={smartGuidesReferenceRects.map((r) => ({
    element: componentRefs.current.get(r.id ?? ''),
    className: 'lc-comp-item',
  })).filter((g) => g.element)}
  verticalGuidelines={verticalGuidelines}
  horizontalGuidelines={horizontalGuidelines}
  isDisplaySnapDigit={true}
  isDisplayInnerSnapDigit={true}
/>
```

### 步骤 3：onDrag 重写（极简版）

```tsx
onDrag={(e) => {
  const datas = e.datas as unknown as DragDatas;
  const target = e.target as HTMLElement;
  const { beforeTranslate } = e;
  // 吸附由 Moveable 内置 snappable 完成，无需自定义计算
  // Alt+拖拽复制：移动克隆体
  if (datas.isAltCopy && datas.altCopyClone) {
    datas.altCopyClone.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
  } else {
    target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)${currentRotateTransform(target)}`;
  }
  // rAF 节流仅保留 dimension store 更新（对齐线由 Moveable 内部渲染）
  gestureRafThrottlerRef.current?.schedule(() => {
    setDimension((d) => ({
      ...d,
      x: beforeTranslate[0],
      y: beforeTranslate[1],
      visible: true,
    }));
  });
}}
```

辅助函数（合并旋转）：

```ts
function currentRotateTransform(target: HTMLElement): string {
  const transform = target.style.transform || '';
  const match = transform.match(/rotate\([^)]*\)/);
  return match ? ` ${match[0]}` : '';
}
```

### 步骤 4：onDragEnd 重写（用 beforeTranslate）

```tsx
onDragEnd={(e) => {
  dispatchInteraction('pointer-up');
  gestureRafThrottlerRef.current?.cancel();
  const datas = e.datas as unknown as Partial<DragDatas>;
  if (datas.isAltCopy && datas.altCopyClone) {
    datas.altCopyClone.remove();
    datas.altCopyClone = null;
  }
  if (!e.isDrag) return;
  const id = datas.id;
  if (!id) return;
  const last = e.lastEvent as unknown as { beforeTranslate: [number, number] } | undefined;
  if (!last) return;
  if (datas.isAltCopy) {
    duplicateSelectedToPosition(last.beforeTranslate[0], last.beforeTranslate[1]);
  } else {
    const comp = components.find((c: ScreenComponent) => c.id === id);
    if (!comp) return;
    updateComponent(id, {
      position: {
        ...comp.position,
        x: last.beforeTranslate[0],
        y: last.beforeTranslate[1],
      },
    });
  }
  setDimension((d) => ({ ...d, visible: false }));
}}
```

### 步骤 5：onResize / onResizeEnd 重写

```tsx
onResize={(e) => {
  const datas = e.datas as unknown as ResizeDatas;
  const target = e.target as HTMLElement;
  const { origW, origH, origX, origY, keepRatio, isAltCenter } = datas;
  let w = e.width;
  let h = e.height;
  // keepRatio 逻辑保留...
  target.style.width = `${w}px`;
  target.style.height = `${h}px`;
  const drag = e.drag;
  let tx = drag.beforeTranslate[0];
  let ty = drag.beforeTranslate[1];
  if (isAltCenter) {
    tx = origX + (origW - w) / 2;
    ty = origY + (origH - h) / 2;
  }
  target.style.transform = `translate(${tx}px, ${ty}px)${currentRotateTransform(target)}`;
  gestureRafThrottlerRef.current?.schedule(() => {
    setDimension((d) => ({
      ...d,
      x: tx, y: ty, w: Math.round(w), h: Math.round(h), visible: true,
    }));
  });
}}

onResizeEnd={(e) => {
  dispatchInteraction('pointer-up');
  gestureRafThrottlerRef.current?.cancel();
  if (!e.isDrag) return;
  const datas = e.datas as unknown as Partial<ResizeDatas>;
  const id = datas.id;
  if (!id) return;
  const comp = components.find((c: ScreenComponent) => c.id === id);
  if (!comp) return;
  const last = e.lastEvent as unknown as {
    width: number; height: number;
    drag: { beforeTranslate: [number, number] };
  } | undefined;
  if (!last) return;
  updateComponent(id, {
    position: {
      ...comp.position,
      x: last.drag.beforeTranslate[0],
      y: last.drag.beforeTranslate[1],
      width: last.width,
      height: last.height,
    },
  });
  setDimension((d) => ({ ...d, visible: false, mode: undefined }));
}}
```

### 步骤 6：onRotate / onRotateEnd 重写

```tsx
onRotate={(e) => {
  const datas = e.datas as unknown as RotateDatas;
  const target = e.target as HTMLElement;
  let rotation = e.rotation;
  if (datas.snapRotate) rotation = Math.round(rotation / 15) * 15;
  // 合并 translate + rotate
  const transform = target.style.transform || '';
  const translateMatch = transform.match(/translate\([^)]*\)/);
  const translate = translateMatch ? translateMatch[0] : '';
  target.style.transform = `${translate} rotate(${rotation}deg)`.trim();
  gestureRafThrottlerRef.current?.schedule(() => {
    setDimension((d) => ({ ...d, rotate: Math.round(rotation), visible: true }));
  });
}}

onRotateEnd={(e) => {
  dispatchInteraction('pointer-up');
  gestureRafThrottlerRef.current?.cancel();
  if (!e.isDrag) return;
  const datas = e.datas as unknown as Partial<RotateDatas>;
  const id = datas.id;
  if (!id) return;
  const comp = components.find((c: ScreenComponent) => c.id === id);
  if (!comp) return;
  const transform = e.target.style.transform || '';
  const match = transform.match(/rotate\(([^)]+)deg\)/);
  const rotation = match ? Number.parseFloat(match[1]) : 0;
  updateComponent(id, {
    position: { ...comp.position, rotation: Math.round(rotation) },
  });
  setDimension((d) => ({ ...d, visible: false }));
}}
```

### 步骤 7：onDragGroup / onResizeGroup 重写

```tsx
onDragGroup={(e) => {
  e.events.forEach((ev) => {
    const { beforeTranslate } = ev;
    ev.target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)${currentRotateTransform(ev.target as HTMLElement)}`;
  });
}}

onDragGroupEnd={(e) => {
  dispatchInteraction('pointer-up');
  if (!e.isDrag) return;
  const updates = e.events
    .map((ev) => {
      const id = getComponentIdFromTarget(ev.target);
      if (!id) return null;
      const last = ev.lastEvent as unknown as { beforeTranslate: [number, number] } | undefined;
      if (!last) return null;
      const comp = components.find((c: ScreenComponent) => c.id === id);
      if (!comp) return null;
      return {
        id,
        changes: {
          position: {
            ...comp.position,
            x: last.beforeTranslate[0],
            y: last.beforeTranslate[1],
          },
        },
      };
    })
    .filter((u): u is { id: string; changes: Partial<ScreenComponent> } => u != null);
  updateComponentsBatch(updates);
}}
```

### 步骤 8：移除自定义 Smart Guides 计算

在 `screen-canvas.tsx` 中：

- 删除 `computeSnappedPosition` 函数（970-1010 行）
- 删除 onDrag 中对 `computeSnappedPosition` 的调用
- 删除 `findAlignmentLines` import（不再使用）
- 删除 `snapPosition`、`AlignmentLine`、`AlignmentRect` 的 import（如果不再使用）
- `smartGuidesReferenceRects` 改为提供给 `elementGuidelines` 使用
- 删除 `setAlignmentLines` / `clearAlignmentLines` 调用

`smart-guides-overlay.tsx` 与 `smart-guides.ts` 可保留备用或删除（如果完全用 Moveable 内置对齐线则可删）。

### 步骤 9：删除不再使用的 rAF 节流逻辑（可选）

如果 onDrag 极简到只剩 dimension store 更新，rAF 节流仍可保留（dimension 浮层重渲染频率降低）。但 `gestureRafThrottlerRef` 的 cancel 契约要保留。

## 验证清单

实施后执行：

1. `pnpm --filter @nebula/web typecheck` — 类型检查通过
2. `pnpm --filter @nebula/web test -- src/features/screen` — 现有测试通过
3. `pnpm biome:check` — 格式检查
4. 手动验证：
   - 拖拽单组件：流畅、无偏移、松手位置准确
   - 拖拽多组件（组）：所有组件同步移动
   - Alt+拖拽复制：克隆体移动、原件不动
   - 缩放单组件：四角/四边缩放正常
   - Alt+缩放：中心对称缩放
   - Shift+旋转：15° 步进吸附
   - 拖拽时显示对齐线（Moveable 内置）
   - 与其他组件对齐吸附
   - 属性面板 X/Y 数值同步
   - 状态栏尺寸提示实时更新

## 测试文件可能需要更新

- `apps/web/src/features/screen/components/screen-canvas.test.tsx` — 若断言了 `style.left/top` 需改为 `style.transform`
- `apps/web/src/features/screen/registry/registry.test.ts` — 若断言了 `left/top` 字段需检查
- `apps/web/src/features/screen/components/property-panel.test.tsx` — 通常基于 `position.x/y` store 值，不受影响

## 风险点

1. **transform 合并**：rotate 和 translate 必须正确合并，避免互相覆盖。可用辅助函数 `composeTransform(translate, rotate)`。
2. **Moveable elementGuidelines**：需要传入 DOM 元素引用而非位置数据，需要确保 `componentRefs` 在拖拽时已注册完成。
3. **自定义对齐线视觉**：Moveable 内置对齐线样式与原 Smart Guides 不同，可能需要 CSS 覆盖调整。
4. **onDragGroup 中的旋转合并**：组拖拽时每个 target 都要保留其原 rotate。

## 分支策略

由于改动范围较大，建议在独立分支执行，避免与基座夯实 / 事件蓝图模块的并行开发产生冲突。执行时切换到目标分支后按上述步骤实施。
