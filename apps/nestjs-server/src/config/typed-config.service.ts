import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService as NestConfigService } from '@nestjs/config';
import type { RootConfig } from './schemas/root.schema';
import type { ConfigPath, ConfigPathValue } from './types';

@Injectable()
export class TypedConfigService {
  private readonly logger = new Logger(TypedConfigService.name);
  private readonly config: RootConfig;

  constructor(private readonly nestConfigService: NestConfigService) {
    this.config = this.nestConfigService.get<RootConfig>('root')!;

    if (!this.config) {
      this.logger.error('Root configuration is missing!');
      process.exit(1);
    }
  }

  /**
   * 获取配置值，支持点语法（Dot Notation）
   */
  get<P extends ConfigPath<RootConfig>>(path: P): ConfigPathValue<RootConfig, P> {
    // 运行时解析点语法
    const keys = path.split('.');
    let result: unknown = this.config;

    for (const key of keys) {
      if (result == null) {
        throw new Error(`Configuration path "${path}" is undefined.`);
      }
      result = (result as Record<string, unknown>)[key];
    }

    return result as ConfigPathValue<RootConfig, P>;
  }

  /**
   * 获取整个 Namespace 对象（作为 get 方法的补充，语义更清晰）
   * @example config.namespace('database') -> 返回完整的 DatabaseConfig
   */
  namespace<K extends keyof RootConfig>(namespace: K): RootConfig[K] {
    return this.config[namespace];
  }
}
