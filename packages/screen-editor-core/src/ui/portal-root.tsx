import { createContext, useContext, type ReactNode } from 'react';

const ScreenSdkPortalRootContext = createContext<HTMLElement | null>(null);

export interface ScreenSdkPortalRootProviderProps {
  children: ReactNode;
  portalRoot: HTMLElement | null;
}

export function ScreenSdkPortalRootProvider({
  children,
  portalRoot,
}: ScreenSdkPortalRootProviderProps) {
  return (
    <ScreenSdkPortalRootContext.Provider value={portalRoot}>
      {children}
    </ScreenSdkPortalRootContext.Provider>
  );
}

export function useScreenSdkPortalRoot(): HTMLElement | null {
  return useContext(ScreenSdkPortalRootContext);
}
