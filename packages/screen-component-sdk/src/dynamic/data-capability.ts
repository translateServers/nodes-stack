/**
 * 动态组件数据能力契约（screen-dynamic-sdk 切片）。
 *
 * 组件 API v2（`nebula.screen-component/v2`）在 v1 基础上新增：
 * - `dataCapability`：组件允许的数据能力声明
 * - model v2 携带 `dataState`（运行时数据状态，由宿主数据执行层回写）
 *
 * 组件作者声明 dataCapability 后，编辑器/查看器据此决定：
 * - `none`：组件不消费数据，文档禁止附加 dataSource
 * - `static`：组件只消费静态数据（沿用 v1 语义）
 * - `host-metric`：组件声明"指标数据需求"，数据由宿主 adapter 委托后端执行，
 *   SDK/组件自身不接触 Token、URL 或 SQL
 */

export const SCREEN_COMPONENT_API_VERSION_V2 = 'nebula.screen-component/v2' as const;

export type ScreenComponentApiVersionV2 = typeof SCREEN_COMPONENT_API_VERSION_V2;

export const SCREEN_COMPONENT_DATA_CAPABILITIES = ['none', 'static', 'host-metric'] as const;

export type ScreenComponentDataCapability = (typeof SCREEN_COMPONENT_DATA_CAPABILITIES)[number];

/** 组件数据能力是否允许附加数据源（决定文档校验规则） */
export function supportsScreenComponentDataSource(
  capability: ScreenComponentDataCapability,
): boolean {
  return capability === 'static' || capability === 'host-metric';
}

/**
 * 组件运行数据状态（model v2 附加字段）。
 *
 * 由宿主数据执行层（data coordinator）回写；组件只读展示。
 * - idle：无数据请求
 * - loading：请求中（组件可显示骨架/占位）
 * - success：携带结果数据
 * - error：携带错误信息，reason 供组件选择错误呈现
 */
export type ScreenComponentDataState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: unknown }
  | {
      readonly status: 'error';
      readonly error: {
        readonly message: string;
        readonly reason: 'http' | 'network' | 'parse' | 'timeout' | 'aborted';
      };
    };

/** 组件数据源声明（v2 manifest 专用，仅描述意图，不含请求细节） */
export interface ScreenComponentHostMetricIntent {
  /** 数据源类型标识，由宿主契约定义（如 `host/xj-metric`） */
  readonly type: string;
  /** 意图参数（如指标 ID、绑定字段），语义由宿主定义 */
  readonly params?: Readonly<Record<string, unknown>>;
}
