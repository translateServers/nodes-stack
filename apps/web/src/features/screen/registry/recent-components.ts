/**
 * 最近使用组件追踪（Phase 2 Slice C）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §2.2 第二档
 *
 * 拖拽 / 点击创建组件时记录 type 与使用计数、最近使用时间戳，
 * 组件库顶部展示「最近使用」分区（无需后端，localStorage 持久化）。
 *
 * 持久化结构：
 * ```
 * {
 *   "text": { count: 3, lastUsedAt: 1784686748000 },
 *   "bar-chart": { count: 1, lastUsedAt: 1784680000000 }
 * }
 * ```
 *
 * 读取时按 lastUsedAt 倒序取前 N 条（默认 5）。
 */

const STORAGE_KEY = 'nebula:recent-components';
const DEFAULT_LIMIT = 5;
const MAX_ENTRIES = 20;

/** 单个组件的使用统计 */
export interface RecentComponentEntry {
  /** 组件 type */
  type: string;
  /** 累计使用次数 */
  count: number;
  /** 最近一次使用的时间戳（ms） */
  lastUsedAt: number;
}

type RecentMap = Record<string, RecentComponentEntry>;

function safeRead(): RecentMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as RecentMap;
  } catch {
    // 损坏数据 / 无 localStorage 权限时静默回退为空记录
    return {};
  }
}

function safeWrite(map: RecentMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 写入失败（隐私模式 / 配额满）静默忽略，不阻塞创建流程
  }
}

/**
 * 记录一次组件使用：count += 1，lastUsedAt 更新为当前时间。
 *
 * @param type 组件 type
 * @param now 时间戳（默认 Date.now()，参数化便于测试）
 */
export function recordComponentUsage(type: string, now: number = Date.now()): void {
  const map = safeRead();
  const prev = map[type];
  map[type] = {
    type,
    count: prev === undefined ? 1 : prev.count + 1,
    lastUsedAt: now,
  };
  // 超过 MAX_ENTRIES 时按 lastUsedAt 保留最新的一批
  const entries = Object.values(map).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  if (entries.length > MAX_ENTRIES) {
    const trimmed: RecentMap = {};
    for (const entry of entries.slice(0, MAX_ENTRIES)) {
      trimmed[entry.type] = entry;
    }
    safeWrite(trimmed);
    return;
  }
  safeWrite(map);
}

/**
 * 读取最近使用的组件 type 列表（按 lastUsedAt 倒序）。
 *
 * @param limit 返回条目数上限（默认 5）
 * @returns 按最近使用倒序排列的 entry 数组
 */
export function getRecentComponents(limit: number = DEFAULT_LIMIT): RecentComponentEntry[] {
  const map = safeRead();
  return Object.values(map)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit);
}

/**
 * 清空最近使用记录（用于测试 / 用户手动清除）。
 */
export function clearRecentComponents(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上：静默忽略
  }
}

/** 用于测试：直接覆写存储内容 */
export function __setRecentComponentsForTest(entries: RecentComponentEntry[]): void {
  const map: RecentMap = {};
  for (const entry of entries) {
    map[entry.type] = entry;
  }
  safeWrite(map);
}
