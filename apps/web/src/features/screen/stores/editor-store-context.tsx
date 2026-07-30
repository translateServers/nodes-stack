import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { ScreenEditorState, ScreenEditorStore } from './editor-store';
import {
  createAlignmentLinesStore,
  createDimensionStore,
  type AlignmentLinesState,
  type AlignmentLinesStore,
  type DimensionState,
  type DimensionStore,
} from './auxiliary-stores';
import { DEFAULT_SCREEN_EDITOR_PREFERENCE_NAMESPACE } from '../lib/preferences-persist';

const ScreenEditorStoreContext = createContext<ScreenEditorStore | null>(null);
const DimensionStoreContext = createContext<DimensionStore | null>(null);
const AlignmentLinesStoreContext = createContext<AlignmentLinesStore | null>(null);
const PreferenceNamespaceContext = createContext(DEFAULT_SCREEN_EDITOR_PREFERENCE_NAMESPACE);
export interface BlueprintViewportCache {
  current: { x: number; y: number; zoom: number } | null;
}
const BlueprintViewportCacheContext = createContext<BlueprintViewportCache | null>(null);
const ScreenEditorDebugHandleContext = createContext<ScreenEditorDebugHandle | null>(null);

export interface ScreenEditorDebugHandle {
  store: ScreenEditorStore;
  startTextEditing?: (componentId: string) => void;
}

declare global {
  interface Window {
    __nebulaScreenEditors?: Map<string, ScreenEditorDebugHandle>;
  }
}

export interface ScreenEditorStoreProviderProps {
  children: ReactNode;
  store: ScreenEditorStore;
  debug?: boolean;
  instanceId?: string;
  dimensionStore?: DimensionStore;
  alignmentLinesStore?: AlignmentLinesStore;
  preferenceNamespace?: string;
}

export function ScreenEditorStoreProvider({
  children,
  store,
  debug = false,
  instanceId = 'anonymous',
  dimensionStore: providedDimensionStore,
  alignmentLinesStore: providedAlignmentLinesStore,
  preferenceNamespace = DEFAULT_SCREEN_EDITOR_PREFERENCE_NAMESPACE,
}: ScreenEditorStoreProviderProps) {
  const [dimensionStore] = useState(() => providedDimensionStore ?? createDimensionStore());
  const [alignmentLinesStore] = useState(
    () => providedAlignmentLinesStore ?? createAlignmentLinesStore(),
  );
  const [blueprintViewportCache] = useState<BlueprintViewportCache>(() => ({ current: null }));
  const [debugHandle] = useState<ScreenEditorDebugHandle>(() => ({ store }));
  useEffect(() => {
    if (!debug || typeof window === 'undefined') return;
    const registry = window.__nebulaScreenEditors ?? new Map<string, ScreenEditorDebugHandle>();
    window.__nebulaScreenEditors = registry;
    registry.set(instanceId, debugHandle);
    return () => {
      if (registry.get(instanceId) === debugHandle) registry.delete(instanceId);
      if (registry.size === 0) delete window.__nebulaScreenEditors;
    };
  }, [debug, debugHandle, instanceId]);

  return (
    <PreferenceNamespaceContext.Provider value={preferenceNamespace}>
      <ScreenEditorStoreContext.Provider value={store}>
        <DimensionStoreContext.Provider value={dimensionStore}>
          <AlignmentLinesStoreContext.Provider value={alignmentLinesStore}>
            <BlueprintViewportCacheContext.Provider value={blueprintViewportCache}>
              <ScreenEditorDebugHandleContext.Provider value={debugHandle}>
                {children}
              </ScreenEditorDebugHandleContext.Provider>
            </BlueprintViewportCacheContext.Provider>
          </AlignmentLinesStoreContext.Provider>
        </DimensionStoreContext.Provider>
      </ScreenEditorStoreContext.Provider>
    </PreferenceNamespaceContext.Provider>
  );
}

export function useDimensionStoreApi(): DimensionStore {
  const store = useContext(DimensionStoreContext);
  if (store === null)
    throw new Error('useDimensionStore must be used within ScreenEditorStoreProvider');
  return store;
}

export function useDimensionStore<Selected>(
  selector: (state: DimensionState) => Selected,
): Selected {
  return useStore(useDimensionStoreApi(), selector);
}

export function useAlignmentLinesStoreApi(): AlignmentLinesStore {
  const store = useContext(AlignmentLinesStoreContext);
  if (store === null) {
    throw new Error('useAlignmentLinesStore must be used within ScreenEditorStoreProvider');
  }
  return store;
}

export function useAlignmentLinesStore<Selected>(
  selector: (state: AlignmentLinesState) => Selected,
): Selected {
  return useStore(useAlignmentLinesStoreApi(), selector);
}

export function useScreenEditorPreferenceNamespace(): string {
  return useContext(PreferenceNamespaceContext);
}

export function useOptionalBlueprintViewportCache(): BlueprintViewportCache | null {
  return useContext(BlueprintViewportCacheContext);
}

export function useScreenEditorDebugHandle(): ScreenEditorDebugHandle | null {
  return useContext(ScreenEditorDebugHandleContext);
}

export function useScreenEditorStoreApi(): ScreenEditorStore {
  const store = useContext(ScreenEditorStoreContext);
  if (store === null) {
    throw new Error('useScreenEditorStore must be used within ScreenEditorStoreProvider');
  }
  return store;
}

export function useScreenEditorStore<Selected>(
  selector: (state: ScreenEditorState) => Selected,
): Selected {
  return useStore(useScreenEditorStoreApi(), selector);
}
