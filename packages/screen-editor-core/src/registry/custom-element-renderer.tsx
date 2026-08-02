/**
 * Custom Element Renderer Bridge（Spec §9.1 + §13.2 Phase 2, Task 2.2 + Phase 4 Task 4.1）
 *
 * 将宿主注册的外部组件（source='host'）桥接到 React 渲染树：
 * - 根据 manifest.tagName 创建 Custom Element
 * - 通过 JavaScript property 原子赋值 detached model（不序列化为 HTML attribute）
 * - 同 id/type 更新时复用 DOM element，不重复 mount
 * - tagName 变化或组件卸载时销毁旧 element 并清理
 * - Phase 4 Task 4.1：监听 `nebula-component-event` CustomEvent 并桥接到蓝图运行时
 *
 * Spec §9.1 规则：
 * - SDK 通过 JS property 赋值，不把结构化 props 序列化为 HTML attribute
 * - 每次赋值使用 detached snapshot（structuredClone），组件修改 model 不得改变 Store
 * - 同一组件 id/type 更新 props 时复用 DOM element，不重复 mount
 * - type 变化或组件删除时销毁旧 element，并移除 SDK 添加的监听器
 * - element 应填满容器；定位/尺寸/旋转/zIndex/显隐/滤镜由外层 Canvas wrapper 管理
 * - design 模式不得自行导航/保存/修改项目；interactive=false 时 SDK 忽略业务事件
 *
 * Phase 4 Task 4.1 事件桥接（Spec §9.2）：
 * - 仅在 onComponentEvent !== null（预览态）时挂载 nebula-component-event listener
 * - listener 调用 validateComponentEvent 校验事件名 allowlist / payload JSON 边界 / 64 KiB 体积
 * - 校验通过：调用 onComponentEvent(componentId, eventId, payload)，使用 React 闭包中的
 *   可信 componentId（不信任 event.detail）
 * - 校验失败：console.warn 输出 code+message（不含 payload，Spec §9.2.6）
 * - listener 在 unmount 或 tagName 变化时通过 effect cleanup 移除
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { ComponentStyle } from '@nebula/shared';
import {
  checkJsonValue,
  COMPONENT_EVENT_TYPE,
  validateComponentEvent,
  type ScreenComponentElement,
  type ScreenComponentElementModel,
  type ScreenComponentEventDetail,
  type ScreenComponentEventDefinition,
  type ScreenComponentJsonValue,
  type ScreenComponentProps,
  type ScreenComponentValidationDiagnostic,
} from '@nebula/screen-component-sdk';
import type {
  ScreenComponentDataState,
  ScreenComponentElementModelV2,
  ScreenDynamicComponentElement,
} from '@nebula/screen-component-sdk/dynamic';
import { useComponentEvent } from '../blueprint/runtime/component-event-context.js';
import type { RendererComponentProps } from './renderer';

/**
 * 将任意值清洗为 ScreenComponentJsonValue（Spec §7.1 JSON 边界）。
 *
 * - undefined → 跳过（不写入对象）或 null（数组元素/根值）
 * - 函数 / symbol / bigint → 抛错（违反 JSON 边界）
 * - 其他原始值 / 数组 / 普通对象递归清洗
 *
 * 编辑器 ComponentStyle 含大量 optional 字段（值为 undefined），需要剥离后才能
 * 写入 model.style（type 为 Readonly<Record<string, ScreenComponentJsonValue>>，
 * 不允许 undefined）。
 */
function sanitizeToJson(value: unknown): ScreenComponentJsonValue {
  const diagnostics: ScreenComponentValidationDiagnostic[] = [];
  if (
    !checkJsonValue(value, [], diagnostics, new WeakSet(), { allowUndefinedObjectProperties: true })
  ) {
    const diagnostic = diagnostics[0];
    throw new Error(
      `[custom-element-renderer] ScreenComponentJsonValue 边界校验失败: ${diagnostic?.message ?? '值不符合 JSON 边界（Spec §7.1）'}`,
    );
  }

  return omitUndefinedObjectProperties(value);
}

