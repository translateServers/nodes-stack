/** 状态栏偏好持久化。每个编辑器实例通过 namespace 隔离存储。 */

export const DEFAULT_SCREEN_EDITOR_PREFERENCE_NAMESPACE = 'nebula:screen-sdk:v1';
const LEGACY_STORAGE_KEY = 'nebula:screen-editor:preferences';
const INTERACTION_MODE_VALUES = ['design', 'interactive'] as const;

const PREFERENCE_FIELDS = {
  snapEnabled: { type: 'boolean' as const, default: true },
  guidesVisible: { type: 'boolean' as const, default: true },
  interactionMode: {
    type: 'string' as const,
    default: 'design' as const,
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

export interface PreferenceValues {
  snapEnabled: boolean;
  guidesVisible: boolean;
  interactionMode: (typeof INTERACTION_MODE_VALUES)[number];
}

export interface PreferenceRepository {
  readonly storageKey: string;
  load(): PreferenceValues;
  save<Key extends PreferenceKey>(key: Key, value: PreferenceValues[Key]): void;
}

export interface CreatePreferenceRepositoryOptions {
  namespace?: string;
  persist?: boolean;
}

function createDefaultValues(): PreferenceValues {
  return {
    snapEnabled: PREFERENCE_FIELDS.snapEnabled.default,
    guidesVisible: PREFERENCE_FIELDS.guidesVisible.default,
    interactionMode: PREFERENCE_FIELDS.interactionMode.default,
  };
}

function isValidValue(key: PreferenceKey, value: unknown): boolean {
  const config = PREFERENCE_FIELDS[key];
  if (config.type === 'boolean') return typeof value === 'boolean';
  return (
    typeof value === 'string' &&
    config.validValues.includes(value as (typeof INTERACTION_MODE_VALUES)[number])
  );
}

function parseValues(raw: string | null): PreferenceValues {
  const result = createDefaultValues();
  if (raw === null) return result;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const mutable = result as Record<PreferenceKey, unknown>;
    for (const key of Object.keys(PREFERENCE_FIELDS) as PreferenceKey[]) {
      const value = parsed[key];
      if (isValidValue(key, value)) mutable[key] = value;
    }
  } catch {
    // Corrupt host storage falls back to defaults.
  }
  return result;
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const testKey = '__nebula_screen_preferences_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function createPreferenceRepository(
  options: CreatePreferenceRepositoryOptions = {},
): PreferenceRepository {
  const namespace = options.namespace ?? DEFAULT_SCREEN_EDITOR_PREFERENCE_NAMESPACE;
  const storageKey = `${namespace}:preferences`;
  const persist = options.persist ?? true;
  const memory = new Map<string, string>();

  const readRaw = (): string | null => {
    if (!persist) return memory.get(storageKey) ?? null;
    const storage = getLocalStorage();
    if (storage === undefined) return memory.get(storageKey) ?? null;
    const current = storage.getItem(storageKey);
    if (current !== null) return current;
    if (namespace === DEFAULT_SCREEN_EDITOR_PREFERENCE_NAMESPACE) {
      return storage.getItem(LEGACY_STORAGE_KEY);
    }
    return null;
  };

  const write = (values: PreferenceValues): void => {
    const serialized = JSON.stringify(values);
    if (persist) {
      const storage = getLocalStorage();
      if (storage !== undefined) {
        try {
          storage.setItem(storageKey, serialized);
          return;
        } catch {
          // Quota and privacy failures use this instance's memory fallback.
        }
      }
    }
    memory.set(storageKey, serialized);
  };

  return {
    storageKey,
    load: () => parseValues(readRaw()),
    save: (key, value) => {
      const current = parseValues(readRaw());
      current[key] = value;
      write(current);
    },
  };
}
