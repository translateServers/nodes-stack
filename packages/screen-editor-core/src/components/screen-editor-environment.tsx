import { createContext, useContext, type ReactNode } from 'react';
import {
  DYNAMIC_SCREEN_EDITOR_RUNTIME_FALLBACK,
  ScreenEditorRuntimeProfileProvider,
  STATIC_SCREEN_EDITOR_RUNTIME_PROFILE,
  type ScreenEditorCapabilityProfile,
  type ScreenEditorRuntimeProfile,
} from '../runtime-profile.js';

export type ScreenEditorTheme = 'light' | 'dark';
export type { ScreenEditorCapabilityProfile } from '../runtime-profile.js';

interface ScreenEditorEnvironmentValue {
  capabilityProfile: ScreenEditorCapabilityProfile;
  isActive: () => boolean;
  portalRoot: HTMLElement | null;
  readonly: boolean;
  requestNavigate: (url: string, target: '_blank' | '_self') => void;
  setTheme: (theme: ScreenEditorTheme) => void;
  theme: ScreenEditorTheme;
}

const ScreenEditorEnvironmentContext = createContext<ScreenEditorEnvironmentValue | null>(null);

interface ScreenEditorEnvironmentProviderProps
  extends Omit<ScreenEditorEnvironmentValue, 'isActive' | 'readonly'>,
    Partial<Pick<ScreenEditorEnvironmentValue, 'isActive' | 'readonly'>> {
  children: ReactNode;
  runtimeProfile?: ScreenEditorRuntimeProfile;
}

export function ScreenEditorEnvironmentProvider({
  children,
  capabilityProfile,
  isActive = () => true,
  portalRoot,
  readonly = false,
  requestNavigate,
  runtimeProfile,
  setTheme,
  theme,
}: ScreenEditorEnvironmentProviderProps) {
  const resolvedRuntimeProfile =
    runtimeProfile ??
    (capabilityProfile === 'static'
      ? STATIC_SCREEN_EDITOR_RUNTIME_PROFILE
      : DYNAMIC_SCREEN_EDITOR_RUNTIME_FALLBACK);
  return (
    <ScreenEditorRuntimeProfileProvider profile={resolvedRuntimeProfile}>
      <ScreenEditorEnvironmentContext.Provider
        value={{
          capabilityProfile: resolvedRuntimeProfile.capabilityProfile,
          isActive,
          portalRoot,
          readonly,
          requestNavigate,
          setTheme,
          theme,
        }}
      >
        {children}
      </ScreenEditorEnvironmentContext.Provider>
    </ScreenEditorRuntimeProfileProvider>
  );
}

export function useScreenEditorEnvironment(): ScreenEditorEnvironmentValue {
  const environment = useContext(ScreenEditorEnvironmentContext);
  if (environment === null) {
    throw new Error(
      'useScreenEditorEnvironment must be used within ScreenEditorEnvironmentProvider',
    );
  }
  return environment;
}

export function useOptionalScreenEditorEnvironment(): ScreenEditorEnvironmentValue | null {
  return useContext(ScreenEditorEnvironmentContext);
}
