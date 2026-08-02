/**
 * 组件事件桥接纯函数（Spec §9.2）
 *
 * 在 editor-core 的 `CustomElementRenderer` 监听到 `nebula-component-event`
 * CustomEvent 后调用本模块的 `validateComponentEvent` 完成校验与裁剪：
 *
 * 校验链：
 * 1. detail.name 非空字符串 → 否则 INVALID_EVENT_NAME
 * 2. detail.name 必须在 manifest.events[] allowlist 内 → 否则 EVENT_NOT_DECLARED
 * 3. detail.payload（若定义）必须通过 JSON 边界校验 → 否则 INVALID_EVENT_PAYLOAD
 * 4. JSON.stringify(payload).length <= MAX_EVENT_PAYLOAD_BYTES（64 KiB）→ 否则 PAYLOAD_TOO_LARGE
 *
 * 成功时返回 detached clone（structuredClone），组件后续修改原 payload 不影响
 * 蓝图运行时上下文（Spec §9.2.5: payload 使用 detached JSON boundary）。
 *
 * 本模块保持零运行时依赖，仅引用 SDK 内部契约与校验工具。
 */

import {
  MAX_EVENT_PAYLOAD_BYTES,
  type ScreenComponentEventDetail,
  type ScreenComponentEventDefinition,
} from '../contracts/event.js';
import { checkJsonValue } from '../validation/json-boundary.js';
import type { ScreenComponentValidationDiagnostic } from '../contracts/diagnostic.js';

/**
 * Manifest 入参的最小子集（仅需要 events 字段）。
 *
 * 解耦完整 `ScreenComponentManifest`，使 editor-core 在 renderer 闭包内
 * 构造轻量 manifest-like 对象即可调用校验，无需持有完整 manifest 引用。
 */
export interface ComponentEventBridgeManifestLike {
  readonly events?: readonly ScreenComponentEventDefinition[];
}

/** 校验失败码（Spec §9.2.6: 失败日志仅包含 code+message，不含 payload） */
export type ComponentEventBridgeCode =
  | 'INVALID_EVENT_NAME'
  | 'EVENT_NOT_DECLARED'
  | 'INVALID_EVENT_PAYLOAD'
  | 'PAYLOAD_TOO_LARGE';

/** 校验成功结果 */
export interface ComponentEventBridgeSuccess {
  readonly ok: true;
  /** 事件 ID（即 detail.name，校验通过后回传） */
  readonly eventId: string;
  /** detached payload（undefined 表示事件无 payload） */
  readonly payload: unknown;
}

/** 校验失败结果 */
export interface ComponentEventBridgeFailure {
  readonly ok: false;
  readonly code: ComponentEventBridgeCode;
  readonly message: string;
}

/** 校验结果判别联合 */
export type ComponentEventBridgeResult = ComponentEventBridgeSuccess | ComponentEventBridgeFailure;

/**
 * 校验组件派发的事件（Spec §9.2）。
 *
 * @param detail   组件派发的 CustomEvent.detail（结构：`{ name, payload? }`）
 * @param manifest 组件 manifest（仅需 events 字段）
 * @returns 成功返回 detached payload；失败返回 code+message（不含 payload）
 */
export function validateComponentEvent(
  detail: ScreenComponentEventDetail,
  manifest: ComponentEventBridgeManifestLike,
): ComponentEventBridgeResult {
  const { name } = detail;

  // 1. name 必须是非空字符串
  if (typeof name !== 'string' || name.length === 0) {
    return {
      ok: false,
      code: 'INVALID_EVENT_NAME',
      message: 'event name 必须是非空字符串',
    };
  }

  // 2. name 必须在 manifest.events allowlist 内（Spec §9.2.2: 未声明事件不执行蓝图）
  const declared = manifest.events?.some((e) => e.id === name) ?? false;
  if (!declared) {
    return {
      ok: false,
      code: 'EVENT_NOT_DECLARED',
      message: `event "${name}" 未在 manifest.events 中声明`,
    };
  }

  // 3. payload JSON 边界校验（payload 可能 undefined，表示无载荷）
  const { payload } = detail;
  if (payload !== undefined) {
    const diagnostics: ScreenComponentValidationDiagnostic[] = [];
    if (!checkJsonValue(payload, ['payload'], diagnostics)) {
      const first = diagnostics[0];
      return {
        ok: false,
        code: 'INVALID_EVENT_PAYLOAD',
        message: first ? `payload 不符合 JSON 边界: ${first.message}` : 'payload 不符合 JSON 边界',
      };
    }

    // 4. 体积上限（Spec §9.2.4: payload ≤ 64 KiB）
    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch (err) {
      return {
        ok: false,
        code: 'INVALID_EVENT_PAYLOAD',
        message: `payload 序列化失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (serialized.length > MAX_EVENT_PAYLOAD_BYTES) {
      return {
        ok: false,
        code: 'PAYLOAD_TOO_LARGE',
        message: `payload 体积 ${serialized.length} 字节超过上限 ${MAX_EVENT_PAYLOAD_BYTES} 字节`,
      };
    }
  }

  // 成功：detached clone（Spec §9.2.5: 后续组件修改原 payload 不影响运行时上下文）
  const detached = payload === undefined ? undefined : structuredClone(payload);
  return {
    ok: true,
    eventId: name,
    payload: detached,
  };
}