function omitUndefinedObjectProperties(value: unknown): ScreenComponentJsonValue {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    return value as ScreenComponentJsonValue;
  }
  if (Array.isArray(value)) {
    return value.map(omitUndefinedObjectProperties);
  }
  if (t === 'object') {
    const result: Record<string, ScreenComponentJsonValue> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === undefined) continue;
      result[key] = omitUndefinedObjectProperties(val);
    }
    return result;
  }
  throw new Error('[custom-element-renderer] 值不符合 ScreenComponentJsonValue 边界');
}

/**
 * 构造 detached model snapshot（Spec §9.1）。
 *
 * - props / style 经 sanitizeToJson 清洗为合法 ScreenComponentJsonValue
 * - 整体 model 通过 structuredClone 形成独立快照，组件修改不影响编辑器 Store
 * - 提供 dataCapability 时构造 model v2（组件 API v2），否则构造 model v1
 *
 * @throws 当 props 或 style 含函数/symbol/bigint 等非法 JSON 值时抛错
 */
function buildDetachedModel(
  componentId: string,
  mode: 'design' | 'preview' | 'viewer',
  interactive: boolean,
  props: Record<string, unknown>,
  style: ComponentStyle,
  size: { width: number; height: number },
  dataCapability?: 'none' | 'static' | 'host-metric',
  dataState?: ScreenComponentDataState,
): ScreenComponentElementModel | ScreenComponentElementModelV2 {
  if (dataCapability !== undefined) {
    const modelV2: ScreenComponentElementModelV2 = {
      apiVersion: 2,
      componentId,
      mode,
      interactive,
      props: sanitizeToJson(props) as ScreenComponentProps,
      style: sanitizeToJson(style) as Record<string, ScreenComponentJsonValue>,
      size,
      dataCapability,
      dataState: dataState ?? { status: 'idle' },
    };
    return structuredClone(modelV2);
  }
  const model: ScreenComponentElementModel = {
    apiVersion: 1,
    componentId,
    // v1 model 仅支持 design/preview；viewer 模式仅在提供 dataCapability（v2）时使用
    mode: mode === 'viewer' ? 'preview' : mode,
    interactive,
    props: sanitizeToJson(props) as ScreenComponentProps,
    style: sanitizeToJson(style) as Record<string, ScreenComponentJsonValue>,
    size,
  };
  return structuredClone(model);
}

/**
 * CustomElementRenderer 直接入参（Spec §9.1）。
 *
 * 与 `RendererComponentProps` 的区别：
 * - `tagName` 必填，由 manifest 派生
 * - `mode` / `interactive` / `size` 必填（上层 `createHostElementRenderer` 提供默认值）
 * - 不含 dataSource / logic / interaction / apiRawDataOverride（外部组件第一版不支持）
 */
export interface CustomElementRendererProps {
  /** manifest.tagName，用于 document.createElement */
  readonly tagName: string;
  /** 组件实例 ID（写入 model.componentId；事件回调中以该可信值回传，不信任 event.detail） */
  readonly componentId: string;
  /** 运行模式（design：编辑器画布；preview：真实预览；viewer：独立查看器） */
  readonly mode: 'design' | 'preview' | 'viewer';
  /** 是否允许派发业务事件（design=false） */
  readonly interactive: boolean;
  /** 组件专属配置（写入 model.props） */
  readonly props: Record<string, unknown>;
  /** 组件样式（清洗后写入 model.style） */
  readonly style: ComponentStyle;
  /** 组件尺寸（来自 component.position，写入 model.size） */
  readonly size: { readonly width: number; readonly height: number };
  /**
   * manifest.events allowlist（Spec §9.2.2: 未声明事件不执行蓝图）。
   *
   * - undefined：未提供（监听器仍可挂载，但所有事件都会被 EVENT_NOT_DECLARED 拒绝）
   * - 空数组：组件明确声明无事件（同上，全部拒绝）
   * - 非空数组：仅这些 id 的事件通过校验
   *
   * 由 `createHostElementRenderer` 从 registry manifest 闭包捕获，registry 缓存保证
   * 同一 tagName 多次渲染使用同一 events 引用（避免 effect 频繁重绑定）。
   */
  readonly events?: readonly ScreenComponentEventDefinition[];
  /**
   * 组件数据能力（组件 API v2）。提供时写入 model v2（含 dataState）；
   * 缺省按 model v1 赋值（编辑器路径保持不变）。
   */
  readonly dataCapability?: 'none' | 'static' | 'host-metric';
  /** 组件运行数据状态（screen-dynamic-sdk viewer 回写，随 model v2 赋值） */
  readonly dataState?: ScreenComponentDataState;
}

