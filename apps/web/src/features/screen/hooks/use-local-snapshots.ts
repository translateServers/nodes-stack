/**
 * 本地快照管理 hook
 *
 * 在 localStorage 中为每个项目保存多个 ScreenProject 快照，
 * 区别于服务端保存，用于本地多次试验不污染线上数据。
 *
 * 存储 key 格式：`screen-snapshot:${projectId}:${timestamp}`
 * 限制：每个项目最多保留 20 条，超出自动删除最旧的。
 *
 * 注意：
 * - 快照数据为完整 ScreenProject（含 canvas + components），单条通常 < 1MB
 * - 写入失败（如 QuotaExceededError）会尝试驱逐最旧条目后重试
 * - 恢复快照会替换 store 当前项目内容（不入历史栈）
 */

import { useCallback, useEffect, useState } from 'react';
import type { ScreenProject } from '@nebula/shared';

const STORAGE_KEY_PREFIX = 'screen-snapshot:';
const MAX_SNAPSHOTS = 20;

export interface SnapshotMeta {
  timestamp: number;
  name: string;
  componentCount: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface SnapshotEntry extends SnapshotMeta {
  data: ScreenProject;
}

/** 构造单个快照的存储 key */
function buildKey(projectId: string, timestamp: number): string {
  return `${STORAGE_KEY_PREFIX}${projectId}:${timestamp}`;
}

/** 从 localStorage key 中解析出 timestamp */
function parseTimestampFromKey(key: string): number | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  const ts = Number(parts[2]);
  return Number.isFinite(ts) ? ts : null;
}

/** 读取单个快照条目（含数据） */
function readEntry(projectId: string, timestamp: number): SnapshotEntry | null {
  const key = buildKey(projectId, timestamp);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as ScreenProject;
    return {
      timestamp,
      name: data.name,
      componentCount: data.components.length,
      canvasWidth: data.canvas.width,
      canvasHeight: data.canvas.height,
      data,
    };
  } catch {
    return null;
  }
}

/** 列出某项目的所有快照元信息（不含数据），按时间倒序 */
function listEntries(projectId: string): SnapshotEntry[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`${STORAGE_KEY_PREFIX}${projectId}:`)) {
      keys.push(key);
    }
  }

  const entries: SnapshotEntry[] = [];
  for (const key of keys) {
    const ts = parseTimestampFromKey(key);
    if (ts == null) continue;
    const entry = readEntry(projectId, ts);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => b.timestamp - a.timestamp);
  return entries;
}

/** 删除某项目最旧的快照 */
function evictOldest(projectId: string): void {
  const entries = listEntries(projectId);
  if (entries.length === 0) return;
  const oldest = entries[entries.length - 1];
  localStorage.removeItem(buildKey(projectId, oldest.timestamp));
}

export function useLocalSnapshots(projectId: string | undefined) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);

  const refresh = useCallback(() => {
    if (!projectId) {
      setSnapshots([]);
      return;
    }
    setSnapshots(
      listEntries(projectId).map((entry) => ({
        timestamp: entry.timestamp,
        name: entry.name,
        componentCount: entry.componentCount,
        canvasWidth: entry.canvasWidth,
        canvasHeight: entry.canvasHeight,
      })),
    );
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** 创建当前项目的快照 */
  const createSnapshot = useCallback(
    (project: ScreenProject): void => {
      if (!projectId) return;
      const timestamp = Date.now();
      const key = buildKey(projectId, timestamp);
      try {
        localStorage.setItem(key, JSON.stringify(project));
      } catch {
        // 配额不足：驱逐最旧后重试一次
        evictOldest(projectId);
        try {
          localStorage.setItem(key, JSON.stringify(project));
        } catch (e) {
          throw new Error(
            `快照保存失败：${e instanceof Error ? e.message : 'localStorage 配额不足'}`,
          );
        }
      }

      // 维护上限：超出 MAX_SNAPSHOTS 删除最旧
      const entries = listEntries(projectId);
      if (entries.length > MAX_SNAPSHOTS) {
        for (let i = MAX_SNAPSHOTS; i < entries.length; i++) {
          localStorage.removeItem(buildKey(projectId, entries[i].timestamp));
        }
      }

      refresh();
    },
    [projectId, refresh],
  );

  /** 恢复指定时间戳的快照（返回 ScreenProject 数据，由调用方决定如何应用） */
  const restoreSnapshot = useCallback(
    (timestamp: number): ScreenProject | null => {
      if (!projectId) return null;
      return readEntry(projectId, timestamp)?.data ?? null;
    },
    [projectId],
  );

  /** 删除单个快照 */
  const deleteSnapshot = useCallback(
    (timestamp: number): void => {
      if (!projectId) return;
      localStorage.removeItem(buildKey(projectId, timestamp));
      refresh();
    },
    [projectId, refresh],
  );

  /** 清空该项目的所有快照 */
  const clearAllSnapshots = useCallback((): void => {
    if (!projectId) return;
    const entries = listEntries(projectId);
    for (const entry of entries) {
      localStorage.removeItem(buildKey(projectId, entry.timestamp));
    }
    refresh();
  }, [projectId, refresh]);

  return {
    snapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    clearAllSnapshots,
  };
}
