/**
 * MoveableContainer：独立 memo 化的 Moveable 包装组件。
 *
 * 架构参考 light-chaser 的 DesignerMovable（observer + mobx 同步订阅）：
 * - target 通过 useScreenEditorStore(s => s.targets) 独立订阅
 * - 当 selectedComponentIds 变化时，ScreenCanvas 重渲染但 MoveableContainer 跳过
 *   （handlers 引用稳定，仅 store.targets 变化触发 MoveableContainer 重渲染）
 * - 渲染开销 <1ms，控制框立即显示/隐藏，无延迟
 *
 * 关键设计：
 * 1. 所有事件处理器通过 handlers prop 传入（ScreenCanvas 中 useMemo 稳定引用）
 * 2. handlers 的 useMemo 依赖只包含 interactionState 和 componentMap
 *    （不包含 selectedComponentIds），所以纯点击选中时 handlers 引用不变
 * 3. moveableRef 通过 RefObject prop 传入
 * 4. 配置 props（draggable/resizable/snapEnabled 等）通过 props 传入
 *
 * 不从 screen-canvas.tsx 导入任何内容，避免循环依赖。
 * handlers 的创建逻辑（createMoveableHandlers）留在 screen-canvas.tsx。
 */
import { memo, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import Moveable, { type MoveableProps } from 'react-moveable';

import { useScreenEditorStore } from '../stores/editor-store';

// 模块级常量（与 screen-canvas.tsx 保持一致，避免每次渲染产生新引用）
const SNAP_DIRECTIONS = {
  top: true,
  bottom: true,
  left: true,
  right: true,
  center: true,
  middle: true,
};
const ELEMENT_SNAP_DIRECTIONS = SNAP_DIRECTIONS;
const RENDER_DIRECTIONS = ['n', 'nw', 'ne', 's', 'se', 'sw', 'e', 'w'];

/**
 * handlers 对象的接口：包含 Moveable 所需的所有事件处理器。
 * ScreenCanvas 中用 useMemo 创建稳定引用，依赖项为 interactionState 和 componentMap。
 *
 * 使用 MoveableProps 中的回调类型，避免重复定义且与 react-moveable 类型完全一致。
 */
export type MoveableHandlers = Required<
  Pick<
    MoveableProps,
    | 'onDragStart'
    | 'onDrag'
    | 'onDragEnd'
    | 'onResizeStart'
    | 'onResize'
    | 'onResizeEnd'
    | 'onRotateStart'
    | 'onRotate'
    | 'onRotateEnd'
    | 'onDragGroupStart'
    | 'onDragGroup'
    | 'onDragGroupEnd'
    | 'onResizeGroupStart'
    | 'onResizeGroup'
    | 'onResizeGroupEnd'
    | 'onChangeTargets'
  >
>;

/**
 * MoveableContainer 的 props 接口。
 */
interface MoveableContainerProps {
  moveableRef: RefObject<Moveable | null>;
  container: HTMLDivElement | null;
  draggable: boolean;
  resizable: boolean;
  rotatable: boolean;
  snapEnabled: boolean;
  keepRatio: boolean;
  throttleRotate: number;
  isGroupSelect: boolean;
  elementGuidelines: HTMLElement[];
  verticalGuidelines: string[];
  horizontalGuidelines: string[];
  zoom: number;
  handlers: MoveableHandlers;
}

/**
 * MoveableContainer：memo 化的 Moveable 包装组件。
 *
 * 关键优化：
 * - target 通过 useScreenEditorStore(s => s.targets) 独立订阅
 * - 当 ScreenCanvas 因 selectedComponentIds 变化重渲染时，handlers 引用稳定（useMemo），
 *   MoveableContainer 跳过重渲染
 * - 仅当 store.targets 变化时，MoveableContainer 内部触发重渲染
 * - 渲染开销 <1ms，控制框立即显示/隐藏
 *
 * 参考 light-chaser 的 DesignerMovable（observer + mobx 同步订阅）。
 */
export const MoveableContainer = memo(function MoveableContainer(props: MoveableContainerProps) {
  const {
    moveableRef,
    container,
    draggable,
    resizable,
    rotatable,
    snapEnabled,
    keepRatio,
    throttleRotate,
    isGroupSelect,
    elementGuidelines,
    verticalGuidelines,
    horizontalGuidelines,
    zoom,
    handlers,
  } = props;

  // target 从 store 独立订阅 —— 这是核心优化点
  const targets = useScreenEditorStore((s) => s.targets);

  // 内部 ref 用于同步外部 moveableRef
  const internalRef = useRef<Moveable | null>(null);

  const setRef = (instance: Moveable | null) => {
    moveableRef.current = instance;
    internalRef.current = instance;
  };

  return (
    <Moveable
      ref={setRef}
      target={targets}
      container={container}
      draggable={draggable}
      resizable={resizable}
      rotatable={rotatable}
      // React 18 concurrent mode 下传入 flushSync 让 Moveable 内部 forceUpdate 同步刷新。
      flushSync={flushSync}
      snappable={snapEnabled}
      snapThreshold={5}
      snapGap={false}
      keepRatio={keepRatio}
      throttleDrag={1}
      throttleResize={1}
      throttleRotate={throttleRotate}
      hideChildMoveableDefaultLines={isGroupSelect}
      snapDirections={SNAP_DIRECTIONS}
      elementSnapDirections={ELEMENT_SNAP_DIRECTIONS}
      elementGuidelines={elementGuidelines}
      verticalGuidelines={verticalGuidelines}
      horizontalGuidelines={horizontalGuidelines}
      isDisplaySnapDigit={true}
      isDisplayInnerSnapDigit={true}
      zoom={zoom}
      origin={false}
      renderDirections={RENDER_DIRECTIONS}
      onDragStart={handlers.onDragStart}
      onDrag={handlers.onDrag}
      onDragEnd={handlers.onDragEnd}
      onResizeStart={handlers.onResizeStart}
      onResize={handlers.onResize}
      onResizeEnd={handlers.onResizeEnd}
      onRotateStart={handlers.onRotateStart}
      onRotate={handlers.onRotate}
      onRotateEnd={handlers.onRotateEnd}
      onDragGroupStart={handlers.onDragGroupStart}
      onDragGroup={handlers.onDragGroup}
      onDragGroupEnd={handlers.onDragGroupEnd}
      onResizeGroupStart={handlers.onResizeGroupStart}
      onResizeGroup={handlers.onResizeGroup}
      onResizeGroupEnd={handlers.onResizeGroupEnd}
      onChangeTargets={handlers.onChangeTargets}
    />
  );
});
