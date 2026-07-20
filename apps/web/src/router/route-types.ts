/**
 * 路由静态数据类型扩展
 *
 * 通过 TanStack Router 的 declaration merging 机制扩展 StaticDataRouteOption，
 * 让所有路由的 staticData 字段获得类型补全与校验。
 *
 * 用法：
 * ```ts
 * export const Route = createFileRoute('/_app/screen/$id')({
 *   staticData: { layout: { sidebar: false, header: false, footer: false } },
 *   component: ScreenEditor,
 * });
 * ```
 *
 * 读取：通过 `useLayoutConfig` Hook 在 AppLayout 中获取当前匹配路由链上最近的 layout 配置。
 */

/**
 * 单个页面的布局配置。
 * - 缺省（undefined）：使用默认行为（显示对应区域）
 * - 显式 false：隐藏对应区域
 * - 显式 true：保持显示
 */
export interface PageLayoutConfig {
  /** 是否显示左侧侧边栏。默认 true。 */
  sidebar?: boolean;
  /** 是否显示顶部 Header。默认 true。 */
  header?: boolean;
  /** 是否显示底部 Footer。默认 true。 */
  footer?: boolean;
  /** 是否启用主内容区的默认内边距。默认 true。 */
  mainPadding?: boolean;
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** 页面布局配置，控制 AppLayout 中各区域的显隐 */
    layout?: PageLayoutConfig;
  }
}
