import { Injectable } from '@nestjs/common';
import type { SqlDatasetConfig, WebsocketDatasetConfig } from '@nebula/shared/schemas';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { DatasetExecutor, TestResult } from './executor.interface';

/**
 * 未支持类型的执行器（SQL / WebSocket）
 *
 * 设计依据：
 * - `docs/specs/dataset-management/data-model.md` §1.1：websocket 等当前阶段未实现的类型
 *   调用 execute 返回 DATASET_TYPE_NOT_SUPPORTED（80007）
 * - `docs/specs/dataset-management/testing-roadmap.md` §2.1 / §2.2 / §2.3：
 *   SqlExecutor 属第二阶段，WebSocket 属第三阶段
 *
 * 第一阶段：SQL 和 WebSocket 的 CRUD 正常（可创建配置），但 execute / test 返回 80007。
 */
@Injectable()
export class UnsupportedExecutor<TConfig = SqlDatasetConfig | WebsocketDatasetConfig>
  implements DatasetExecutor<TConfig>
{
  execute(config: TConfig, params: Record<string, unknown>): Promise<unknown> {
    void config;
    void params;
    return Promise.reject(new BusinessException(BizCode.DATASET_TYPE_NOT_SUPPORTED));
  }

  test(config: TConfig, params: Record<string, unknown>): Promise<TestResult> {
    void config;
    void params;
    return Promise.reject(new BusinessException(BizCode.DATASET_TYPE_NOT_SUPPORTED));
  }
}
