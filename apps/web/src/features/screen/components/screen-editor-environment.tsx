import { createContext, useContext, type ReactNode } from 'react';

export type ScreenEditorTheme = 'light' | 'dark';
export type ScreenEditorCapabilityProfile = 'dynamic' | 'static';

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
}

export function ScreenEditorEnvironmentProvider({
  children,
  capabilityProfile,
  isActive = () => true,
  portalRoot,
  readonly = false,
  requestNavigate,
  setTheme,
  theme,
}: ScreenEditorEnvironmentProviderProps) {
  return (
    <ScreenEditorEnvironmentContext.Provider
      value={{
        capabilityProfile,
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
