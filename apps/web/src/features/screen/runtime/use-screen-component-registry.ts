/**
 * React hook：解析共享组件注册表（Task 6.4）
 *
 * 封装 `getNebulaScreenComponentRegistry()` 的 async 解析与错误处理，
 * 供编辑路由、编辑器内预览和公开预览复用。
 *
 * 行为：
 * - 首次渲染返回 `{ registry: null, error: null, isLoading: true }`
 * - registry 解析成功后触发重渲染，返回 `{ registry, error: null, isLoading: false }`
 * - 失败时返回 `{ registry: null, error, isLoading: false }`
 *
 * 调用方负责在 `isLoading` 或 `error` 状态下展示加载/错误态，
 * 不要在 registry 未就绪时挂载 `ScreenEditorWorkbench` 或 `PreviewCanvas`。
 */

import { useEffect, useState } from 'react';
import {
  getNebulaScreenComponentRegistry,
  isScreenComponentRegistryError,
  type ScreenComponentRegistry,
  type ScreenComponentRegistryError,
} from './component-registry';

export interface UseScreenComponentRegistryResult {
  registry: ScreenComponentRegistry | null;
  error: ScreenComponentRegistryError | null;
  isLoading: boolean;
}

export function useScreenComponentRegistry(): UseScreenComponentRegistryResult {
  const [registry, setRegistry] = useState<ScreenComponentRegistry | null>(null);
  const [error, setError] = useState<ScreenComponentRegistryError | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNebulaScreenComponentRegistry()
      .then((resolved) => {
        if (!cancelled) setRegistry(resolved);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isScreenComponentRegistryError(err)) {
          setError(err);
        } else {
          // 非 registry error（理论上不应到达），包装为通用错误
          setError({
            name: 'RegistryLoadError',
            message: err instanceof Error ? err.message : String(err),
            code: 'COMPONENT_DEFINE_FAILED',
            diagnostics: [],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    registry,
    error,
    isLoading: registry === null && error === null,
  };
}
