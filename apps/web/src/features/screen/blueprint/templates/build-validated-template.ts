/**
 * 模板蓝图校验与构建（任务 9.3）
 *
 * 单一入口：构造模板蓝图 + 经共享 Schema 校验。
 *
 * 返回 Result 类型而非抛异常，便于调用方（Sheet）按"校验失败不入栈"语义处理：
 * - success：调用 updateBlueprint(blueprint) → 由 store 推入一条历史
 * - failure：不调用 updateBlueprint → 不入栈
 *
 * 设计理由：将"构造 + 校验"组合为原子操作，避免调用方分别调用 createTemplateBlueprint
 * 与 EventBlueprintSchema.safeParse 后还要处理中间状态。Result 类型让"校验失败不入栈"
 * 在类型层面就清晰可表达。
 */

import { EventBlueprintSchema, type EventBlueprint } from '@nebula/shared';
import { createTemplateBlueprint } from './create-template-blueprint';
import type { BlueprintTemplateId } from './template-definitions';

/** 模板构建成功结果 */
export interface TemplateBuildSuccess {
  readonly success: true;
  readonly blueprint: EventBlueprint;
}

/** 模板构建失败结果 */
export interface TemplateBuildFailure {
  readonly success: false;
  /** 失败原因（人类可读，便于 UI 提示与日志记录） */
  readonly error: string;
}

/** 模板构建结果（判别联合） */
export type TemplateBuildResult = TemplateBuildSuccess | TemplateBuildFailure;

/**
 * 构造模板蓝图并经 Schema 校验。
 *
 * 校验失败的场景（理论不应发生，因模板内容是静态构造的）：
 * - createTemplateBlueprint 抛出未知 templateId 异常（编程错误）
 * - 模板内容违反 Schema（如新增字段时未同步模板）
 *
 * 任何失败都返回 { success: false, error }，不抛出异常。
 *
 * @param templateId  模板标识
 * @returns 成功返回蓝图，失败返回错误信息
 */
export function buildValidatedTemplate(templateId: BlueprintTemplateId): TemplateBuildResult {
  // 1. 构造模板蓝图（可能抛出未知 templateId 异常）
  let blueprint: EventBlueprint;
  try {
    blueprint = createTemplateBlueprint(templateId);
  } catch (e) {
    return {
      success: false,
      error: `构造模板失败：${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 2. Schema 校验（共享契约，与后端持久化一致）
  const result = EventBlueprintSchema.safeParse(blueprint);
  if (!result.success) {
    // 将 ZodError 的 issues 拼接为人类可读字符串
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return {
      success: false,
      error: `模板蓝图校验失败：${issues}`,
    };
  }

  // 3. 校验通过：返回类型收窄后的蓝图（result.data 已是 EventBlueprint）
  return {
    success: true,
    blueprint: result.data,
  };
}
