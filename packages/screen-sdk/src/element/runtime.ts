import type { ScreenHostAdapter } from '../contracts/adapter.js';
import type {
  ScreenDocumentV1,
  ScreenProjectDraft,
  ScreenProjectEnvelope,
} from '../contracts/document.js';
import type { ScreenSdkDiagnostic } from '../contracts/diagnostics.js';

export type ScreenEditorTheme = 'light' | 'dark';

export interface ScreenEditorOptions {
  debug?: boolean;
  persistPreferences?: boolean;
  preferenceNamespace?: string;
}

export interface ScreenEditorRuntimeConfiguration {
  adapter?: ScreenHostAdapter;
  options: Readonly<ScreenEditorOptions>;
  projectId: string;
  readonly: boolean;
  theme: ScreenEditorTheme;
}

export interface MountScreenEditorRuntimeOptions extends ScreenEditorRuntimeConfiguration {
  eventTarget: HTMLElement;
  identifierPrefix: string;
  isActive: () => boolean;
  mountRoot: HTMLElement;
  onThemeChange: (theme: ScreenEditorTheme) => void;
  portalRoot: HTMLElement;
}

export interface ScreenEditorRuntime {
  dispose(): void;
  fitToScreen(): void;
  focusComponent(componentId: string): boolean;
  getDocument(): ScreenDocumentV1 | null;
  getDraft(): ScreenProjectDraft | null;
  publish(): Promise<ScreenProjectEnvelope>;
  redo(): void;
  reload(options?: { discardChanges?: boolean }): Promise<void>;
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
