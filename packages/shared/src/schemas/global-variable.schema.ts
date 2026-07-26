/**
 * 全局变量 Schema（Task 8：Light Chaser 特色 —— 项目级全局变量机制）
 *
 * 设计目标：
 * - 在大屏项目内维护一组命名变量，可在数据源参数与蓝图模板插值中通过 `{{globalVars.xxx}}` 引用
 * - 支持三种类型：static（静态值）/ api（定时拉取）/ computed（表达式，预留）
 * - 与组件实例解耦，跨组件共享，便于一处变更多处生效
 *
 * 与组件数据源（DataSourceConfigSchema）的差异：
 * - 组件数据源是组件私有的数据来源；全局变量是项目级共享的命名变量
 * - 全局变量侧重"配置项复用"（如 API 基址、Token、主题色），不承担组件主数据流
 */

import { z } from 'zod';

/** 全局变量类型枚举 */
export const GlobalVariableTypeSchema = z.enum(['static', 'api', 'computed']);
export type GlobalVariableType = z.infer<typeof GlobalVariableTypeSchema>;

/**
 * api 类型的拉取配置。
 *
 * 注意：与 `ApiDataSourceConfigSchema`（组件数据源）解耦 ——
 * 全局变量侧重命名复用，允许 POST 与毫秒级刷新间隔，校验更宽松（url 仅非空即可，便于插值占位）。
 */
export const GlobalVariableApiConfigSchema = z.object({
  url: z.string().min(1).describe('请求 URL（支持插值占位符）'),
  method: z.enum(['GET', 'POST']).default('GET').describe('请求方法'),
  headers: z.record(z.string(), z.string()).optional().describe('请求头'),
  refreshInterval: z.number().min(0).default(0).describe('刷新间隔（毫秒），0 表示不刷新'),
});
export type GlobalVariableApiConfig = z.infer<typeof GlobalVariableApiConfigSchema>;

/**
 * 项目级全局变量。
 *
 * - `static` 类型：通过 `value` 提供静态值
 * - `api` 类型：通过 `apiConfig` 提供拉取配置，运行时按 `refreshInterval` 定时刷新
 * - `computed` 类型：通过 `expression` 提供表达式（当前预留，运行时不求值）
 */
export const GlobalVariableSchema = z.object({
  id: z.string().min(1).describe('变量唯一标识'),
  name: z.string().min(1).describe('变量名（在 {{globalVars.xxx}} 中使用的 xxx）'),
  type: GlobalVariableTypeSchema.describe('变量类型'),
  value: z.unknown().optional().describe('static 类型的静态值'),
  apiConfig: GlobalVariableApiConfigSchema.optional().describe('api 类型的拉取配置'),
  expression: z.string().optional().describe('computed 类型的表达式（预留）'),
  description: z.string().optional().describe('变量描述'),
});
export type GlobalVariable = z.infer<typeof GlobalVariableSchema>;
