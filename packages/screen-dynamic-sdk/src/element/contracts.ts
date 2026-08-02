/**
 * screen-dynamic-sdk 元素契约。
 */

import type {
  DynamicScreenDocumentV3,
  ScreenDataAdapterPort,
  ScreenSdkDiagnostic,
} from '@nebula/screen-editor-core/dynamic';
import type { ScreenComponentInstanceRegistry } from '@nebula/screen-editor-core/experimental';

export interface ScreenDynamicSdkOptions {
  /** viewer 定时刷新间隔（秒）；0 或缺省表示不刷新 */
  readonly refreshIntervalSeconds?: number;
  /** 项目 ID（数据执行上下文使用；缺省使用实例前缀） */
  readonly projectId?: string;
  /** 调试日志 */
  readonly debug?: boolean;
  /** 是否持久化实例偏好 */
  readonly persistPreferences?: boolean;
  /** 实例偏好命名空间 */
  readonly preferenceNamespace?: string;
}

export interface ScreenDynamicDesignerConfiguration {
  readonly document: DynamicScreenDocumentV3;
  readonly dataAdapter?: ScreenDataAdapterPort;
  readonly componentRegistry?: ScreenComponentInstanceRegistry;
  readonly options: Readonly<ScreenDynamicSdkOptions>;
  readonly readonly: boolean;
  readonly theme: 'light' | 'dark';
}

export interface ScreenDynamicViewerConfiguration {
  readonly document: DynamicScreenDocumentV3;
  readonly dataAdapter?: ScreenDataAdapterPort;
  readonly componentRegistry?: ScreenComponentInstanceRegistry;
  readonly options: Readonly<ScreenDynamicSdkOptions>;
  readonly theme: 'light' | 'dark';
}

export interface ScreenDynamicMountOptions extends ScreenDynamicDesignerConfiguration {
  readonly eventTarget: HTMLElement;
  readonly identifierPrefix: string;
  readonly mountRoot: HTMLElement;
}

export interface ScreenDynamicRuntime {
  dispose(): void;
  getDocument(): DynamicScreenDocumentV3 | null;
  reload(): void;
  resize(width: number, height: number): void;
  save(): DynamicScreenDocumentV3;
  publish(): DynamicScreenDocumentV3;
  undo(): void;
  redo(): void;
  update(configuration: ScreenDynamicDesignerConfiguration): void;
  validate(): ScreenSdkDiagnostic[];
  whenReady(): Promise<void>;
}

export type MountScreenDynamicRuntime = (
  options: ScreenDynamicMountOptions,
) => ScreenDynamicRuntime;

export interface ScreenDynamicElementConfig {
  readonly document: DynamicScreenDocumentV3;
  readonly dataAdapter?: ScreenDataAdapterPort;
  readonly componentRegistry?: ScreenComponentInstanceRegistry;
  readonly options: Readonly<ScreenDynamicSdkOptions>;
  readonly readonly: boolean;
  readonly theme: 'light' | 'dark';
}

export type ScreenDynamicElement = ScreenDynamicElementConfig;

export interface ScreenDynamicEventMap {
  'nebula-ready': CustomEvent<{ projectId?: string }>;
  'nebula-error': CustomEvent<{
    operation: string;
    error: { code: string; message: string };
  }>;
  'nebula-dirty-change': CustomEvent<{ dirty: boolean }>;
  'nebula-save-success': CustomEvent<{ revision: string }>;
  'nebula-publish-success': CustomEvent<{ revision: string }>;
  'nebula-data-error': CustomEvent<{ componentId: string; message: string }>;
}
