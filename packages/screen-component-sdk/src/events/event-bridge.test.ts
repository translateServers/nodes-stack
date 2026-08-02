/**
 * 事件桥接纯函数测试（Task 4.1, Spec §9.2）
 *
 * 覆盖：
 * - 成功路径：合法事件名 + manifest 声明 + 合法 payload → detached clone
 * - 失败码 1: INVALID_EVENT_NAME（空字符串、非字符串）
 * - 失败码 2: EVENT_NOT_DECLARED（未在 manifest.events 中声明）
 * - 失败码 3: INVALID_EVENT_PAYLOAD（含 function/symbol/bigint/循环引用）
 * - 失败码 4: PAYLOAD_TOO_LARGE（超过 64 KiB）
 * - detached clone 验证：校验后修改原 payload，结果中的 payload 不变
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_EVENT_PAYLOAD_BYTES,
  type ScreenComponentEventDetail,
  type ScreenComponentEventDefinition,
} from '../contracts/event.js';
import { validateComponentEvent, type ComponentEventBridgeManifestLike } from './event-bridge.js';

const declaredEvents: ScreenComponentEventDefinition[] = [
  { id: 'valueClick', name: '点击数值' },
  { id: 'dataLoaded', name: '数据加载完成' },
];

const manifest: ComponentEventBridgeManifestLike = { events: declaredEvents };

describe('validateComponentEvent · 成功路径', () => {
  it('合法事件名 + 声明 + 无 payload → ok=true, payload=undefined', () => {
    const detail: ScreenComponentEventDetail = { name: 'valueClick' };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eventId).toBe('valueClick');
      expect(result.payload).toBeUndefined();
    }
  });

  it('合法事件名 + 声明 + JSON payload → ok=true, payload=detached clone', () => {
    const detail: ScreenComponentEventDetail = {
      name: 'valueClick',
      payload: { value: 100, label: '销售额' },
    };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eventId).toBe('valueClick');
      expect(result.payload).toEqual({ value: 100, label: '销售额' });
    }
  });

  it('payload=null 被视为合法 JSON 值', () => {
    const detail: ScreenComponentEventDetail = {
      name: 'dataLoaded',
      payload: null,
    };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toBeNull();
    }
  });

  it('payload=数组 被视为合法 JSON 值', () => {
    const detail: ScreenComponentEventDetail = {
      name: 'valueClick',
      payload: [1, 2, 3, { nested: 'ok' }],
    };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual([1, 2, 3, { nested: 'ok' }]);
    }
  });

  it('manifest.events 为空数组时所有事件都被视为未声明', () => {
    const emptyManifest: ComponentEventBridgeManifestLike = { events: [] };
    const detail: ScreenComponentEventDetail = { name: 'valueClick' };
    const result = validateComponentEvent(detail, emptyManifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EVENT_NOT_DECLARED');
    }
  });

  it('manifest.events 为 undefined 时所有事件都被视为未声明', () => {
    const noEventsManifest: ComponentEventBridgeManifestLike = {};
    const detail: ScreenComponentEventDetail = { name: 'valueClick' };
    const result = validateComponentEvent(detail, noEventsManifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EVENT_NOT_DECLARED');
    }
  });
});

describe('validateComponentEvent · detached clone（Spec §9.2.5）', () => {
  it('校验后修改原 payload，结果中的 payload 不变', () => {
    const originalPayload = { value: 100, nested: { count: 1 } };
    const detail: ScreenComponentEventDetail = {
      name: 'valueClick',
      payload: originalPayload,
    };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 修改原 payload
    originalPayload.value = 999;
    originalPayload.nested.count = 999;

    // 结果中的 payload 不应被影响
    const resultPayload = result.payload as { value: number; nested: { count: number } };
    expect(resultPayload.value).toBe(100);
    expect(resultPayload.nested.count).toBe(1);
  });

  it('校验后修改结果中的 payload，不影响原 payload', () => {
    const originalPayload = { value: 100 };
    const detail: ScreenComponentEventDetail = {
      name: 'valueClick',
      payload: originalPayload,
    };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 修改结果中的 payload
    const resultPayload = result.payload as { value: number };
    resultPayload.value = 999;

    // 原 payload 不应被影响
    expect(originalPayload.value).toBe(100);
  });

  it('数组 payload 也被 detached', () => {
    const originalPayload = [1, 2, 3];
    const detail: ScreenComponentEventDetail = {
      name: 'valueClick',
      payload: originalPayload,
    };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    originalPayload.push(4);
    const resultPayload = result.payload as number[];
    expect(resultPayload).toEqual([1, 2, 3]);
    expect(resultPayload).not.toBe(originalPayload);
  });
});

describe('validateComponentEvent · INVALID_EVENT_NAME', () => {
  it('空字符串事件名 → INVALID_EVENT_NAME', () => {
    const detail = { name: '' } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_NAME');
      expect(result.message).toContain('非空字符串');
    }
  });

  it('非字符串事件名 → INVALID_EVENT_NAME', () => {
    const detail = { name: 123 } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_NAME');
    }
  });
});

describe('validateComponentEvent · EVENT_NOT_DECLARED', () => {
  it('合法非空事件名但未在 manifest 中声明 → EVENT_NOT_DECLARED', () => {
    const detail: ScreenComponentEventDetail = { name: 'unknownEvent' };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EVENT_NOT_DECLARED');
      expect(result.message).toContain('unknownEvent');
      // 失败结果不应包含 payload（Spec §9.2.6）
      expect('payload' in result).toBe(false);
    }
  });
});

describe('validateComponentEvent · INVALID_EVENT_PAYLOAD', () => {
  it('payload 含 function → INVALID_EVENT_PAYLOAD', () => {
    const detail = {
      name: 'valueClick',
      payload: { cb: () => null },
    } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_PAYLOAD');
    }
  });

  it('payload 含 symbol → INVALID_EVENT_PAYLOAD', () => {
    const detail = {
      name: 'valueClick',
      payload: { sym: Symbol('s') },
    } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_PAYLOAD');
    }
  });

  it('payload 含 bigint → INVALID_EVENT_PAYLOAD', () => {
    const detail = {
      name: 'valueClick',
      payload: { big: 10n },
    } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_PAYLOAD');
    }
  });

  it('payload 循环引用 → INVALID_EVENT_PAYLOAD', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    const detail = {
      name: 'valueClick',
      payload: cyclic,
    } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_PAYLOAD');
    }
  });

  it('payload 为 class 实例 → INVALID_EVENT_PAYLOAD', () => {
    class MyClass {
      public value = 1;
    }
    const detail = {
      name: 'valueClick',
      payload: new MyClass(),
    } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_PAYLOAD');
    }
  });

  it('payload 含 prototype pollution 键 __proto__ → INVALID_EVENT_PAYLOAD', () => {
    const detail = {
      name: 'valueClick',
      payload: { __proto__: { polluted: true } },
    } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_PAYLOAD');
    }
  });

  it('payload 含 NaN → INVALID_EVENT_PAYLOAD', () => {
    const detail = {
      name: 'valueClick',
      payload: { value: Number.NaN },
    } as unknown as ScreenComponentEventDetail;
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_EVENT_PAYLOAD');
    }
  });
});

describe('validateComponentEvent · PAYLOAD_TOO_LARGE', () => {
  it('payload 序列化后超过 64 KiB → PAYLOAD_TOO_LARGE', () => {
    // 构造 > 64 KiB 的字符串
    const oversized = 'x'.repeat(MAX_EVENT_PAYLOAD_BYTES + 1);
    const detail: ScreenComponentEventDetail = {
      name: 'valueClick',
      payload: { data: oversized },
    };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PAYLOAD_TOO_LARGE');
      expect(result.message).toContain(String(MAX_EVENT_PAYLOAD_BYTES));
    }
  });

  it('payload 序列化后等于 64 KiB → ok=true（边界值）', () => {
    // 构造恰好 = 64 KiB 的 JSON 序列化字符串
    // JSON.stringify({data:"xxx"}) 长度 = 11 + 字符串长度（含引号）
    // 目标长度 = MAX_EVENT_PAYLOAD_BYTES → 字符串长度 = MAX - 11
    const targetLen = MAX_EVENT_PAYLOAD_BYTES - 11;
    const exactFit = 'x'.repeat(targetLen);
    const detail: ScreenComponentEventDetail = {
      name: 'valueClick',
      payload: { data: exactFit },
    };
    const result = validateComponentEvent(detail, manifest);
    expect(result.ok).toBe(true);
  });
});
