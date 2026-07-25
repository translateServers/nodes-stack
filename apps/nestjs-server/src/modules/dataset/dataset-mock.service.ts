import { Injectable } from '@nestjs/common';
import type { DatasetMockConfig } from '@nebula/shared/schemas';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';

/**
 * 数据集 Mock 数据生成服务
 *
 * 设计依据：`docs/specs/dataset-management/security-decisions.md` §5
 *
 * 第一阶段实现：
 * - `static`：直接返回 mock.data（已通过 schema superRefine 校验 data 必填）
 * - `echo-params`：回显绑定参数，用于调试参数绑定正确性
 * - `faker-template`：第二阶段实现（@faker-js/faker），第一阶段返回错误
 */
@Injectable()
export class DatasetMockService {
  /**
   * 生成 Mock 数据
   *
   * @param mock Mock 配置
   * @param params 参数绑定值（echo-params 生成器回显此参数）
   * @returns Mock 数据
   */
  generate(mock: DatasetMockConfig, params: Record<string, unknown>): unknown {
    switch (mock.generator) {
      case 'static':
        return this.generateStatic(mock);
      case 'echo-params':
        return this.generateEchoParams(params);
      case 'faker-template':
        return this.generateFaker();
      default: {
        // satisfies never 保证 switch 分支穷尽性：新增 generator 类型时编译报错
        const exhaustive: never = mock.generator;
        throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED, undefined, [
          `未知的 Mock 生成器: ${String(exhaustive)}`,
        ]);
      }
    }
  }

  /**
   * static 生成器：返回 mock.data
   *
   * schema superRefine 已保证 generator='static' 时 data 必填，
   * 但运行时仍做 nullish 检查以防数据被外部直接修改。
   */
  private generateStatic(mock: DatasetMockConfig): unknown {
    if (mock.data === undefined) {
      throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED, undefined, [
        "mock.generator = 'static' 时 data 必填",
      ]);
    }
    return structuredClone(mock.data);
  }

  /**
   * echo-params 生成器：回显绑定参数
   *
   * 用于调试参数绑定是否正确解析。返回结构包含：
   * - params: 原始参数对象
   * - timestamp: 生成时间戳
   */
  private generateEchoParams(params: Record<string, unknown>): unknown {
    return {
      params: structuredClone(params),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * faker-template 生成器（第二阶段）
   *
   * 第一阶段未安装 @faker-js/faker，返回 DATASET_EXECUTION_FAILED。
   * 第二阶段实现后替换为基于模板的数据生成。
   */
  private generateFaker(): unknown {
    throw new BusinessException(BizCode.DATASET_EXECUTION_FAILED, undefined, [
      'faker-template 生成器属第二阶段能力，当前阶段未实现',
    ]);
  }
}
