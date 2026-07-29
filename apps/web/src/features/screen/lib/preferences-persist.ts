/**
 * 状态栏偏好持久化（localStorage 单 JSON 键）。
 *
 * 持久化字段：
 * - snapEnabled / guidesVisible：布尔开关
 * - interactionMode：画布交互模式（'design' | 'interactive'），默认 'design'
 *
 * 偏好迁移：
 * - 旧版 `eventsEnabled`（布尔）不再读取，无论何值均安全回退到 `design`，
 *   避免打开项目即自动执行蓝图副作用。
 * - 新版 `interactionMode` 缺失或值不合法时回退到 `design`。
 *
 * 设计要点：
 * - 单一 JSON 键 `nebula:screen-editor:preferences`，便于整体读写与未来字段扩展
 * - localStorage 不可用（隐私模式 / SSR）时静默降级到内存 Map，不抛错
 * - 读写均为同步操作，store 初始化时一次性读取，toggle 时增量写入
 * - 字段缺失或类型不符时回退到默认值，兼容旧版本数据
 */

const STORAGE_KEY = 'nebula:screen-editor:preferences';

/** 画布交互模式合法值 */
const INTERACTION_MODE_VALUES = ['design', 'interactive'] as const;

/** 持久化的偏好字段及其类型与默认值 */
const PREFERENCE_FIELDS = {
  snapEnabled: { type: 'boolean' as const, default: true },
  guidesVisible: { type: 'boolean' as const, default: true },
  interactionMode: {
    type: 'string' as const,
    default: 'design',
    validValues: INTERACTION_MODE_VALUES,
  },
} satisfies Record<string, PreferenceFieldConfig>;

interface BooleanPreferenceFieldConfig {
  type: 'boolean';
  default: boolean;
}

interface StringPreferenceFieldConfig {
  type: 'string';
  default: string;
  validValues: readonly string[];
}

type PreferenceFieldConfig = BooleanPreferenceFieldConfig | StringPreferenceFieldConfig;

export type PreferenceKey = keyof typeof PREFERENCE_FIELDS;

export type PreferenceValues = {
  snapEnabled: boolean;
  guidesVisible: boolean;
  interactionMode: (typeof INTERACTION_MODE_VALUES)[number];
};

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

/**
 * 校验字段值是否符合配置约束。
 * - boolean 字段：值必须为 `typeof value === 'boolean'`
 * - string 字段：值必须为 `typeof value === 'string'` 且在 `validValues` 列表中
 */
function isValidValue(key: PreferenceKey, value: unknown): boolean {
  const config = PREFERENCE_FIELDS[key];
  if (config.type === 'boolean') {
    return typeof value === 'boolean';
  }
  return typeof value === 'string' && (config.validValues as readonly string[]).includes(value);
}

function readAll(): PreferenceValues {
  const result: PreferenceValues = {
    snapEnabled: PREFERENCE_FIELDS.snapEnabled.default,
    guidesVisible: PREFERENCE_FIELDS.guidesVisible.default,
    interactionMode: PREFERENCE_FIELDS.interactionMode
      .default as (typeof INTERACTION_MODE_VALUES)[number],
  };
  // 使用可变 record 中间层，避免 TypeScript 对联合类型字段赋值的严格检查
  const mutable = result as Record<PreferenceKey, unknown>;
  if (localStorageAvailable) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return result;
      const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
      for (const key of Object.keys(PREFERENCE_FIELDS) as PreferenceKey[]) {
        const value = parsed[key];
        if (isValidValue(key, value)) {
          mutable[key] = value;
        }
      }
      // 旧版 eventsEnabled 字段不读取，无论何值均安全回退到 design
    } catch {
      // 解析失败（数据损坏）静默降级到默认值
    }
  } else {
    for (const key of Object.keys(PREFERENCE_FIELDS) as PreferenceKey[]) {
      const value = memoryFallback.get(key);
      if (isValidValue(key, value)) {
        mutable[key] = value;
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
 * 用于 setInteractionMode / toggle action 调用时增量持久化。
 */
export function savePreference<K extends PreferenceKey>(key: K, value: PreferenceValues[K]): void {
  const current = readAll();
  current[key] = value;
  writeAll(current);
}
