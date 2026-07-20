/**
 * 布局配置 Hook：从当前匹配路由链读取最近的 PageLayoutConfig。
 *
 * 查找规则：自下而上遍历 useMatches 返回的路由匹配数组，
 * 第一个声明了 staticData.layout 的路由的配置生效。
 * 这样既允许在叶子路由声明（如大屏编辑器页面），
 * 也允许在父路由声明（未来可用 _app 设默认布局）。
 */
import { useMatches } from '@tanstack/react-router';
import type { PageLayoutConfig } from '@/router/route-types';

export interface ResolvedLayoutConfig {
  /** 是否显示左侧侧边栏 */
  sidebar: boolean;
  /** 是否显示顶部 Header */
  header: boolean;
  /** 是否显示底部 Footer */
  footer: boolean;
  /** 是否启用主内容区的默认内边距 */
  mainPadding: boolean;
  /** 原始配置，未声明时为 null */
  raw: PageLayoutConfig | null;
}

const DEFAULT_CONFIG: ResolvedLayoutConfig = {
  sidebar: true,
  header: true,
  footer: true,
  mainPadding: true,
  raw: null,
};

/**
 * 读取当前路由链上最近的 layout 配置，未声明则返回默认值。
 *
 * 配置项缺省时回退到默认值（true），保证向后兼容。
 */
export function useLayoutConfig(): ResolvedLayoutConfig {
  const matches = useMatches();

  // 自下而上查找最近的 layout 配置
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    if (!match) continue;
    const layout = match.staticData.layout;
    if (layout) {
      return {
        sidebar: layout.sidebar ?? true,
        header: layout.header ?? true,
        footer: layout.footer ?? true,
        mainPadding: layout.mainPadding ?? true,
        raw: layout,
      };
    }
  }

  return DEFAULT_CONFIG;
}
