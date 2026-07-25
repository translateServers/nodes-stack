import { Injectable, Logger } from '@nestjs/common';
import jsonata from 'jsonata';

/**
 * 数据集 filter 表达式服务
 *
 * 设计依据：`docs/specs/dataset-management/security-decisions.md` §1
 *
 * 安全特性：
 * - 使用 JSONata 声明式表达式引擎（图灵不完备、无 I/O、无全局对象访问）
 * - 超时兜底（默认 1s），防止复杂表达式阻塞事件循环
 * - 求值失败时降级返回原始数据，并记录错误日志（不中断执行）
 */
@Injectable()
export class DatasetFilterService {
  private readonly logger = new Logger(DatasetFilterService.name);

  /** 表达式求值超时（毫秒） */
  private readonly timeoutMs = 1000;

  /**
   * 对数据应用 JSONata filter 表达式
   *
   * @param expression JSONata 表达式字符串
   * @param data 输入数据
   * @returns 求值结果；求值失败时返回原始 data（降级）
   */
  async applyFilter(expression: string, data: unknown): Promise<unknown> {
    let expr;
    try {
      expr = jsonata(expression);
    } catch (err) {
      this.logger.warn(
        `JSONata 表达式语法错误，跳过 filter: ${err instanceof Error ? err.message : String(err)}`,
      );
      return data; // 语法错误降级
    }

    try {
      const result = await this.evaluateWithTimeout(expr, data);
      return result;
    } catch (err) {
      this.logger.warn(
        `JSONata 求值失败，降级返回原始数据: ${err instanceof Error ? err.message : String(err)}`,
      );
      return data; // 求值失败降级
    }
  }

  /**
   * 带超时的 JSONata 求值
   *
   * JSONata 的 evaluate 是异步的（支持异步函数），通过 Promise.race 实现超时。
   */
  private evaluateWithTimeout(expr: jsonata.Expression, data: unknown): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`JSONata 求值超时（${this.timeoutMs}ms）`));
      }, this.timeoutMs);

      Promise.resolve(expr.evaluate(data))
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }
}