function resolveHostStyle(tagName: string, style: ComponentStyle): CSSProperties {
  const base: CSSProperties = { width: '100%', height: '100%' };
  if (tagName === 'nebula-screen-rect-v1') {
    return {
      ...base,
      backgroundColor: style.backgroundColor ?? 'transparent',
      borderWidth: style.borderWidth ?? 0,
      borderStyle: style.borderStyle ?? 'solid',
      borderColor: style.borderColor ?? '#000000',
      borderRadius: style.borderRadius ?? 0,
      opacity: style.opacity ?? 1,
    };
  }
  if (tagName === 'nebula-screen-ellipse-v1') {
    return {
      ...base,
      backgroundColor: style.backgroundColor ?? 'transparent',
      borderWidth: style.borderWidth ?? 0,
      borderStyle: style.borderStyle ?? 'solid',
      borderColor: style.borderColor ?? '#000000',
      borderRadius: '50%',
      opacity: style.opacity ?? 1,
    };
  }
  return base;
}

/**
 * React 包装组件：创建并管理 Custom Element 生命周期。
 *
 * 渲染流程（Spec §9.1）：
 * 1. 首次 mount：`document.createElement(tagName)` 创建元素并 append 到容器
 * 2. 后续更新（同 tagName）：复用 DOM，仅重新赋值 model
 * 3. tagName 变化：销毁旧元素，创建新元素
 * 4. 卸载：移除元素并清理 ref
 *
 * 容器 div 使用 `width:100%; height:100%` 填满父级（CanvasComponentWrapper
 * 已通过 position/transform 设置外层尺寸与定位）。Custom Element 同样填满容器，
 * 不接管定位/旋转/zIndex/显隐/滤镜（Spec §9.1：仍由外层 Canvas wrapper 管理）。
 *
 * 元素创建与 model 赋值的时序保证：
 * - 元素创建 effect 在 model 赋值 effect 之前执行（React 按声明顺序运行 effects）
 * - 因此 model 赋值 effect 运行时 elementRef.current 已就绪
 * - tagName 变化时创建 effect 重新运行，model 赋值 effect 也因依赖 tagName 而重新运行
 */
