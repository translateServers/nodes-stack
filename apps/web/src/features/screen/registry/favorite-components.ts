/**
 * 组件收藏存储（Spec Task 6）
 *
 * 让用户 pin/star 常用组件，收藏数据持久化到 localStorage。
 * 风格与 recent-components.ts 保持一致。
 *
 * 持久化结构：
 * ```
 * {
 *   "text": { type: "text", favoritedAt: 1784686748000 },
 *   "bar-chart": { type: "bar-chart", favoritedAt: 1784680000000 }
 * }
 * ```
 *
 * 读取时按 favoritedAt 倒序返回（最近收藏在前）。
 * 收藏是用户主动行为，不限制数量，也不累加计数。
 */

const STORAGE_KEY = 'nebula:favorite-components';

/** 单个组件的收藏记录 */
export interface FavoriteEntry {
  /** 组件 type */
  type: string;
  /** 收藏时间戳（ms） */
  favoritedAt: number;
}

type FavoriteMap = Record<string, FavoriteEntry>;

function safeRead(): FavoriteMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as FavoriteMap;
  } catch {
    // JSON parse 失败：清空损坏数据，避免后续读取持续失败
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 静默忽略（隐私模式 / 无写入权限）
    }
    return {};
  }
}

function safeWrite(map: FavoriteMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 写入失败（隐私模式 / 配额满）静默忽略，不阻塞收藏流程
  }
}

function dispatchUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('favorite-components:updated'));
}

/**
 * 切换组件收藏状态：已收藏则取消，未收藏则添加。
 *
 * @param type 组件 type
 * @param now 时间戳（默认 Date.now()，参数化便于测试）
 */
export function toggleFavorite(type: string, now: number = Date.now()): void {
  const map = safeRead();
  if (map[type] === undefined) {
    map[type] = { type, favoritedAt: now };
  } else {
    delete map[type];
  }
  safeWrite(map);
  dispatchUpdated();
}

/**
 * 查询组件是否已收藏。
 *
 * @param type 组件 type
 * @returns 已收藏返回 true，否则 false
 */
export function isFavorite(type: string): boolean {
  const map = safeRead();
  return map[type] !== undefined;
}

/**
 * 读取所有收藏组件，按 favoritedAt 倒序排列（最近收藏在前）。
 *
 * @returns 按收藏时间倒序排列的 entry 数组
 */
export function getFavoriteComponents(): FavoriteEntry[] {
  const map = safeRead();
  return Object.values(map).sort((a, b) => b.favoritedAt - a.favoritedAt);
}

/**
 * 清空所有收藏记录。
 */
export function clearFavorites(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默忽略
  }
  dispatchUpdated();
}

/** 用于测试：直接覆写存储内容 */
export function __setFavoritesForTest(entries: Record<string, FavoriteEntry>): void {
  safeWrite(entries);
}
