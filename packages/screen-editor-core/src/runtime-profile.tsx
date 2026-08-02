import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import type { ApiDataSourceConfig, ParamBinding, ScreenComponent } from '@nebula/shared';
import { SCREEN_SDK_COMPONENT_TYPES } from './core/static-capability-profile.js';

export type ScreenEditorCapabilityProfile = 'dynamic' | 'static';

export type ScreenEditorDataRequestState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: unknown }
  | {
      readonly status: 'error';
      readonly error: {
        readonly message: string;
        readonly reason: 'http' | 'network' | 'parse' | 'timeout';
        readonly httpStatus?: number;
      };
    };

export interface ScreenEditorDatasetSourceOptions {
  bindingContext?: { componentProps?: Record<string, unknown> };
  datasetId: string | undefined;
  paramBindings?: Record<string, ParamBinding>;
  refreshIntervalSeconds?: number;
  useMock?: boolean;
}

export interface ScreenEditorDatasetFormProps {
  component: ScreenComponent;
  onSettled: () => void;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}

export interface ScreenEditorApiPreviewResult {
  data: unknown;
  status: number;
}

export interface ScreenEditorRequestApiInput {
  body?: string;
  headers?: Record<string, string>;
  method: string;
  signal: AbortSignal;
  url: string;
}

export interface ScreenEditorRequestApiResult {
  bodyPreview: string;
  ok: boolean;
  status: number;
}

export interface ScreenEditorDataRuntime {
  DatasetConfigForm?: ComponentType<ScreenEditorDatasetFormProps>;
  previewApi(
    config: ApiDataSourceConfig,
    signal: AbortSignal,
  ): Promise<ScreenEditorApiPreviewResult>;
  refreshComponentData(component: ScreenComponent, signal: AbortSignal): Promise<unknown>;
  requestApi(input: ScreenEditorRequestApiInput): Promise<ScreenEditorRequestApiResult>;
  useApiDataSource(config: ApiDataSourceConfig | undefined): ScreenEditorDataRequestState;
  useDatasetSource(options: ScreenEditorDatasetSourceOptions): ScreenEditorDataRequestState;
}

export interface ScreenEditorRuntimeProfile {
  blueprintCapabilities: {
    readonly requestApi: boolean;
    readonly refreshDataSource: boolean;
  };
  capabilityProfile: ScreenEditorCapabilityProfile;
  componentRegistry: {
    readonly componentTypes: readonly string[];
  };
  dataRuntime: ScreenEditorDataRuntime;
  notifications: {
    readonly instanceScoped: true;
  };
  propertySchemas: {
    readonly supportsDynamicDataSources: boolean;
  };
}

const ScreenEditorRuntimeProfileContext = createContext<ScreenEditorRuntimeProfile | null>(null);

const IDLE_DATA_REQUEST_STATE: ScreenEditorDataRequestState = { status: 'idle' };

function unavailableDataRuntime(
  capabilityProfile: ScreenEditorCapabilityProfile,
): ScreenEditorDataRuntime {
  const unavailable = (): never => {
    throw new Error(`${capabilityProfile} runtime data capability is unavailable`);
  };
  return {
    previewApi: unavailable,
    refreshComponentData: () => Promise.resolve(undefined),
    requestApi: unavailable,
    useApiDataSource: () => IDLE_DATA_REQUEST_STATE,
    useDatasetSource: () => IDLE_DATA_REQUEST_STATE,
  };
}

function createFallbackRuntimeProfile(
  capabilityProfile: ScreenEditorCapabilityProfile,
): ScreenEditorRuntimeProfile {
  const dynamic = capabilityProfile === 'dynamic';
  return {
    blueprintCapabilities: {
      requestApi: dynamic,
      refreshDataSource: dynamic,
    },
    capabilityProfile,
    componentRegistry: {
      componentTypes: SCREEN_SDK_COMPONENT_TYPES,
    },
    dataRuntime: unavailableDataRuntime(capabilityProfile),
    notifications: {
      instanceScoped: true,
    },
    propertySchemas: {
      supportsDynamicDataSources: dynamic,
    },
  };
}

export const STATIC_SCREEN_EDITOR_RUNTIME_PROFILE = createFallbackRuntimeProfile('static');
export const DYNAMIC_SCREEN_EDITOR_RUNTIME_FALLBACK = createFallbackRuntimeProfile('dynamic');

export interface ScreenEditorRuntimeProfileProviderProps {
  children: ReactNode;
  profile: ScreenEditorRuntimeProfile;
}

export function ScreenEditorRuntimeProfileProvider({
  children,
  profile,
}: ScreenEditorRuntimeProfileProviderProps) {
  return (
    <ScreenEditorRuntimeProfileContext.Provider value={profile}>
      {children}
    </ScreenEditorRuntimeProfileContext.Provider>
  );
}

export function useScreenEditorRuntimeProfile(): ScreenEditorRuntimeProfile {
  const profile = useContext(ScreenEditorRuntimeProfileContext);
  if (profile === null) {
    throw new Error(
      'useScreenEditorRuntimeProfile must be used within ScreenEditorRuntimeProfileProvider',
    );
  }
  return profile;
}

export function useOptionalScreenEditorRuntimeProfile(): ScreenEditorRuntimeProfile | null {
  return useContext(ScreenEditorRuntimeProfileContext);
}
