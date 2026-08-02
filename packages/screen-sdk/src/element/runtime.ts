import type {
  ScreenDocumentV1,
  ScreenDocumentV2,
  ScreenHostAdapter,
  ScreenHostAdapterV2,
  ScreenProjectDraft,
  ScreenProjectDraftV2,
  ScreenProjectEnvelope,
  ScreenProjectEnvelopeV2,
  ScreenSdkDiagnosticV2,
  ScreenEditorTheme,
} from '@nebula/screen-editor-core';
import type { ScreenComponentRegistry } from './v2-contracts.js';

export interface ScreenEditorOptions {
  debug?: boolean;
  persistPreferences?: boolean;
  preferenceNamespace?: string;
}

export interface ScreenEditorRuntimeConfiguration {
  adapter?: ScreenHostAdapter;
  /** V2 adapter is only supplied when the Element enters explicit V2 registry mode. */
  adapterV2?: ScreenHostAdapterV2;
  /**
   * 实例组件注册表（Spec §13.2 Phase 6, Task 6.2）。
   *
   * 在 React runtime mount 前就绪，确保 project parser、Workbench 与 Host Controller
   * 共享同一 snapshot（Requirement 4, 8）。公共 `ScreenComponentRegistry` 结构化兼容
   * `ScreenHostAdapterWorkbench` 期望的内部 `ScreenComponentInstanceRegistry`。
   */
  componentRegistry?: ScreenComponentRegistry;
  /** V1 remains the default; V2 requires both a V2 adapter and a registry facade. */
  documentMode?: 'v1' | 'v2';
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
  getDocument(): ScreenDocumentV1 | ScreenDocumentV2 | null;
  getDraft(): ScreenProjectDraft | ScreenProjectDraftV2 | null;
  publish(): Promise<ScreenProjectEnvelope | ScreenProjectEnvelopeV2>;
  redo(): void;
  reload(options?: { discardChanges?: boolean }): Promise<void>;
  resize(width: number, height: number): void;
  save(): Promise<ScreenProjectEnvelope | ScreenProjectEnvelopeV2>;
  undo(): void;
  update(configuration: ScreenEditorRuntimeConfiguration): void;
  validate(): ScreenSdkDiagnosticV2[];
  whenReady(): Promise<void>;
}

export type MountScreenEditorRuntime = (
  options: MountScreenEditorRuntimeOptions,
) => ScreenEditorRuntime;
