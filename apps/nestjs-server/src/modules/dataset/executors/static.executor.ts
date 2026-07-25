import { Injectable } from '@nestjs/common';
import type { StaticDatasetConfig } from '@nebula/shared/schemas';
import type { DatasetExecutor, TestResult } from './executor.interface';

/**
 * 静态数据集执行器
 *
 * 直接返回 config.staticData，无外部请求。
 * 设计依据：`docs/specs/dataset-management/architecture.md` §5.1
 */
@Injectable()
export class StaticExecutor implements DatasetExecutor<StaticDatasetConfig> {
  execute(config: StaticDatasetConfig, params: Record<string, unknown>): Promise<unknown> {
    void params; // static 数据集不使用参数绑定
    // 返回深拷贝避免调用方修改原始配置
    return Promise.resolve(structuredClone(config.staticData));
  }

  async test(config: StaticDatasetConfig, params: Record<string, unknown>): Promise<TestResult> {
    const start = Date.now();
    const raw = await this.execute(config, params);
    return {
      raw,
      parsed: raw, // static 数据无需额外解析，raw = parsed
      meta: { durationMs: Date.now() - start },
    };
  }
}