export function CustomElementRenderer({
  tagName,
  componentId,
  mode,
  interactive,
  props,
  style,
  size,
  events,
  dataCapability,
  dataState,
}: CustomElementRendererProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<ScreenComponentElement | ScreenDynamicComponentElement | null>(null);
  const prevTagNameRef = useRef<string | null>(null);
  // Phase 4 Task 4.1：预览态由上层 BlueprintEventProvider 注入回调；编辑态返回 null
  const onComponentEvent = useComponentEvent();

  // 元素创建 / 销毁：仅在 tagName 变化时重新创建
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    // tagName 变化时销毁旧元素（Spec §9.1: type 变化销毁旧 element）
    if (prevTagNameRef.current !== null && prevTagNameRef.current !== tagName) {
      if (elementRef.current !== null) {
        elementRef.current.remove();
        elementRef.current = null;
      }
      prevTagNameRef.current = null;
    }

    // 创建新元素（若尚未创建）
    if (elementRef.current === null) {
      const el = document.createElement(tagName) as ScreenComponentElement;
      container.appendChild(el);
      elementRef.current = el;
      prevTagNameRef.current = tagName;
    }
  }, [tagName]);

  // model 赋值：props / style / mode / interactive / size / componentId 变化时更新
  useEffect(() => {
    const el = elementRef.current;
    if (el === null) {
      return;
    }

    const model = buildDetachedModel(
      componentId,
      mode,
      interactive,
      props,
      style,
      { width: size.width, height: size.height },
      dataCapability,
      dataState,
    );
    el.model = model;
  }, [tagName, componentId, mode, interactive, props, style, size, dataCapability, dataState]);

  // Phase 4 Task 4.1：nebula-component-event 监听与校验（Spec §9.2）
  //
  // 仅在 onComponentEvent !== null 时挂载 listener（编辑态 / 无 Provider 时跳过，
  // 避免无谓的 DOM 监听）。listener 使用 React 闭包中的可信 componentId，不信任
  // event.detail 中的 componentId 字段（如有）。
  //
  // 校验链由 SDK 的 validateComponentEvent 完成；失败时仅 console.warn code+message
  // （Spec §9.2.6: 失败日志不包含 payload）。
  useEffect(() => {
    if (onComponentEvent === null) {
      return;
    }
    const el = elementRef.current;
    if (el === null) {
      return;
    }

    const manifestLike = { events };
    const handleEvent = (event: Event): void => {
      const customEvent = event as CustomEvent<ScreenComponentEventDetail>;
      const detail = customEvent.detail;
      if (detail === undefined || detail === null) {
        // 无 detail 的 CustomEvent 视为 INVALID_EVENT_NAME
        console.warn('[nebula-component-event] 收到无 detail 的事件，已忽略');
        return;
      }
      const result = validateComponentEvent(detail, manifestLike);
      if (!result.ok) {
        // Spec §9.2.6: 失败日志仅包含 code+message，不含 payload
        console.warn(
          `[nebula-component-event] 校验失败 code=${result.code} message=${result.message}`,
        );
        return;
      }
      // 使用 React 闭包中的可信 componentId（Spec §9.2.3: 不信任 event.detail.componentId）
      onComponentEvent(componentId, result.eventId, result.payload);
    };

    el.addEventListener(COMPONENT_EVENT_TYPE, handleEvent);
    return () => {
      el.removeEventListener(COMPONENT_EVENT_TYPE, handleEvent);
    };
  }, [tagName, componentId, events, onComponentEvent]);

  // 卸载清理：移除元素并清空 ref（Spec §9.1: 组件删除时销毁旧 element）
  useEffect(() => {
    return () => {
      if (elementRef.current !== null) {
        elementRef.current.remove();
        elementRef.current = null;
        prevTagNameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-custom-element-host={tagName}
      style={resolveHostStyle(tagName, style)}
    />
  );
}

/**
 * 创建绑定到特定 tagName 的宿主 renderer（Spec §9.1 + §13.2 Phase 2 + Phase 4 Task 4.1）。
 *
 * `getRendererFromRegistry` 在 source='host' 时调用此工厂，返回的组件签名与
 * 内置/外部 renderer 兼容（接收 `RendererComponentProps`），但只消费
 * componentId / props / style + 可选 mode / interactive / size：
 *
 * - mode / interactive / size 未传入时使用 Phase 2 默认值（design / false / 0x0）
 *   真实预览路径在 Phase 5 接入 preview mode 时由上层 ComponentRenderer 透传
 * - dataSource / logic / interaction / apiRawDataOverride 被忽略（外部组件第一版
 *   不支持，Spec §7.5: 动作不进入 manifest；propsSchema 校验由属性面板负责）
 *
 * Phase 4 Task 4.1：events 从 manifest 闭包捕获，作为 `nebula-component-event`
 * 校验的 allowlist 透传给 CustomElementRenderer。
 *
 * 返回的组件是 memo 化的纯函数，依赖 React 的 prop diff 触发 model 重赋值。
 *
 * @param tagName manifest.tagName（已通过 customElements.define 注册）
 * @param events  manifest.events allowlist（用于事件校验，Spec §9.2.2）
 */
export function createHostElementRenderer(
  tagName: string,
  events?: readonly ScreenComponentEventDefinition[],
): React.ComponentType<RendererComponentProps> {
  function HostElementRenderer({
    componentId,
    props,
    style,
    mode = 'design',
    interactive = false,
    size,
    dataCapability,
    dataState,
  }: RendererComponentProps): React.JSX.Element {
    return (
      <CustomElementRenderer
        tagName={tagName}
        componentId={componentId}
        mode={mode}
        interactive={interactive}
        props={props}
        style={style}
        size={size ?? { width: 0, height: 0 }}
        events={events}
        dataCapability={dataCapability}
        dataState={dataState}
      />
    );
  }
  HostElementRenderer.displayName = `HostElementRenderer(${tagName})`;
  return HostElementRenderer;
}
