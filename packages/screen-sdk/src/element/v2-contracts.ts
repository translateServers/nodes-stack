/**
 * V2 SDK 公共类型（Spec §14.1 + §8.2）
 *
 * 本文件定义 0.2 SDK Element 使用的 V1/V2 闭合联合类型与 V2 事件 map。
 * 默认 V1 路径返回 V1 分支；显式 V2 模式返回 V2 分支。
 * save/publish 和所有携带 draft/envelope/error 的事件保持同一文档分支，
 * 不混合 V1 draft 与 V2 envelope（Spec §14.1）。
 *
 * `ScreenComponentRegistry` 与 `ScreenComponentRegistration` 对应 spec §8.2 公共接口，
 * 不包含 legacy 兼容字段；内部 `ScreenComponentInstanceRegistry` 是结构化超集，
 * 可直接赋值给此公共类型。Task 6.3 从 `@nebula/screen-sdk/components` 入口导出。
 */

import type {
  NebulaScreenEditorEventMap,
  ScreenChangeReason,
  ScreenDocumentV1,
  ScreenDocumentV2,
  ScreenHostAdapter,
  ScreenHostAdapterV2,
  ScreenProjectDraft,
  ScreenProjectDraftV2,
  ScreenProjectEnvelope,
  ScreenProjectEnvelopeV2,
  ScreenPublicErrorV2,
  ScreenOperation,
  ScreenOperationSuccessDetail,
  ScreenSdkDiagnosticV2,
  ScreenSdkDocument,
  ScreenSnapshotSummary,
} from '@nebula/screen-editor-core';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';

// ===== V1/V2 闭合联合类型（Spec §14.1） =====

/** SDK draft 联合（V1 + V2），通过 `document.schemaVersion` 收窄。 */
export type ScreenSdkProjectDraft = ScreenProjectDraft | ScreenProjectDraftV2;

/** SDK envelope 联合（V1 + V2），通过 `document.schemaVersion` 收窄。 */
export type ScreenSdkProjectEnvelope = ScreenProjectEnvelope | ScreenProjectEnvelopeV2;

/** SDK adapter 联合（V1 + V2），V2 通过 `documentVersion: 2` marker 区分。 */
export type ScreenEditorAdapterV2 = ScreenHostAdapter | ScreenHostAdapterV2;

// ===== V2 操作成功详情联合（Spec §14.1） =====

/**
 * V2 操作成功事件详情联合。
 *
 * `import` 与 `snapshot-restore` 的 envelope 升级为 V1/V2 联合；
 * 其他操作保持 V1 形状（不携带 envelope）。
 */
export type ScreenOperationSuccessDetailV2 =
  | Exclude<ScreenOperationSuccessDetail, { operation: 'import' | 'snapshot-restore' }>
  | { projectId: string; operation: 'import'; envelope: ScreenSdkProjectEnvelope }
  | {
      projectId: string;
      operation: 'snapshot-restore';
      envelope: ScreenSdkProjectEnvelope;
    };

// ===== V2 事件 map（Spec §14.1） =====

/**
 * V2 事件 map：将 ready/change/save-success/publish-success/operation-success/
 * preview-request/error 升级为 V1/V2 联合分支。
 *
 * 其余事件（dirty-change/selection-change/navigate-request）不携带文档，
 * 保持 V1 形状。
 */
export type NebulaScreenEditorEventMapV2 = Omit<
  NebulaScreenEditorEventMap,
  | 'nebula-ready'
  | 'nebula-change'
  | 'nebula-save-success'
  | 'nebula-publish-success'
  | 'nebula-operation-success'
  | 'nebula-preview-request'
  | 'nebula-error'
> & {
  'nebula-ready': CustomEvent<{
    projectId: string;
    envelope: ScreenSdkProjectEnvelope;
  }>;
  'nebula-change': CustomEvent<{
    projectId: string;
    draft: ScreenSdkProjectDraft;
    reason: ScreenChangeReason;
  }>;
  'nebula-save-success': CustomEvent<{
    projectId: string;
    envelope: ScreenSdkProjectEnvelope;
  }>;
  'nebula-publish-success': CustomEvent<{
    projectId: string;
    envelope: ScreenSdkProjectEnvelope;
  }>;
  'nebula-operation-success': CustomEvent<ScreenOperationSuccessDetailV2>;
  'nebula-preview-request': CustomEvent<{
    projectId: string;
    revision: string;
    draft: ScreenSdkProjectDraft;
  }>;
  'nebula-error': CustomEvent<{
    projectId?: string;
    operation: ScreenOperation;
    error: ScreenPublicErrorV2;
  }>;
};

// ===== 公共组件注册表类型（Spec §8.2） =====

/**
 * 公共组件注册项基类（Spec §8.2 ScreenComponentRegistrationBase）。
 *
 * 与内部 `ScreenComponentRegistrationBase` 的区别：不包含 legacy 兼容字段。
 * 内部 registration 是结构化超集，可直接赋值给此公共类型。
 */
export interface ScreenComponentRegistrationBase {
  /** 组件 manifest（Spec §7.2，注册表的权威数据源） */
  readonly manifest: Readonly<ScreenComponentManifestV1>;
}

/**
 * 公共组件注册项（Spec §8.2）。
 *
 * - `source: 'built-in'`：内置组件，elementConstructor 可选
 * - `source: 'host'`：宿主注册的外部组件，必须提供 elementConstructor
 */
export type ScreenComponentRegistration =
  | (ScreenComponentRegistrationBase & {
      readonly source: 'built-in';
      readonly elementConstructor?: CustomElementConstructor;
    })
  | (ScreenComponentRegistrationBase & {
      readonly source: 'host';
      readonly elementConstructor: CustomElementConstructor;
    });

/**
 * 公共组件注册表接口（Spec §8.2）。
 *
 * 不可变快照，只暴露读操作。内部 `ScreenComponentInstanceRegistry` 是结构化超集
 * （registration 包含 legacy 字段），可直接赋值给此接口。
 */
export interface ScreenComponentRegistry {
  /** 注册项数量 */
  readonly size: number;
  /** 按 type 取注册项 */
  get(type: string): ScreenComponentRegistration | undefined;
  /** 判断 type 是否已注册 */
  has(type: string): boolean;
  /** 列出所有注册项（保持构建顺序，供组件库排序使用） */
  list(): readonly ScreenComponentRegistration[];
}

// ===== Re-export V1/V2 文档与诊断类型（便于消费方单一导入） =====

export type {
  ScreenDocumentV1,
  ScreenDocumentV2,
  ScreenSdkDocument,
  ScreenSdkDiagnosticV2,
  ScreenSnapshotSummary,
};
