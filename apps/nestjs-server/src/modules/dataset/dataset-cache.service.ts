import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

/**
 * 数据集缓存服务（内存 LRU）
 *
 * 设计依据：`docs/specs/dataset-management/security-decisions.md` §4.1
 *
 * 特性：
 * - 内存 LRU（第一阶段），后续阶段可扩展 Redis 多实例部署
 * - key = `dataset:{id}:params:{hash(params)}`
 * - TTL 由数据集 `cache.ttl` 配置
 * - 标签失效：`cache.tags` 支持按标签批量失效
 * - 主动失效：数据集更新时清除该 id 的所有缓存
 */

interface CacheEntry {
  value: unknown;
  expireAt: number;
  tags: string[];
}

interface LruNode {
  key: string;
  entry: CacheEntry;
  prev: LruNode | null;
  next: LruNode | null;
}

/**
 * 缓存值与元信息
 */
export interface CacheGetResult<T> {
  value: T;
  fromCache: true;
}

/** 默认 LRU 容量（条目数） */
const DEFAULT_MAX_ENTRIES = 500;

/** 默认 TTL（秒），当数据集未配置 cache.ttl 时使用 */
const DEFAULT_TTL_SECONDS = 60;

export interface CacheSetOptions {
  /** TTL（秒） */
  ttl: number;
  /** 缓存标签 */
  tags?: string[];
}

@Injectable()
export class DatasetCacheService {
  private readonly logger = new Logger(DatasetCacheService.name);
  private readonly maxEntries: number;
  private readonly cache = new Map<string, LruNode>();
  private head: LruNode | null = null; // 最近使用
  private tail: LruNode | null = null; // 最久未使用
  /** 标签到 key 集合的反向索引 */
  private readonly tagIndex = new Map<string, Set<string>>();

  constructor() {
    this.maxEntries = DEFAULT_MAX_ENTRIES;
  }

  /**
   * 生成缓存 key
   */
  static buildKey(datasetId: string, params: Record<string, unknown>): string {
    const paramsHash = createHash('sha256')
      .update(JSON.stringify(params))
      .digest('hex')
      .slice(0, 16);
    return `dataset:${datasetId}:params:${paramsHash}`;
  }

  /**
   * 读取缓存
   *
   * @returns 命中时返回值，未命中或已过期返回 undefined
   */
  get<T>(datasetId: string, params: Record<string, unknown>): T | undefined {
    const key = DatasetCacheService.buildKey(datasetId, params);
    const node = this.cache.get(key);

    if (!node) return undefined;

    // 过期检查
    if (Date.now() > node.entry.expireAt) {
      this.removeNode(node);
      this.cache.delete(key);
      this.removeFromTagIndex(key, node.entry.tags);
      return undefined;
    }

    // 移到头部（最近使用）
    this.moveToHead(node);
    return node.entry.value as T;
  }

  /**
   * 写入缓存
   */
  set(
    datasetId: string,
    params: Record<string, unknown>,
    value: unknown,
    options: CacheSetOptions,
  ): void {
    const key = DatasetCacheService.buildKey(datasetId, params);
    const ttl = options.ttl > 0 ? options.ttl : DEFAULT_TTL_SECONDS;
    const entry: CacheEntry = {
      value,
      expireAt: Date.now() + ttl * 1000,
      tags: options.tags ?? [],
    };

    // 已存在则更新
    const existing = this.cache.get(key);
    if (existing) {
      this.removeFromTagIndex(key, existing.entry.tags);
      existing.entry = entry;
      this.moveToHead(existing);
      this.addToTagIndex(key, entry.tags);
      return;
    }

    // 新增节点
    const node: LruNode = { key, entry, prev: null, next: null };
    this.cache.set(key, node);
    this.addToHead(node);
    this.addToTagIndex(key, entry.tags);

    // 容量淘汰
    this.evictIfNeeded();
  }

  /**
   * 失效指定数据集的所有缓存（数据集更新时调用）
   */
  invalidateDataset(datasetId: string): void {
    const prefix = `dataset:${datasetId}:`;
    for (const [key, node] of this.cache) {
      if (key.startsWith(prefix)) {
        this.removeNode(node);
        this.cache.delete(key);
        this.removeFromTagIndex(key, node.entry.tags);
      }
    }
  }

  /**
   * 按标签批量失效缓存
   */
  invalidateByTag(tag: string): void {
    const keys = this.tagIndex.get(tag);
    if (!keys) return;

    for (const key of keys) {
      const node = this.cache.get(key);
      if (node) {
        this.removeNode(node);
        this.cache.delete(key);
      }
    }
    this.tagIndex.delete(tag);
  }

  /**
   * 按标签批量失效（多个标签）
   */
  invalidateByTags(tags: string[]): void {
    for (const tag of tags) {
      this.invalidateByTag(tag);
    }
  }

  /**
   * 清空所有缓存（测试 / 调试用）
   */
  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * 获取当前缓存条目数（测试用）
   */
  get size(): number {
    return this.cache.size;
  }

  // ===== LRU 内部实现 =====

  private moveToHead(node: LruNode): void {
    if (this.head === node) return;
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: LruNode): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: LruNode): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    node.prev = null;
    node.next = null;
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxEntries && this.tail) {
      const evicted = this.tail;
      this.removeNode(evicted);
      this.cache.delete(evicted.key);
      this.removeFromTagIndex(evicted.key, evicted.entry.tags);
      this.logger.debug?.(`LRU 淘汰缓存: ${evicted.key}`);
    }
  }

  private addToTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      let set = this.tagIndex.get(tag);
      if (!set) {
        set = new Set();
        this.tagIndex.set(tag, set);
      }
      set.add(key);
    }
  }

  private removeFromTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(key);
        if (set.size === 0) this.tagIndex.delete(tag);
      }
    }
  }
}
