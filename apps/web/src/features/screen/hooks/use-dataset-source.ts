/**
 * 数据集数据源 Hook（编辑器内集成）
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §5.1
 *
 * 能力：
 * - 解析 paramBindings：从组件 props / URL query / 静态值取参数
 * - 调用 POST /api/dataset/:id/execute { params, useMock }
 * - 竞态防护：新请求触发时旧请求结果被丢弃（requestId 比对）
 * - 定时刷新：refreshIntervalSeconds > 0 时按间隔重新请求
 * - 编辑态默认 useMock=true（不依赖真实数据源即可调试）
 *
 * 与 useApiDataSource 的差异：
 * - 走后端代理（executeDataset API），不直接 fetch 外部 URL
 * - 后端返回 { status, raw, parsed, meta }，本 hook 取 parsed 作为 success.data
 * - 不需要 AbortController（API 客户端未暴露 signal），改用 requestId 防护
 *
 * 边界：
 * - datasetId 为空时返回 idle，不发起请求
 * - 后端返回 status='fail' 视为错误
 * - paramBindings 中 source 为 'component-data' / 'trigger' 当前阶段不解析（返回 undefined）
 */

import { useEffect, useRef, useState } from 'react';
import type { ParamBinding } from '@nebula/shared';
import { executeDataset } from '@/features/dataset/api';
import type { ApiRequestState } from './use-api-data-source';

/** 解析 paramBindings 的上下文 */
export interface ParamBindingContext {
  /** 当前组件的 props（用于 component-prop 来源） */
  componentProps?: Record<string, unknown>;
}

/**
 * 解析单个 ParamBinding 到实际值
 *
 * 路径约定（见 data-model.md §3.2）：
 * - component-prop: path 如 "props.date"，取 component.props.date
 * - component-data: 暂未实现（返回 undefined）
 * - url-param: path 如 "url.region"，取 URL query 参数 region
 * - static: 直接取 defaultValue
 * - trigger: 暂未实现（返回 undefined）
 */
export function resolveParamBinding(binding: ParamBinding, context: ParamBindingContext): unknown {
  switch (binding.source) {
    case 'component-prop': {
      if (context.componentProps === undefined) return undefined;
      // path 形如 "props.date"，去掉 "props." 前缀取实际字段路径
      const fieldPath = binding.path.replace(/^props\./, '');
      return getFieldByPath(context.componentProps, fieldPath);
    }
    case 'component-data': {
      // 当前阶段不解析（需要组件已解析数据，编辑态无此上下文）
      return undefined;
    }
    case 'url-param': {
      // path 形如 "url.region"，去掉 "url." 前缀
      const paramName = binding.path.replace(/^url\./, '');
      if (typeof window === 'undefined') return undefined;
      const params = new URLSearchParams(window.location.search);
      return params.get(paramName) ?? binding.defaultValue;
    }
    case 'static': {
      return binding.defaultValue;
    }
    case 'trigger': {
      // 蓝图触发器上下文，由运行时注入；编辑态无触发器，返回 undefined
      return undefined;
    }
    default: {
      return undefined;
    }
  }
}

/** 按点分隔路径从对象中取值（仅支持对象属性，不支持数组索引） */
function getFieldByPath(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (obj === undefined) return undefined;
  const segments = path.split('.').filter((s) => s !== '');
  let current: unknown = obj;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * 解析全部 paramBindings 到 params 对象
 *
 * - 跳过值为 undefined 的绑定（不写入 params）
 * - 无绑定时返回空对象
 */
export function resolveParamBindings(
  bindings: Record<string, ParamBinding> | undefined,
  context: ParamBindingContext,
): Record<string, unknown> {
  if (bindings === undefined) return {};
  const params: Record<string, unknown> = {};
  for (const [key, binding] of Object.entries(bindings)) {
    const value = resolveParamBinding(binding, context);
    if (value !== undefined) {
      params[key] = value;
    }
  }
  return params;
}

export interface UseDatasetSourceOptions {
  /** 数据集 ID，为空时 hook 返回 idle */
  datasetId: string | undefined;
  /** 参数绑定（组件 dataSource.paramBindings） */
  paramBindings?: Record<string, ParamBinding>;
  /** 解析 paramBindings 所需的上下文（组件实例） */
  bindingContext?: ParamBindingContext;
  /** 是否使用 Mock 数据，编辑态默认 true */
  useMock?: boolean;
  /** 刷新间隔（秒），0 或 undefined 表示不轮询 */
  refreshIntervalSeconds?: number;
}

/**
 * 数据集数据源 Hook
 *
 * 返回 ApiRequestState（与 useApiDataSource 同构）：
 * - idle: 未配置 datasetId
 * - loading: 请求进行中
 * - success: 请求成功，data 为后端返回的 parsed（已应用 dataPath + fieldMapping + filter）
 * - error: 请求失败或后端返回 status='fail'
 */
export function useDatasetSource(options: UseDatasetSourceOptions): ApiRequestState {
  const {
    datasetId,
    paramBindings,
    bindingContext,
    useMock = true,
    refreshIntervalSeconds,
  } = options;
  const [state, setState] = useState<ApiRequestState>({ status: 'idle' });
  const requestIdRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (datasetId === undefined || datasetId === '') {
      setState({ status: 'idle' });
      return;
    }

    let disposed = false;
    const currentRequestId = ++requestIdRef.current;

    const executeRequest = async (): Promise<void> => {
      const params = resolveParamBindings(paramBindings, bindingContext ?? {});
      setState({ status: 'loading' });

      try {
        const result = await executeDataset(datasetId, { params, useMock });
        // 竞态防护：丢弃过期请求的结果
        if (disposed || currentRequestId !== requestIdRef.current) return;

        if (result.status === 'fail') {
          setState({
            status: 'error',
            error: {
              reason: 'http',
              message: '数据集执行失败',
            },
          });
          return;
        }

        setState({ status: 'success', data: result.parsed });
      } catch (err) {
        if (disposed || currentRequestId !== requestIdRef.current) return;
        const message = err instanceof Error ? err.message : '数据集请求失败';
        setState({
          status: 'error',
          error: {
            reason: 'network',
            message,
          },
        });
      }
    };

    void executeRequest();

    // 定时刷新
    if (refreshIntervalSeconds !== undefined && refreshIntervalSeconds > 0) {
      intervalRef.current = setInterval(() => {
        void executeRequest();
      }, refreshIntervalSeconds * 1000);
    }

    return () => {
      disposed = true;
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [datasetId, paramBindings, bindingContext, useMock, refreshIntervalSeconds]);

  return state;
}
