/**
 * 状态栏偏好持久化（localStorage 单 JSON 键）。
 *
 * 仅持久化状态栏可见的开关：snapEnabled / guidesVisible / eventsEnabled。
 * 其他会话级状态（smartGuidesEnabled / gridEnabled / gridSize / uiVisible / screenMode）
 * 不持久化，保持原会话级行为。
 *
 * 设计要点：
 * - 单一 JSON 键 `nebula:screen-editor:preferences`，便于整体读写与未来字段扩展
 * - localStorage 不可用（隐私模式 / SSR）时静默降级到内存 Map，不抛错
 * - 读写均为同步操作，store 初始化时一次性读取，toggle 时增量写入
 * - 字段缺失或类型不符时回退到默认值，兼容旧版本数据
 */

const STORAGE_KEY = 'nebula:screen-editor:preferences';

/** 持久化的偏好字段及其类型与默认值 */
const PREFERENCE_FIELDS = {
  snapEnabled: { type: 'boolean' as const, default: true },
  guidesVisible: { type: 'boolean' as const, default: true },
  eventsEnabled: { type: 'boolean' as const, default: false },
} satisfies Record<string, { type: 'boolean'; default: boolean }>;

export type PreferenceKey = keyof typeof PREFERENCE_FIELDS;
export type PreferenceValues = Record<PreferenceKey, boolean>;

/** 内存降级存储：localStorage 不可用时使用 */
const memoryFallback = new Map<string, unknown>();

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__nebula_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const localStorageAvailable = typeof window !== 'undefined' && isLocalStorageAvailable();

function readAll(): PreferenceValues {
  const result: PreferenceValues = {
    snapEnabled: PREFERENCE_FIELDS.snapEnabled.default,
    guidesVisible: PREFERENCE_FIELDS.guidesVisible.default,
    eventsEnabled: PREFERENCE_FIELDS.eventsEnabled.default,
  };
  if (localStorageAvailable) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return result;
      const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
      for (const key of Object.keys(PREFERENCE_FIELDS) as PreferenceKey[]) {
        const value = parsed[key];
        if (typeof value === 'boolean') {
          result[key] = value;
        }
      }
    } catch {
      // 解析失败（数据损坏）静默降级到默认值
    }
  } else {
    for (const key of Object.keys(PREFERENCE_FIELDS) as PreferenceKey[]) {
      const value = memoryFallback.get(key);
      if (typeof value === 'boolean') {
        result[key] = value;
      }
    }
  }
  return result;
}

function writeAll(values: PreferenceValues): void {
  if (localStorageAvailable) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // 写入失败（quota 超限 / 隐私模式）静默降级
    }
  } else {
    for (const [key, value] of Object.entries(values)) {
      memoryFallback.set(key, value);
    }
  }
}

/**
 * 读取持久化偏好（全部字段）。
 * 用于 store 初始化时一次性注入初始值。
 */
export function loadPreferences(): PreferenceValues {
  return readAll();
}

/**
 * 写入单个偏好字段（合并到现有持久化数据中）。
 * 用于 toggle action 调用时增量持久化。
 */
export function savePreference(key: PreferenceKey, value: boolean): void {
  const current = readAll();
  current[key] = value;
  writeAll(current);
}
