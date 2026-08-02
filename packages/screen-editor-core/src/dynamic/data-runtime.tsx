/**
 * 动态数据运行时 React 桥（ScreenDynamicDataProvider）。
 *
 * 将命令式 ScreenDataAdapterPort 桥接到组件渲染树：
 * - 维护实例级 ScreenDataCoordinator（去重/取消/超时/迟到防护）
 * - `useScreenDynamicData()`：获取执行与上下文控制接口
 * - `useComponentDataState(componentId)`：订阅组件数据状态（viewer 渲染用）
 *
 * 本模块只声明数据意图并转发到 adapter，不经手 Token/URL/SQL。
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ScreenComponentDataState } from '@nebula/screen-component-sdk/dynamic';
import type { ScreenDataAdapterPort, ScreenDataExecutionContext } from './data-adapter-port.js';
import { ScreenDataCoordinator, type ScreenDataExecutionOptions } from './data-coordinator.js';

const IDLE_DATA_STATE: ScreenComponentDataState = { status: 'idle' };

export interface ScreenDynamicDataRuntime {
  readonly coordinator: ScreenDataCoordinator;
  execute(
    componentId: string,
    intent: Parameters<ScreenDataCoordinator['execute']>[1],
    options?: ScreenDataExecutionOptions,
  ): Promise<ScreenComponentDataState>;
  openContext(context: ScreenDataExecutionContext): Promise<void>;
  syncContext(context: ScreenDataExecutionContext): Promise<void>;
  closeContext(): Promise<void>;
}

const ScreenDynamicDataContext = createContext<ScreenDynamicDataRuntime | null>(null);

export interface ScreenDynamicDataProviderProps {
  readonly adapter?: ScreenDataAdapterPort;
  readonly children: ReactNode;
}

export function ScreenDynamicDataProvider({ adapter, children }: ScreenDynamicDataProviderProps) {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const coordinator = useMemo(() => {
    if (adapter === undefined) return null;
    return new ScreenDataCoordinator({ adapter });
  }, [adapter]);

  useEffect(() => {
    return () => {
      coordinator?.dispose();
    };
  }, [coordinator]);

  const runtime = useMemo<ScreenDynamicDataRuntime | null>(() => {
    if (coordinator === null) return null;
    return {
      coordinator,
      execute: (componentId, intent, options) => coordinator.execute(componentId, intent, options),
      openContext: (context) => coordinator.openContext(context),
      syncContext: (context) => coordinator.syncContext(context),
      closeContext: () => coordinator.closeContext(),
    };
  }, [coordinator]);

  if (runtime === null) return children;
  return (
    <ScreenDynamicDataContext.Provider value={runtime}>
      {children}
    </ScreenDynamicDataContext.Provider>
  );
}

export function useOptionalScreenDynamicData(): ScreenDynamicDataRuntime | null {
  return useContext(ScreenDynamicDataContext);
}

export function useScreenDynamicData(): ScreenDynamicDataRuntime {
  const runtime = useContext(ScreenDynamicDataContext);
  if (runtime === null) {
    throw new Error(
      'useScreenDynamicData must be used within ScreenDynamicDataProvider with an adapter',
    );
  }
  return runtime;
}

/**
 * 订阅组件数据状态（viewer 渲染）。
 *
 * 未在 Provider 内（或组件未执行）时返回 idle。
 */
export function useComponentDataState(componentId: string): ScreenComponentDataState {
  const runtime = useContext(ScreenDynamicDataContext);
  const [state, setState] = useState<ScreenComponentDataState>(IDLE_DATA_STATE);

  useEffect(() => {
    if (runtime === null) {
      setState(IDLE_DATA_STATE);
      return;
    }
    const unsubscribe = runtime.coordinator.subscribe({
      onStateChange: (changedComponentId, nextState) => {
        if (changedComponentId === componentId) {
          setState(nextState);
        }
      },
    });
    return unsubscribe;
  }, [componentId, runtime]);

  return state;
}
