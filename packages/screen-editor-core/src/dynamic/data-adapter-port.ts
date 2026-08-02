/**
 * 宿主数据适配端口（screen-dynamic-sdk 数据执行契约）。
 *
 * 数据执行全部由宿主 adapter 完成：
 * - SDK/组件不经手 Token、URL 或 SQL
 * - 后端从已验证的 runtime context 解析文档，不信任客户端 mode/metricId
 * - 认证与对象权限校验在宿主（后端）完成
 *
 * 上下文生命周期：
 * - `openContext`：进入 design/preview/published/release-audit 上下文
 * - `syncContext`：设计态保存/发布后同步上下文（服务端可重建会话）
 * - `closeContext`：退出上下文，释放服务端会话
 */

import type { ScreenComponentHostMetricIntent } from '@nebula/screen-component-sdk/dynamic';

/** 运行时上下文来源 */
export type ScreenDataContextSource = 'design' | 'preview' | 'published' | 'release-audit';

/** 数据执行上下文（由宿主创建并验证） */
export interface ScreenDataExecutionContext {
  readonly contextId: string;
  readonly projectId: string;
  readonly source: ScreenDataContextSource;
  /** published 上下文绑定 viewer envelope releaseId；撤回立即阻断 */
  readonly envelopeReleaseId?: string;
}

/** 组件数据执行请求 */
export interface ScreenDataExecuteRequest {
  readonly componentId: string;
  /** 数据源意图（如 host/xj-metric + metricId/binding），由文档解析而来 */
  readonly intent: ScreenComponentHostMetricIntent;
}

/** 数据执行结果 */
export interface ScreenDataExecuteResult {
  readonly data: unknown;
}

/** 数据资源目录项（指标列表，供属性面板选择） */
export interface ScreenDataMetricResource {
  readonly metricId: number;
  readonly name: string;
  readonly code: string;
  readonly status: number;
}

/** 宿主数据适配端口（命令式，无框架依赖） */
export interface ScreenDataAdapterPort {
  /** 列出可用指标资源（按当前用户权限过滤） */
  resourceList(signal?: AbortSignal): Promise<readonly ScreenDataMetricResource[]>;
  /** 打开数据执行上下文 */
  openContext(context: ScreenDataExecutionContext): Promise<void>;
  /** 同步数据执行上下文（设计态保存/发布后调用） */
  syncContext(context: ScreenDataExecutionContext): Promise<void>;
  /** 关闭数据执行上下文 */
  closeContext(contextId: string): Promise<void>;
  /** 执行组件数据请求 */
  execute(request: ScreenDataExecuteRequest, signal: AbortSignal): Promise<ScreenDataExecuteResult>;
}
