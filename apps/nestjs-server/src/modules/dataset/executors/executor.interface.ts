/**
 * 数据集执行器抽象接口
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §1.1
 *
 * 每种数据集类型（static / api / sql / websocket）实现一个 Executor。
 * DatasetService 根据 dataset.type 选择对应 Executor 执行。
 */

/**
 * 测试执行结果元信息
 */
export interface TestResultMeta {
  /** 执行耗时（毫秒） */
  durationMs: number;
}

/**
 * 测试执行结果
 *
 * 与正式执行结果同构，区别在不缓存、返回原始 + 解析后结果 + 元信息。
 */
export interface TestResult {
  /** 原始响应数据 */
  raw: unknown;
  /** 解析后数据（应用 dataPath + fieldMapping + filter 后） */
  parsed: unknown;
  /** 元信息 */
  meta: TestResultMeta;
}

/**
 * 数据集执行器接口
 *
 * @typeParam TConfig 该类型数据集的配置结构（如 StaticDatasetConfig / ApiDatasetConfig）
 */
export interface DatasetExecutor<TConfig> {
  /**
   * 正式执行（受缓存策略控制）
   *
   * @param config 数据集配置（按 type 分支的具体结构）
   * @param params 参数绑定值（由组件 paramBindings 解析后传入）
   * @returns 原始响应数据（未应用 dataPath / fieldMapping / filter）
   */
  execute(config: TConfig, params: Record<string, unknown>): Promise<unknown>;

  /**
   * 测试执行（不缓存，返回原始 + 解析后结果 + 耗时等元信息）
   *
   * @param config 数据集配置
   * @param params 参数绑定值
   */
  test(config: TConfig, params: Record<string, unknown>): Promise<TestResult>;
}
