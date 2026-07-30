import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPreferenceRepository,
  type PreferenceKey,
  type PreferenceValues,
} from './preferences-persist';

const LEGACY_STORAGE_KEY = 'nebula:screen-editor:preferences';
const STORAGE_KEY = 'nebula:screen-sdk:v1:preferences';
const repository = createPreferenceRepository();
const loadPreferences = () => repository.load();
function savePreference<Key extends PreferenceKey>(key: Key, value: PreferenceValues[Key]): void {
  repository.save(key, value);
}

describe('preferences-persist: interactionMode 迁移', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('默认值为 design', () => {
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('design');
  });

  it('读取合法的 interactionMode=interactive', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        snapEnabled: true,
        guidesVisible: true,
        interactionMode: 'interactive',
      }),
    );
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('interactive');
  });

  it('旧版 eventsEnabled=true 不自动恢复为交互调试，安全回退到 design', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        snapEnabled: true,
        guidesVisible: true,
        eventsEnabled: true,
      }),
    );
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('design');
  });

  it('旧版 eventsEnabled=false 也回退到 design', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        snapEnabled: true,
        guidesVisible: true,
        eventsEnabled: false,
      }),
    );
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('design');
  });

  it('interactionMode 值不合法时回退到 design', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        snapEnabled: true,
        guidesVisible: true,
        interactionMode: 'invalid-mode',
      }),
    );
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('design');
  });

  it('interactionMode 缺失时回退到 design', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        snapEnabled: true,
        guidesVisible: true,
      }),
    );
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('design');
  });

  it('数据损坏（非法 JSON）时回退到全部默认值', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, '{not valid json');
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('design');
    expect(prefs.snapEnabled).toBe(true);
    expect(prefs.guidesVisible).toBe(true);
  });

  it('savePreference 持久化 interactionMode', () => {
    savePreference('interactionMode', 'interactive');
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    expect(parsed.interactionMode).toBe('interactive');
  });

  it('savePreference 后 loadPreferences 读取一致', () => {
    savePreference('interactionMode', 'interactive');
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('interactive');
  });

  it('savePreference 不写入旧版 eventsEnabled 字段', () => {
    savePreference('interactionMode', 'design');
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    expect(parsed.eventsEnabled).toBeUndefined();
  });

  it('旧版 eventsEnabled 与新版 interactionMode 共存时以 interactionMode 为准', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        eventsEnabled: true,
        interactionMode: 'design',
      }),
    );
    const prefs = loadPreferences();
    expect(prefs.interactionMode).toBe('design');
  });

  it('不同 namespace 的持久化偏好互不影响', () => {
    const first = createPreferenceRepository({ namespace: 'tenant-a' });
    const second = createPreferenceRepository({ namespace: 'tenant-b' });
    first.save('interactionMode', 'interactive');

    expect(first.load().interactionMode).toBe('interactive');
    expect(second.load().interactionMode).toBe('design');
    expect(localStorage.getItem('tenant-a:preferences')).not.toBeNull();
    expect(localStorage.getItem('tenant-b:preferences')).toBeNull();
  });

  it('persist=false 使用实例内存且不写 localStorage', () => {
    const first = createPreferenceRepository({ namespace: 'memory', persist: false });
    const second = createPreferenceRepository({ namespace: 'memory', persist: false });
    first.save('snapEnabled', false);

    expect(first.load().snapEnabled).toBe(false);
    expect(second.load().snapEnabled).toBe(true);
    expect(localStorage.getItem('memory:preferences')).toBeNull();
  });
});
