import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { TypedConfigService } from '@/config/typed-config.service';

/**
 * Redis 服务
 *
 * - **懒加载**：客户端实例在首次访问 `client` 时才创建，不在构造函数中执行。
 * - **非阻塞启动**：`onModuleInit` 在后台发起连接，不阻塞应用初始化流程。
 * - **最大重试限制**：超过 `maxRetries` 后停止重连，避免无限等待。
 * - **连接超时控制**：通过 `connectTimeout` 控制单次连接尝试的超时时间。
 *
 * 使用方式：
 *   - `redisService.client` — 获取原始 node-redis 客户端（首次访问时触发懒加载）
 *   - `redisService.isConnected` — 查询当前连接状态
 *   - `redisService.ready` — Promise，等待连接就绪（适用于需要确保连接可用的场景）
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private _client: RedisClientType | null = null;
  private _isConnected = false;
  private _connectPromise: Promise<void> | null = null;

  /** 缓存配置，避免每次访问 client 都重新读取 */
  private readonly redisConfig: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    connectTimeout: number;
    maxRetries: number;
    lazyConnect: boolean;
  };

  constructor(private readonly config: TypedConfigService) {
    this.redisConfig = this.config.namespace('redis');
  }

  /**
   * 懒加载获取 Redis 客户端。
   * 首次调用时创建实例并触发连接（若 lazyConnect=false）。
   */
  get client(): RedisClientType {
    if (!this._client) {
      this._client = this.createClient();
      // 非 lazyConnect 模式：创建后立即在后台发起连接
      if (!this.redisConfig.lazyConnect) {
        this.connectInBackground();
      }
    }
    return this._client;
  }

  /** 当前是否已连接 */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * 返回一个 Promise，在 Redis 连接就绪后 resolve。
   * 适用于必须等待连接可用的场景（如健康检查）。
   */
  get ready(): Promise<void> {
    if (this._isConnected) return Promise.resolve();
    if (!this._connectPromise) {
      // 确保 client 已创建并触发连接
      void this.client;
    }
    return this._connectPromise ?? Promise.resolve();
  }

  async onModuleDestroy() {
    if (this._client && this._isConnected) {
      await this._client.quit();
      this._isConnected = false;
      this.logger.log('Redis disconnected');
    }
  }

  /** 检查 Redis 连接是否正常 */
  async ping(): Promise<boolean> {
    if (!this._isConnected) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // --------------- 私有方法 ---------------

  private createClient(): RedisClientType {
    const { host, port, password, db, connectTimeout, maxRetries } = this.redisConfig;

    const auth = password ? `:${password}@` : '';
    const url = `redis://${auth}${host}:${port}/${db}`;

    const client = createClient({
      url,
      socket: {
        connectTimeout,
        reconnectStrategy(retries: number) {
          if (retries > maxRetries) {
            return new Error(`Redis max reconnection attempts reached (${maxRetries})`);
          }
          // 指数退避，上限 2s
          return Math.min(retries * 500, 2000);
        },
      },
    }) as RedisClientType;

    client.on('error', (err) => {
      this.logger.error(`Redis client error: ${err.message}`);
    });

    client.on('end', () => {
      this._isConnected = false;
    });

    // 用 console 打印，因为 NestJS 启动阶段 bufferLogs=true 会缓冲 Logger 输出
    console.log(
      `[RedisService] Client created → ${host}:${port}/${db} (timeout=${connectTimeout}ms, maxRetries=${maxRetries})`,
    );

    return client;
  }

  private connectInBackground(): void {
    const { host, port, db } = this.redisConfig;

    this._connectPromise = this.client
      .connect()
      .then(() => {
        this._isConnected = true;
        console.log(`[RedisService] Redis connected: ${host}:${port}/${db}`);
        this.logger.log(`Redis connected: ${host}:${port}/${db}`);
      })
      .catch((err) => {
        this._isConnected = false;
        console.error(`[RedisService] Redis connection failed: ${(err as Error).message}`);
        this.logger.error(`Redis connection failed: ${(err as Error).message}`);
      });
  }
}
