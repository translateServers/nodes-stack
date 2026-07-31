import { createContext, useContext, type ReactNode } from 'react';

export type ScreenEditorTheme = 'light' | 'dark';
export type ScreenEditorCapabilityProfile = 'dynamic' | 'static';

interface ScreenEditorEnvironmentValue {
  capabilityProfile: ScreenEditorCapabilityProfile;
  portalRoot: HTMLElement | null;
  requestNavigate: (url: string, target: '_blank' | '_self') => void;
  setTheme: (theme: ScreenEditorTheme) => void;
  theme: ScreenEditorTheme;
}

const ScreenEditorEnvironmentContext = createContext<ScreenEditorEnvironmentValue | null>(null);

interface ScreenEditorEnvironmentProviderProps extends ScreenEditorEnvironmentValue {
  children: ReactNode;
}

export function ScreenEditorEnvironmentProvider({
  children,
  capabilityProfile,
  portalRoot,
  requestNavigate,
  setTheme,
  theme,
}: ScreenEditorEnvironmentProviderProps) {
  return (
    <ScreenEditorEnvironmentContext.Provider
      value={{ capabilityProfile, portalRoot, requestNavigate, setTheme, theme }}
    >
      {children}
    </ScreenEditorEnvironmentContext.Provider>
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
