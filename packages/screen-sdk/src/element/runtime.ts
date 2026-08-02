import type {
  ScreenDocument,
  ScreenEditorTheme,
  ScreenHostAdapter,
  ScreenProjectDraft,
  ScreenProjectEnvelope,
  ScreenSdkDiagnostic,
} from '@nebula/screen-editor-core';
import type { ScreenComponentInstanceRegistry } from '@nebula/screen-editor-core/experimental';

export interface ScreenEditorOptions {
  debug?: boolean;
  persistPreferences?: boolean;
  preferenceNamespace?: string;
}

export interface ScreenEditorRuntimeConfiguration {
  readonly adapter?: ScreenHostAdapter;
  readonly componentRegistry?: ScreenComponentInstanceRegistry;
  readonly options: Readonly<ScreenEditorOptions>;
  readonly projectId: string;
  readonly readonly: boolean;
  readonly theme: ScreenEditorTheme;
}

export interface MountScreenEditorRuntimeOptions extends ScreenEditorRuntimeConfiguration {
  readonly eventTarget: HTMLElement;
  readonly identifierPrefix: string;
  readonly isActive: () => boolean;
  readonly mountRoot: HTMLElement;
  readonly onThemeChange: (theme: ScreenEditorTheme) => void;
  readonly portalRoot: HTMLElement;
}

export interface ScreenEditorRuntime {
  dispose(): void;
  fitToScreen(): void;
  focusComponent(componentId: string): boolean;
  getDocument(): ScreenDocument | null;
  getDraft(): ScreenProjectDraft | null;
  publish(): Promise<ScreenProjectEnvelope>;
  redo(): void;
  reload(options?: { readonly discardChanges?: boolean }): Promise<void>;
  resize(width: number, height: number): void;
  save(): Promise<ScreenProjectEnvelope>;
  undo(): void;
  update(configuration: ScreenEditorRuntimeConfiguration): void;
  validate(): ScreenSdkDiagnostic[];
  whenReady(): Promise<void>;
}

export type MountScreenEditorRuntime = (
  options: MountScreenEditorRuntimeOptions,
) => ScreenEditorRuntime;
