import {
  BlueprintFieldSchema,
  CanvasConfigSchema,
  ComponentPositionSchema,
  ComponentStatusSchema,
  ComponentStyleSchema,
  EventBlueprintV2Schema,
  FieldMappingSchema,
  InteractionConfigSchema,
  LogicConfigSchema,
  migrateBlueprintV1ToV2,
  type EventBlueprint,
  type EventBlueprintV2,
} from '@nebula/shared';
import { z } from 'zod';
import { checkJsonValue, validateValueAgainstSchema } from '@nebula/screen-component-sdk';
import type { ScreenComponentValidationDiagnostic } from '@nebula/screen-component-sdk';
import {
  getScreenSdkSourceHandles,
  getScreenSdkTargetHandles,
  isScreenSdkBlueprintNodeKind,
  isScreenSdkGlobalComponentType,
  isScreenSdkV1ActionType,
  isScreenSdkV1TriggerType,
  SCREEN_SDK_COMPONENT_TYPES,
} from '../core/static-capability-profile.js';
import type {
  ScreenComponentInstanceRegistry,
  ScreenComponentRegistration,
} from '../registry/instance-registry.js';
import {
  createDiagnostic,
  createV2Diagnostic,
  diagnosticsFromZodError,
  diagnosticsFromZodErrorV2,
  ScreenSdkDiagnosticCode,
  type ScreenSdkDiagnostic,
  type ScreenSdkDiagnosticV2,
} from './diagnostics.js';

export const SCREEN_DOCUMENT_VERSION = 1 as const;
export const SCREEN_TRANSFER_FORMAT_VERSION = 1 as const;
export const SCREEN_TRANSFER_MAX_BYTES = 10 * 1024 * 1024;

export { SCREEN_SDK_COMPONENT_TYPES } from '../core/static-capability-profile.js';

export const ScreenSdkComponentTypeSchema = z.enum(SCREEN_SDK_COMPONENT_TYPES);
export type ScreenSdkComponentType = z.infer<typeof ScreenSdkComponentTypeSchema>;

const HttpUrlSchema = z
  .string()
  .regex(/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i, '图片地址必须是有效的 http(s) URL')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, '图片地址必须是有效的 http(s) URL');

const DataUrlSchema = z.string().regex(/^data:[^,]+,.*$/i, '图片地址必须是有效的 data URL');

const HttpOrDataUrlSchema = z.union([z.literal(''), HttpUrlSchema, DataUrlSchema]);
const NonBlankStringSchema = z.string().regex(/\S/, '值不能为空白字符串');
const ProjectNameSchema = NonBlankStringSchema.trim();

export const ScreenSdkComponentPropsSchemas = {
  text: z.object({ content: z.string().optional() }).strict(),
  'bar-chart': z.object({ title: z.string().optional(), data: z.unknown().optional() }).strict(),
  rect: z.object({}).strict(),
  ellipse: z.object({}).strict(),
  image: z.object({ src: HttpOrDataUrlSchema.optional(), alt: z.string().optional() }).strict(),
  button: z.object({ text: z.string().optional() }).strict(),
} as const;

export interface ScreenSdkComponentPropsMap {
  text: z.infer<(typeof ScreenSdkComponentPropsSchemas)['text']>;
  'bar-chart': z.infer<(typeof ScreenSdkComponentPropsSchemas)['bar-chart']>;
  rect: z.infer<(typeof ScreenSdkComponentPropsSchemas)['rect']>;
  ellipse: z.infer<(typeof ScreenSdkComponentPropsSchemas)['ellipse']>;
  image: z.infer<(typeof ScreenSdkComponentPropsSchemas)['image']>;
  button: z.infer<(typeof ScreenSdkComponentPropsSchemas)['button']>;
}

export const StaticDataSourceConfigSchema = z
  .object({
    type: z.literal('static'),
    staticData: z.unknown(),
    dataPath: z.string().optional(),
    fieldMapping: FieldMappingSchema.optional(),
  })
  .strict();

export type StaticDataSourceConfig = z.infer<typeof StaticDataSourceConfigSchema>;

const ScreenSdkComponentBaseShape = {
  id: z.string().min(1),
  name: z.string().min(1),
  position: ComponentPositionSchema,
  style: ComponentStyleSchema,
  dataSource: StaticDataSourceConfigSchema.optional(),
  logic: LogicConfigSchema.optional(),
  interaction: InteractionConfigSchema.optional(),
  status: ComponentStatusSchema,
  zIndex: z.number().int(),
  parentId: z.string().nullable().optional(),
};

function createComponentSchema<Type extends ScreenSdkComponentType>(type: Type) {
  return z
    .object({
      ...ScreenSdkComponentBaseShape,
      type: z.literal(type),
      props: ScreenSdkComponentPropsSchemas[type],
    })
    .strict();
}

export const ScreenSdkComponentSchema = z.discriminatedUnion('type', [
  createComponentSchema('text'),
  createComponentSchema('bar-chart'),
  createComponentSchema('rect'),
  createComponentSchema('ellipse'),
  createComponentSchema('image'),
  createComponentSchema('button'),
]);

export type StaticScreenComponent = z.infer<typeof ScreenSdkComponentSchema>;

export const StaticGlobalVariableSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.literal('static'),
    value: z.unknown().optional(),
    description: z.string().optional(),
  })
  .strict();

export type StaticGlobalVariable = z.infer<typeof StaticGlobalVariableSchema>;

const ScreenSdkCanvasConfigSchema = CanvasConfigSchema.extend({
  backgroundImage: HttpOrDataUrlSchema.optional(),
}).strict();

export const ScreenDocumentV1Schema = z
  .object({
    schemaVersion: z.literal(SCREEN_DOCUMENT_VERSION),
    canvas: ScreenSdkCanvasConfigSchema,
    components: z.array(ScreenSdkComponentSchema),
    blueprint: EventBlueprintV2Schema.optional(),
    globalVariables: z.array(StaticGlobalVariableSchema).default([]),
  })
  .strict();

export type ScreenDocumentV1 = z.infer<typeof ScreenDocumentV1Schema>;

export const ScreenDocumentInputSchema = z
  .object({
    schemaVersion: z.number(),
    canvas: z.unknown(),
    components: z.array(z.unknown()),
    blueprint: z.unknown().optional(),
    globalVariables: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type ScreenDocumentInput = z.infer<typeof ScreenDocumentInputSchema>;

export const ScreenProjectDraftSchema = z
  .object({
    name: ProjectNameSchema,
    description: z.string().nullable().optional(),
    document: ScreenDocumentV1Schema,
  })
  .strict();

export type ScreenProjectDraft = z.infer<typeof ScreenProjectDraftSchema>;

export const ScreenProjectStatusSchema = z.enum(['draft', 'published']);
export type ScreenProjectStatus = z.infer<typeof ScreenProjectStatusSchema>;

export const ScreenProjectEnvelopeSchema = ScreenProjectDraftSchema.extend({
  id: z.string().min(1),
  status: ScreenProjectStatusSchema,
  revision: NonBlankStringSchema,
}).strict();

export type ScreenProjectEnvelope = z.infer<typeof ScreenProjectEnvelopeSchema>;

export const ScreenProjectEnvelopeInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().nullable().optional(),
    status: ScreenProjectStatusSchema,
    revision: NonBlankStringSchema,
    document: ScreenDocumentInputSchema,
  })
  .strict();

export type ScreenProjectEnvelopeInput = z.infer<typeof ScreenProjectEnvelopeInputSchema>;

export const ScreenProjectTransferV1Schema = z
  .object({
    format: z.literal('nebula-screen'),
    formatVersion: z.literal(SCREEN_TRANSFER_FORMAT_VERSION),
    name: ProjectNameSchema,
    description: z.string().nullable().optional(),
    document: ScreenDocumentV1Schema,
  })
  .strict();

export type ScreenProjectTransferV1 = z.infer<typeof ScreenProjectTransferV1Schema>;

// ===== Screen Document V2（Spec §12.2 / §12.3） =====

export const SCREEN_DOCUMENT_V2_VERSION = 2 as const;
export const SCREEN_TRANSFER_FORMAT_VERSION_V2 = 2 as const;

/**
 * V2 wire 组件 schema（Spec §12.2）。
 *
 * 与 V1 `ScreenSdkComponentSchema` 的差异：
 * - `type` 接受任意字符串（registry 在运行时按 type 查 manifest 校验）
 * - `props` 为 JSON record（manifest propsSchema 在运行时校验）
 * - 保留 dataSource / logic / interaction 可选字段：内置组件（如 bar-chart）继续使用；
 *   V2 parser 对 `source='host'` 外部组件拒绝这些字段并返回
 *   `UNSUPPORTED_COMPONENT_CAPABILITY`（Requirement 14，Task 5.2 实现）
 *
 * `.strict()` 拒绝 `tagName` / `moduleUrl` / `script` 等字段（Requirement 12：
 * 项目文档不得声明或触发组件脚本加载）。
 */
const ScreenSdkV2ComponentWireSchema = z
  .object({
    ...ScreenSdkComponentBaseShape,
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
  })
  .strict();

export type ScreenSdkV2ComponentWire = z.infer<typeof ScreenSdkV2ComponentWireSchema>;

/**
 * V2 wire 文档 schema（Spec §12.2 两阶段校验第一阶段）。
 *
 * 仅校验文档容器、组件公共字段和 JSON 边界；组件特定 schema 由注册表在运行时提供。
 * 与 V1 `ScreenDocumentV1Schema` 的差异：`schemaVersion=2`，组件使用 permissive wire 形状。
 *
 * `.strict()` 拒绝未知顶层字段（如 `tagName` / `moduleUrl` / `script`）。
 */
export const ScreenDocumentV2WireSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_DOCUMENT_V2_VERSION),
    canvas: ScreenSdkCanvasConfigSchema,
    components: z.array(ScreenSdkV2ComponentWireSchema),
    blueprint: EventBlueprintV2Schema.optional(),
    globalVariables: z.array(StaticGlobalVariableSchema).default([]),
  })
  .strict();

/**
 * V2 文档 domain 类型（Spec §12.2）。
 *
 * 结构与 `ScreenDocumentV2WireSchema` 的推断类型一致：registry 校验在 parser
 * 阶段完成（Task 5.2），通过后的文档实例结构与 wire 形状相同。
 */
export type ScreenDocumentV2 = z.infer<typeof ScreenDocumentV2WireSchema>;

/**
 * V2 文档 wire 输入类型（Spec §12.2）。
 *
 * 与 V1 `ScreenDocumentInput` 对应：用于 envelope input 中尚未通过 domain 校验的
 * 文档字段。`schemaVersion` 仍必须是 2，其余字段保持 unknown 以便后续两阶段校验。
 */
export const ScreenDocumentV2InputSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_DOCUMENT_V2_VERSION),
    canvas: z.unknown(),
    components: z.array(z.unknown()),
    blueprint: z.unknown().optional(),
    globalVariables: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type ScreenDocumentV2Input = z.infer<typeof ScreenDocumentV2InputSchema>;

/**
 * SDK 文档联合类型（Spec §12.2）。
 *
 * V1/V2 通过 `document.schemaVersion` 收窄；save/publish/事件保持同一文档分支，
 * 不混合 V1 draft 与 V2 envelope（Spec §14.1）。
 */
export type ScreenSdkDocument = ScreenDocumentV1 | ScreenDocumentV2;

export const ScreenProjectDraftV2Schema = z
  .object({
    name: ProjectNameSchema,
    description: z.string().nullable().optional(),
    document: ScreenDocumentV2WireSchema,
  })
  .strict();

export type ScreenProjectDraftV2 = z.infer<typeof ScreenProjectDraftV2Schema>;

export const ScreenProjectEnvelopeV2Schema = ScreenProjectDraftV2Schema.extend({
  id: z.string().min(1),
  status: ScreenProjectStatusSchema,
  revision: NonBlankStringSchema,
}).strict();

export type ScreenProjectEnvelopeV2 = z.infer<typeof ScreenProjectEnvelopeV2Schema>;

export const ScreenProjectEnvelopeInputV2Schema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().nullable().optional(),
    status: ScreenProjectStatusSchema,
    revision: NonBlankStringSchema,
    document: ScreenDocumentV2InputSchema,
  })
  .strict();

export type ScreenProjectEnvelopeInputV2 = z.infer<typeof ScreenProjectEnvelopeInputV2Schema>;

/**
 * V2 transfer schema（Spec §12.3）。
 *
 * `formatVersion=2` 只能包含 V2 document；V1 transfer 不得嵌入 V2 document，
 * V2 transfer 不得嵌入 V1 document。import 时按 formatVersion 判别。
 */
export const ScreenProjectTransferV2Schema = z
  .object({
    format: z.literal('nebula-screen'),
    formatVersion: z.literal(SCREEN_TRANSFER_FORMAT_VERSION_V2),
    name: ProjectNameSchema,
    description: z.string().nullable().optional(),
    document: ScreenDocumentV2WireSchema,
  })
  .strict();

export type ScreenProjectTransferV2 = z.infer<typeof ScreenProjectTransferV2Schema>;

/**
 * V2 export schema（Spec §12.3）。
 *
 * Adapter 返回结构化 `fileName` + `transfer`；SDK 校验后自行 `JSON.stringify`、
 * 创建 Blob 并触发下载，不信任 Adapter 返回的 opaque Blob 内容。
 *
 * fileName 安全规则与 V1 `ScreenExportFileSchema` 一致：safe `.json` basename，
 * 拒绝路径段、`..`、控制字符。
 */
const SAFE_JSON_FILE_NAME_PATTERN_V2 = /^[^/\\]{1,255}\.json$/i;

function containsControlCharacterV2(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

export const ScreenProjectExportV2Schema = z
  .object({
    fileName: z
      .string()
      .max(255)
      .regex(SAFE_JSON_FILE_NAME_PATTERN_V2, '导出文件名必须是安全的 .json basename')
      .refine((value) => !value.includes('..'), '导出文件名不能包含 .. 路径段')
      .refine((value) => !containsControlCharacterV2(value), '导出文件名不能包含控制字符'),
    transfer: ScreenProjectTransferV2Schema,
  })
  .strict();

export type ScreenProjectExportV2 = z.infer<typeof ScreenProjectExportV2Schema>;

export type ScreenContractParseResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      code: 'VALIDATION' | 'UNSUPPORTED_DOCUMENT_FEATURE';
      diagnostics: ScreenSdkDiagnostic[];
    };

/**
 * V2 parse 结果（Spec §12.2 两阶段校验 + §12.4 V2 diagnostics）。
 *
 * 与 V1 `ScreenContractParseResult` 结构一致，仅将 diagnostics 类型升级为
 * `ScreenSdkDiagnosticV2`，以支持 MISSING_COMPONENT_DEFINITION /
 * UNSUPPORTED_COMPONENT_CAPABILITY / INVALID_COMPONENT_EVENT 等 V2 code。
 */
export type ScreenContractParseResultV2<T> =
  | { success: true; data: T }
  | {
      success: false;
      code: 'VALIDATION' | 'UNSUPPORTED_DOCUMENT_FEATURE';
      diagnostics: ScreenSdkDiagnosticV2[];
    };

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function addUniqueDiagnostic(
  diagnostics: ScreenSdkDiagnostic[],
  diagnostic: ScreenSdkDiagnostic,
): void {
  const key = `${diagnostic.code}:${diagnostic.path.join('.')}`;
  if (!diagnostics.some((item) => `${item.code}:${item.path.join('.')}` === key)) {
    diagnostics.push(diagnostic);
  }
}

const COMPONENT_PROP_KEYS: Record<ScreenSdkComponentType, ReadonlySet<string>> = {
  text: new Set(['content']),
  'bar-chart': new Set(['title', 'data']),
  rect: new Set(),
  ellipse: new Set(),
  image: new Set(['src', 'alt']),
  button: new Set(['text']),
};

function scanComponents(document: UnknownRecord, diagnostics: ScreenSdkDiagnostic[]): Set<string> {
  const componentIds = new Set<string>();
  if (!Array.isArray(document.components)) return componentIds;

  for (const [index, rawComponent] of document.components.entries()) {
    const component = asRecord(rawComponent);
    if (component === undefined) continue;
    if (typeof component.id === 'string') componentIds.add(component.id);

    const typeResult = ScreenSdkComponentTypeSchema.safeParse(component.type);
    if (!typeResult.success) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNKNOWN_COMPONENT_TYPE,
          ['components', index, 'type'],
          '组件类型不在 SDK V1 支持列表中',
        ),
      );
      continue;
    }

    const props = asRecord(component.props);
    if (props !== undefined) {
      const allowedKeys = COMPONENT_PROP_KEYS[typeResult.data];
      for (const key of Object.keys(props)) {
        if (!allowedKeys.has(key)) {
          addUniqueDiagnostic(
            diagnostics,
            createDiagnostic(
              ScreenSdkDiagnosticCode.INVALID_COMPONENT_PROPS,
              ['components', index, 'props', key],
              '组件包含 SDK V1 未声明的属性',
            ),
          );
        }
      }
    }

    const dataSource = asRecord(component.dataSource);
    if (
      dataSource !== undefined &&
      (dataSource.type !== 'static' || 'apiConfig' in dataSource || 'datasetId' in dataSource)
    ) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_DATA_SOURCE,
          ['components', index, 'dataSource'],
          'SDK V1 仅支持静态数据源',
        ),
      );
    }
  }
  return componentIds;
}

function scanGlobalVariables(document: UnknownRecord, diagnostics: ScreenSdkDiagnostic[]): void {
  if (!Array.isArray(document.globalVariables)) return;
  for (const [index, rawVariable] of document.globalVariables.entries()) {
    const variable = asRecord(rawVariable);
    if (
      variable !== undefined &&
      (variable.type !== 'static' || 'apiConfig' in variable || 'expression' in variable)
    ) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_GLOBAL_VARIABLE_TYPE,
          ['globalVariables', index, 'type'],
          'SDK V1 仅支持静态全局变量',
        ),
      );
    }
  }
}

function scanV1Blueprint(blueprint: UnknownRecord, diagnostics: ScreenSdkDiagnostic[]): boolean {
  if (!Array.isArray(blueprint.nodes)) return false;
  let supported = true;
  for (const [index, rawNode] of blueprint.nodes.entries()) {
    const node = asRecord(rawNode);
    const config = asRecord(node?.config);
    if (!['trigger', 'condition', 'action', 'comment'].includes(String(node?.kind))) {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          ['blueprint', 'nodes', index, 'kind'],
          '蓝图节点类型不在 SDK V1 白名单中',
        ),
      );
    } else if (node?.kind === 'trigger' && !isScreenSdkV1TriggerType(config?.type)) {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_EVENT,
          ['blueprint', 'nodes', index, 'config', 'type'],
          '蓝图事件不在 SDK V1 白名单中',
        ),
      );
    } else if (node?.kind === 'action' && config?.type === 'requestApi') {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          ['blueprint', 'nodes', index, 'config', 'type'],
          'SDK V1 不支持网络请求节点',
        ),
      );
    } else if (node?.kind === 'action' && !isScreenSdkV1ActionType(config?.type)) {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_ACTION,
          ['blueprint', 'nodes', index, 'config', 'type'],
          '蓝图动作不在 SDK V1 白名单中',
        ),
      );
    }
  }
  return supported;
}

function scanRawV2Blueprint(blueprint: UnknownRecord, diagnostics: ScreenSdkDiagnostic[]): boolean {
  if (!Array.isArray(blueprint.nodes)) return false;
  let supported = true;
  for (const [index, rawNode] of blueprint.nodes.entries()) {
    const node = asRecord(rawNode);
    const globalType = typeof node?.globalType === 'string' ? node.globalType : undefined;
    if (!isScreenSdkBlueprintNodeKind(node?.kind)) {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          ['blueprint', 'nodes', index, 'kind'],
          '蓝图节点类型不在 SDK V1 白名单中',
        ),
      );
    } else if (
      node?.kind === 'component' &&
      globalType !== undefined &&
      !isScreenSdkGlobalComponentType(globalType)
    ) {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          ['blueprint', 'nodes', index, 'globalType'],
          '全局蓝图节点不在 SDK V1 白名单中',
        ),
      );
    }
  }
  return supported;
}

function allowedSourceHandles(node: EventBlueprintV2['nodes'][number]): ReadonlySet<string> {
  return getScreenSdkSourceHandles(node);
}

function allowedTargetHandles(node: EventBlueprintV2['nodes'][number]): ReadonlySet<string> {
  return getScreenSdkTargetHandles(node);
}

function scanV2Blueprint(
  blueprint: EventBlueprintV2,
  componentIds: ReadonlySet<string>,
  diagnostics: ScreenSdkDiagnostic[],
): void {
  const nodeMap = new Map(blueprint.nodes.map((node) => [node.id, node]));
  for (const [index, node] of blueprint.nodes.entries()) {
    if (node.kind !== 'component') {
      if (node.kind === 'condition') {
        const componentId = node.config.expression.source.componentId;
        if (!componentIds.has(componentId)) {
          addUniqueDiagnostic(
            diagnostics,
            createDiagnostic(
              ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
              ['blueprint', 'nodes', index, 'config', 'expression', 'source', 'componentId'],
              '蓝图引用了不存在的组件',
            ),
          );
        }
      }
      continue;
    }

    if (node.globalType === 'requestApi') {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          ['blueprint', 'nodes', index, 'globalType'],
          'SDK V1 不支持网络请求节点',
        ),
      );
    } else if (node.globalType === undefined && !componentIds.has(node.componentId)) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'nodes', index, 'componentId'],
          '蓝图引用了不存在的组件',
        ),
      );
    } else if (
      node.globalType === 'scrollTo' &&
      node.config?.globalType === 'scrollTo' &&
      !componentIds.has(node.config.targetComponentId)
    ) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'nodes', index, 'config', 'targetComponentId'],
          '蓝图引用了不存在的组件',
        ),
      );
    }
  }

  for (const [index, edge] of blueprint.edges.entries()) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode === undefined) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'edges', index, 'source'],
          '蓝图边引用了不存在的源节点',
        ),
      );
    } else if (!allowedSourceHandles(sourceNode).has(edge.sourceHandle)) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_EVENT,
          ['blueprint', 'edges', index, 'sourceHandle'],
          '蓝图事件锚点不在 SDK V1 白名单中',
        ),
      );
    }

    if (targetNode === undefined) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'edges', index, 'target'],
          '蓝图边引用了不存在的目标节点',
        ),
      );
    } else if (!allowedTargetHandles(targetNode).has(edge.targetHandle)) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_ACTION,
          ['blueprint', 'edges', index, 'targetHandle'],
          '蓝图动作锚点不在 SDK V1 白名单中',
        ),
      );
    }
  }
}

function getMigrationWarningPath(
  blueprint: EventBlueprint,
  sourceId: string,
): ReadonlyArray<string | number> {
  const edgeIndex = blueprint.edges.findIndex((edge) => edge.id === sourceId);
  if (edgeIndex >= 0) return ['blueprint', 'edges', edgeIndex];
  const nodeIndex = blueprint.nodes.findIndex((node) => node.id === sourceId);
  return nodeIndex >= 0 ? ['blueprint', 'nodes', nodeIndex] : ['blueprint'];
}

function migrateBlueprintForSdk(
  blueprint: EventBlueprint,
): ScreenContractParseResult<EventBlueprintV2> {
  const migration = migrateBlueprintV1ToV2(blueprint);
  if (migration.warnings.length > 0) {
    return {
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: migration.warnings.map((warning) =>
        createDiagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          getMigrationWarningPath(blueprint, warning.sourceId),
          'V1 蓝图包含无法无损迁移的节点或边',
        ),
      ),
    };
  }

  const nodes = [...migration.blueprint.nodes];
  const edges = migration.blueprint.edges.map((edge) => ({ ...edge }));
  const v1NodeMap = new Map(blueprint.nodes.map((node) => [node.id, node]));
  const v1EdgeMap = new Map(blueprint.edges.map((edge) => [edge.id, edge]));
  const scrollNodeIds = new Map<string, string>();
  const usedNodeIds = new Set(nodes.map((node) => node.id));

  for (const edge of edges) {
    if (edge.targetHandle !== 'act:scrollTo') continue;
    const v1Edge = v1EdgeMap.get(edge.id);
    const v1Target = v1Edge === undefined ? undefined : v1NodeMap.get(v1Edge.target);
    if (v1Target?.kind !== 'action' || v1Target.config.type !== 'scrollToComponent') continue;

    const targetComponentId = v1Target.config.targetComponentId;
    let scrollNodeId = scrollNodeIds.get(targetComponentId);
    if (scrollNodeId === undefined) {
      let sequence = scrollNodeIds.size + 1;
      do {
        scrollNodeId = `v2-component-scrollTo-${sequence}`;
        sequence += 1;
      } while (usedNodeIds.has(scrollNodeId));
      scrollNodeIds.set(targetComponentId, scrollNodeId);
      usedNodeIds.add(scrollNodeId);
      nodes.push({
        id: scrollNodeId,
        kind: 'component',
        componentId: 'global',
        globalType: 'scrollTo',
        config: { globalType: 'scrollTo', targetComponentId },
        position: v1Target.position,
      });
    }
    edge.target = scrollNodeId;
  }

  return {
    success: true,
    data: { ...migration.blueprint, nodes, edges },
  };
}

export function validateScreenSdkCapabilities(input: unknown): ScreenSdkDiagnostic[] {
  const diagnostics: ScreenSdkDiagnostic[] = [];
  const document = asRecord(input);
  if (document === undefined) return diagnostics;

  const componentIds = scanComponents(document, diagnostics);
  scanGlobalVariables(document, diagnostics);
  const rawBlueprint = asRecord(document.blueprint);
  if (rawBlueprint === undefined) return diagnostics;

  if (rawBlueprint.version === 1) {
    const supported = scanV1Blueprint(rawBlueprint, diagnostics);
    if (!supported) return diagnostics;
    const parsed = BlueprintFieldSchema.safeParse(rawBlueprint);
    if (parsed.success && parsed.data.version === 1) {
      const migration = migrateBlueprintForSdk(parsed.data);
      if (!migration.success) {
        for (const diagnostic of migration.diagnostics) {
          addUniqueDiagnostic(diagnostics, diagnostic);
        }
      } else {
        scanV2Blueprint(migration.data, componentIds, diagnostics);
      }
    }
  } else if (rawBlueprint.version === 2) {
    scanRawV2Blueprint(rawBlueprint, diagnostics);
    const parsed = EventBlueprintV2Schema.safeParse(rawBlueprint);
    if (parsed.success) scanV2Blueprint(parsed.data, componentIds, diagnostics);
  } else {
    addUniqueDiagnostic(
      diagnostics,
      createDiagnostic(
        ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
        ['blueprint', 'version'],
        '蓝图版本不受 SDK V1 支持',
      ),
    );
  }
  return diagnostics;
}

function normalizeBlueprint(
  input: unknown,
): ScreenContractParseResult<EventBlueprintV2 | undefined> {
  if (input === undefined) return { success: true, data: undefined };
  const parsed = BlueprintFieldSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(parsed.error, ['blueprint']),
    };
  }
  if (parsed.data.version === 1) return migrateBlueprintForSdk(parsed.data);
  const blueprint = parsed.data;
  const normalized = EventBlueprintV2Schema.safeParse(blueprint);
  return normalized.success
    ? { success: true, data: normalized.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodError(normalized.error, ['blueprint']),
      };
}

export function parseScreenDocument(input: unknown): ScreenContractParseResult<ScreenDocumentV1> {
  const wireResult = ScreenDocumentInputSchema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(wireResult.error),
    };
  }
  if (wireResult.data.schemaVersion !== SCREEN_DOCUMENT_VERSION) {
    return {
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: [
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_SCHEMA_VERSION,
          ['schemaVersion'],
          '文档版本不受当前 SDK 支持',
        ),
      ],
    };
  }

  const capabilityDiagnostics = validateScreenSdkCapabilities(wireResult.data);
  if (capabilityDiagnostics.length > 0) {
    return {
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: capabilityDiagnostics,
    };
  }

  const blueprintResult = normalizeBlueprint(wireResult.data.blueprint);
  if (!blueprintResult.success) return blueprintResult;
  const domainResult = ScreenDocumentV1Schema.safeParse({
    ...wireResult.data,
    blueprint: blueprintResult.data,
    globalVariables: wireResult.data.globalVariables ?? [],
  });
  return domainResult.success
    ? { success: true, data: domainResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodError(domainResult.error),
      };
}

export function parseScreenProjectEnvelopeInput(
  input: unknown,
  expectedProjectId?: string,
): ScreenContractParseResult<ScreenProjectEnvelope> {
  const wireResult = ScreenProjectEnvelopeInputSchema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(wireResult.error),
    };
  }
  if (expectedProjectId !== undefined && wireResult.data.id !== expectedProjectId) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: [
        createDiagnostic(
          ScreenSdkDiagnosticCode.INVALID_DOCUMENT,
          ['id'],
          'Adapter 返回的项目 id 与当前项目不一致',
        ),
      ],
    };
  }
  const documentResult = parseScreenDocument(wireResult.data.document);
  if (!documentResult.success) return documentResult;
  const envelopeResult = ScreenProjectEnvelopeSchema.safeParse({
    ...wireResult.data,
    document: documentResult.data,
  });
  return envelopeResult.success
    ? { success: true, data: envelopeResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodError(envelopeResult.error),
      };
}

export function cloneScreenProjectDraft(draft: ScreenProjectDraft): ScreenProjectDraft {
  return structuredClone(draft);
}

export function cloneScreenProjectTransfer(
  transfer: ScreenProjectTransferV1,
): ScreenProjectTransferV1 {
  return structuredClone(transfer);
}

// ===== V2 Parser（Spec §12.2 两阶段校验 + Requirement 8 + Requirement 14） =====

function addUniqueV2Diagnostic(
  diagnostics: ScreenSdkDiagnosticV2[],
  diagnostic: ScreenSdkDiagnosticV2,
): void {
  const key = `${diagnostic.code}:${diagnostic.path.join('.')}`;
  if (!diagnostics.some((item) => `${item.code}:${item.path.join('.')}` === key)) {
    diagnostics.push(diagnostic);
  }
}

function appendJsonBoundaryDiagnostics(
  value: unknown,
  path: ReadonlyArray<string | number>,
  code: ScreenSdkDiagnosticCode,
  diagnostics: ScreenSdkDiagnosticV2[],
): void {
  const validationDiagnostics: ScreenComponentValidationDiagnostic[] = [];
  if (checkJsonValue(value, path, validationDiagnostics)) return;

  for (const diagnostic of validationDiagnostics) {
    addUniqueV2Diagnostic(
      diagnostics,
      createV2Diagnostic(code, diagnostic.path, diagnostic.message),
    );
  }
}

/**
 * 获取 V2 蓝图组件节点的允许 source handle 集合（Spec §12.2: registry-derived allowlist）。
 *
 * 与 V1 `getScreenSdkSourceHandles` 的差异：组件节点（kind='component',
 * globalType=undefined）的 source handle 不再使用静态 `evt:click`/`evt:hover`
 * 白名单，而是从组件 manifest.events 派生 `evt:${event.id}`。
 *
 * 全局节点（pageLoad/interval）、condition/delay/comment 与 V1 一致。
 * 若组件未在 registry 中注册（已报告 MISSING_COMPONENT_DEFINITION），返回空集
 * 以跳过 sourceHandle 校验，避免产生重复的噪声诊断。
 */
function getV2ComponentSourceHandles(
  node: EventBlueprintV2['nodes'][number],
  registrationByComponentId: ReadonlyMap<string, ScreenComponentRegistration | undefined>,
): ReadonlySet<string> {
  if (node.kind === 'condition') return new Set(['then', 'else']);
  if (node.kind === 'delay') return new Set(['out']);
  if (node.kind === 'comment') return new Set();
  if (node.globalType === 'pageLoad') return new Set(['evt:pageLoad']);
  if (node.globalType === 'interval') return new Set(['evt:interval']);
  if (node.globalType !== undefined) return new Set();

  const registration = registrationByComponentId.get(node.componentId);
  const events = registration?.manifest.events;
  if (events === undefined || events.length === 0) return new Set();
  return new Set(events.map((event) => `evt:${event.id}`));
}

/**
 * 校验 V2 蓝图的语义完整性（Spec §12.2 + Requirement 8）。
 *
 * 与 V1 `scanV2Blueprint` 的差异：
 * - source handle 使用 registry-derived allowlist（`evt:${event.id}` from manifest.events）
 *   替代静态 `evt:click`/`evt:hover` 白名单；未声明的事件返回 INVALID_COMPONENT_EVENT
 * - target handle 继续使用 V1 静态白名单（act:show/hide/toggleVisibility/navigate/scrollTo）
 * - requestApi 全局节点继续拒绝（UNSUPPORTED_BLUEPRINT_NODE）
 * - dangling component reference 继续返回 DANGLING_COMPONENT_REFERENCE
 */
function validateV2Blueprint(
  blueprint: EventBlueprintV2,
  registrationByComponentId: ReadonlyMap<string, ScreenComponentRegistration | undefined>,
  componentIds: ReadonlySet<string>,
  diagnostics: ScreenSdkDiagnosticV2[],
): void {
  const nodeMap = new Map(blueprint.nodes.map((node) => [node.id, node]));

  for (const [index, node] of blueprint.nodes.entries()) {
    if (node.kind !== 'component') {
      if (node.kind === 'condition') {
        const componentId = node.config.expression.source.componentId;
        if (!componentIds.has(componentId)) {
          addUniqueV2Diagnostic(
            diagnostics,
            createV2Diagnostic(
              ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
              ['blueprint', 'nodes', index, 'config', 'expression', 'source', 'componentId'],
              '蓝图引用了不存在的组件',
            ),
          );
        }
      }
      continue;
    }

    if (node.globalType === 'requestApi') {
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          ['blueprint', 'nodes', index, 'globalType'],
          'SDK V2 不支持网络请求节点',
        ),
      );
    } else if (node.globalType === undefined && !componentIds.has(node.componentId)) {
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'nodes', index, 'componentId'],
          '蓝图引用了不存在的组件',
        ),
      );
    } else if (
      node.globalType === 'scrollTo' &&
      node.config?.globalType === 'scrollTo' &&
      !componentIds.has(node.config.targetComponentId)
    ) {
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'nodes', index, 'config', 'targetComponentId'],
          '蓝图引用了不存在的组件',
        ),
      );
    }
  }

  for (const [index, edge] of blueprint.edges.entries()) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (sourceNode === undefined) {
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'edges', index, 'source'],
          '蓝图边引用了不存在的源节点',
        ),
      );
    } else if (
      !getV2ComponentSourceHandles(sourceNode, registrationByComponentId).has(edge.sourceHandle)
    ) {
      // V2: source handle 不在 manifest.events 派生的 allowlist 中
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          'INVALID_COMPONENT_EVENT',
          ['blueprint', 'edges', index, 'sourceHandle'],
          '蓝图事件锚点不在组件 manifest.events 声明列表中',
        ),
      );
    }

    if (targetNode === undefined) {
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'edges', index, 'target'],
          '蓝图边引用了不存在的目标节点',
        ),
      );
    } else if (!getScreenSdkTargetHandles(targetNode).has(edge.targetHandle)) {
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_ACTION,
          ['blueprint', 'edges', index, 'targetHandle'],
          '蓝图动作锚点不在 SDK 白名单中',
        ),
      );
    }
  }
}

/**
 * 解析 ScreenDocumentV2（Spec §12.2 两阶段校验 + Requirement 8 + Requirement 14）。
 *
 * 两阶段校验：
 * 1. **Wire 校验**：`ScreenDocumentV2WireSchema` 校验文档容器和组件公共字段。
 *    拒绝 tagName/moduleUrl/script（Requirement 12）。
 * 2. **Registry-aware 校验**（本函数核心）：
 *    - 对 props/staticData/global variable value 执行 JSON boundary 校验
 *    - 按 `component.type` 查询 registry → 缺失返回 `MISSING_COMPONENT_DEFINITION`
 *    - 用 `manifest.propsSchema` 校验 props → 不合法返回 `INVALID_COMPONENT_PROPS`
 *    - 外部组件（source='host'）出现 dataSource/logic/interaction 返回
 *      `UNSUPPORTED_COMPONENT_CAPABILITY`（Requirement 14）
 *    - 蓝图 source handle 必须在 `manifest.events` 派生的 allowlist 中 →
 *      不匹配返回 `INVALID_COMPONENT_EVENT`
 *    - 蓝图 target handle / requestApi / dangling reference 继续使用 V1 静态校验
 *
 * 失败时项目保持不变（Spec §3.4 Fail Closed）：返回 failure result，不修改输入。
 *
 * @param input    待解析的 V2 文档（通常来自 Adapter.loadProject）
 * @param registry 当前实例注册表（提供组件 manifest）
 * @returns 成功返回 ScreenDocumentV2；失败返回 V2 diagnostics
 */
export function parseScreenDocumentV2(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResultV2<ScreenDocumentV2> {
  // Phase 1: Wire 校验（Spec §12.2 第 1 阶段）
  const wireResult = ScreenDocumentV2WireSchema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodErrorV2(wireResult.error),
    };
  }

  const wire = wireResult.data;
  const diagnostics: ScreenSdkDiagnosticV2[] = [];

  for (const [index, variable] of wire.globalVariables.entries()) {
    if (Object.hasOwn(variable, 'value')) {
      appendJsonBoundaryDiagnostics(
        variable.value,
        ['globalVariables', index, 'value'],
        ScreenSdkDiagnosticCode.INVALID_DOCUMENT,
        diagnostics,
      );
    }
  }

  // 构建 componentId → registration 映射，供蓝图 source handle 校验使用
  const registrationByComponentId = new Map<string, ScreenComponentRegistration | undefined>();
  const componentIds = new Set<string>();

  // Phase 2: Registry-aware 组件校验（Spec §12.2 第 2 阶段 + Requirement 8 + 14）
  for (const [index, component] of wire.components.entries()) {
    componentIds.add(component.id);
    appendJsonBoundaryDiagnostics(
      component.props,
      ['components', index, 'props'],
      ScreenSdkDiagnosticCode.INVALID_COMPONENT_PROPS,
      diagnostics,
    );
    if (component.dataSource !== undefined && Object.hasOwn(component.dataSource, 'staticData')) {
      appendJsonBoundaryDiagnostics(
        component.dataSource.staticData,
        ['components', index, 'dataSource', 'staticData'],
        ScreenSdkDiagnosticCode.INVALID_DOCUMENT,
        diagnostics,
      );
    }
    const registration = registry.get(component.type);
    registrationByComponentId.set(component.id, registration);

    if (registration === undefined) {
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          'MISSING_COMPONENT_DEFINITION',
          ['components', index, 'type'],
          `组件类型 "${component.type}" 未在注册表中定义`,
        ),
      );
      continue;
    }

    // 先统一校验 wire props 的 JSON 边界，再校验 manifest.propsSchema。
    const propsDiagnostics: ScreenComponentValidationDiagnostic[] = [];
    validateValueAgainstSchema(
      component.props,
      registration.manifest.propsSchema,
      ['components', index, 'props'],
      propsDiagnostics,
    );
    for (const diagnostic of propsDiagnostics) {
      addUniqueV2Diagnostic(
        diagnostics,
        createV2Diagnostic(
          ScreenSdkDiagnosticCode.INVALID_COMPONENT_PROPS,
          diagnostic.path,
          diagnostic.message,
        ),
      );
    }

    // 外部组件能力校验（Requirement 14: 外部组件不得声明 dataSource/logic/interaction）
    if (registration.source === 'host') {
      if (component.dataSource !== undefined) {
        addUniqueV2Diagnostic(
          diagnostics,
          createV2Diagnostic(
            'UNSUPPORTED_COMPONENT_CAPABILITY',
            ['components', index, 'dataSource'],
            '外部组件不支持 dataSource 配置',
          ),
        );
      }
      if (component.logic !== undefined) {
        addUniqueV2Diagnostic(
          diagnostics,
          createV2Diagnostic(
            'UNSUPPORTED_COMPONENT_CAPABILITY',
            ['components', index, 'logic'],
            '外部组件不支持 logic 配置',
          ),
        );
      }
      if (component.interaction !== undefined) {
        addUniqueV2Diagnostic(
          diagnostics,
          createV2Diagnostic(
            'UNSUPPORTED_COMPONENT_CAPABILITY',
            ['components', index, 'interaction'],
            '外部组件不支持 interaction 配置',
          ),
        );
      }
    }
  }

  // Phase 3: 蓝图语义校验（source handle 使用 registry-derived allowlist）
  if (wire.blueprint !== undefined) {
    validateV2Blueprint(wire.blueprint, registrationByComponentId, componentIds, diagnostics);
  }

  if (diagnostics.length > 0) {
    return {
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics,
    };
  }

  return { success: true, data: wire };
}

// ===== V1 → V2 无损规范化（Spec §12.2 + Requirement 9 + Requirement 13, Task 5.4） =====

/**
 * V1 → V2 migration 状态（Spec §12.3 + Requirement 13）。
 *
 * `migrationPending=true` 表示 V2 Adapter 返回的 V1 文档已被无损规范化为 V2，
 * 但尚未通过 V2 save 持久化。publish 操作在 migrationPending=true 时被阻止
 * （Requirement 13: 保存 V2 成功前阻止发布）。
 *
 * 状态由 SDK session 在 load/save 时维护，不持久化到文档 schema 中。
 */
export interface ScreenProjectMigrationState {
  readonly migrationPending: boolean;
}

/**
 * 判断当前 migration 状态是否允许 publish（Spec §12.3 + Requirement 13）。
 *
 * migrationPending=true 时 publish 被阻止，直到 V2 save 成功后状态重置为 false。
 */
export function canPublishWithMigration(state: ScreenProjectMigrationState): boolean {
  return !state.migrationPending;
}

/**
 * V2 规范化结果（Spec §12.2 + Requirement 13）。
 *
 * 成功时返回 V2 envelope input 与 migration pending 标记；失败时返回 V2 diagnostics。
 * `migrationPending=true` 表示原始输入为 V1，已规范化为 V2 但尚未通过 V2 save 持久化。
 */
export type NormalizeV1ToV2Result =
  | { success: true; envelope: ScreenProjectEnvelopeInputV2; migrationPending: true }
  | {
      success: false;
      code: 'VALIDATION' | 'UNSUPPORTED_DOCUMENT_FEATURE';
      diagnostics: ScreenSdkDiagnosticV2[];
    };

/**
 * 将合法 V1 文档无损规范化为 V2 wire 形状（Spec §12.2 + Requirement 9）。
 *
 * 规范化保持组件 id/type/props/position/style/dataSource/logic/interaction/status/
 * zIndex/parentId、canvas、blueprint、globalVariables 完全一致；仅将 schemaVersion
 * 从 1 提升为 2，并将组件 props 从 strict discriminated union 透传为 JSON record。
 *
 * V1 strict props 必然满足 V2 permissive wire 形状（V2 wire 仅要求 type 为非空字符串、
 * props 为 record）；registry-aware 校验由调用方通过 `parseScreenDocumentV2()` 完成。
 *
 * 调用方必须先通过 `parseScreenDocument()` 校验 V1 文档合法性后再调用本函数。
 */
export function normalizeV1DocumentToV2(document: ScreenDocumentV1): ScreenDocumentV2 {
  return {
    schemaVersion: SCREEN_DOCUMENT_V2_VERSION,
    canvas: document.canvas,
    components: document.components.map((component) => ({
      ...component,
      props: { ...component.props },
    })),
    ...(document.blueprint !== undefined ? { blueprint: document.blueprint } : {}),
    globalVariables: document.globalVariables.map((variable) => ({ ...variable })),
  };
}

/**
 * 将 V1 envelope input 无损规范化为 V2 envelope input（Spec §12.2 + Requirement 9 + 13）。
 *
 * 用于 V2 Adapter 返回 V1 envelope input 时，SDK 内部规范化为 V2 并标记 migration pending。
 *
 * 流程：
 * 1. 校验 V1 envelope input 结构（`ScreenProjectEnvelopeInputSchema`）
 * 2. 解析 V1 document（`parseScreenDocument`）→ 失败时将 V1 diagnostics 映射为 V2 diagnostics
 * 3. 无损规范化为 V2 wire 文档（`normalizeV1DocumentToV2`）
 * 4. 可选 registry-aware V2 parser 校验（若提供 registry）→ 失败时返回 V2 diagnostics
 * 5. 构造 V2 envelope input，标记 `migrationPending=true`
 *
 * V1 schema version 不匹配（如 schemaVersion=2）返回 `UNSUPPORTED_DOCUMENT_FEATURE`，
 * 旧 SDK 对 V2 保持 unsupported 拒绝（Requirement 9: 旧 consumer 拒绝未来版本）。
 */
export function normalizeV1EnvelopeInputToV2(
  input: unknown,
  registry?: ScreenComponentInstanceRegistry,
): NormalizeV1ToV2Result {
  const envelopeResult = ScreenProjectEnvelopeInputSchema.safeParse(input);
  if (!envelopeResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodErrorV2(envelopeResult.error),
    };
  }

  const documentResult = parseScreenDocument(envelopeResult.data.document);
  if (!documentResult.success) {
    return {
      success: false,
      code: documentResult.code,
      diagnostics: documentResult.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        path: [...diagnostic.path],
        severity: diagnostic.severity,
        message: diagnostic.message,
      })),
    };
  }

  const v2Document = normalizeV1DocumentToV2(documentResult.data);

  if (registry !== undefined) {
    const v2ParseResult = parseScreenDocumentV2(v2Document, registry);
    if (!v2ParseResult.success) {
      return {
        success: false,
        code: v2ParseResult.code,
        diagnostics: v2ParseResult.diagnostics,
      };
    }
  }

  const v2Envelope: ScreenProjectEnvelopeInputV2 = {
    id: envelopeResult.data.id,
    name: envelopeResult.data.name,
    description: envelopeResult.data.description,
    status: envelopeResult.data.status,
    revision: envelopeResult.data.revision,
    document: {
      schemaVersion: SCREEN_DOCUMENT_V2_VERSION,
      canvas: v2Document.canvas,
      components: v2Document.components,
      ...(v2Document.blueprint !== undefined ? { blueprint: v2Document.blueprint } : {}),
      globalVariables: v2Document.globalVariables,
    },
  };

  return {
    success: true,
    envelope: v2Envelope,
    migrationPending: true,
  };
}

// ===== V2 Adapter/Transfer/Snapshot parsers（Spec §12.3 + Requirement 8 + Requirement 12, Task 5.5） =====

/**
 * V2 draft parser（Spec §12.3 + Requirement 8）。
 *
 * 两阶段校验：
 * 1. Wire: `ScreenProjectDraftV2Schema` 校验 draft 形状 + V2 文档 wire 形状
 *    - `.strict()` 拒绝 `tagName` / `moduleUrl` / `script` 等字段（Requirement 12）
 * 2. Registry: `parseScreenDocumentV2` 按组件 type 查询 manifest，校验 props/events
 *
 * 用于 save input、snapshot create input 的 draft 校验。
 *
 * @param input    待解析的 V2 draft（通常来自 save/snapshot create input）
 * @param registry 当前实例注册表
 */
export function parseScreenProjectDraftV2(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResultV2<ScreenProjectDraftV2> {
  const wireResult = ScreenProjectDraftV2Schema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodErrorV2(wireResult.error),
    };
  }

  const documentResult = parseScreenDocumentV2(wireResult.data.document, registry);
  if (!documentResult.success) {
    return documentResult;
  }

  const draftResult = ScreenProjectDraftV2Schema.safeParse({
    ...wireResult.data,
    document: documentResult.data,
  });
  return draftResult.success
    ? { success: true, data: draftResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodErrorV2(draftResult.error),
      };
}

/**
 * V2 envelope input parser（Spec §12.3 + Requirement 8）。
 *
 * 与 V1 `parseScreenProjectEnvelopeInput` 行为一致，仅将 document parser 升级为
 * `parseScreenDocumentV2`（registry-aware）。
 *
 * 流程：
 * 1. Wire: `ScreenProjectEnvelopeInputV2Schema` 校验 envelope 形状 + V2 文档 wire 输入
 * 2. 可选 projectId 一致性检查（防止 Adapter 返回错误项目）
 * 3. Registry: `parseScreenDocumentV2` 校验组件 type/props/events/capability
 * 4. Domain: `ScreenProjectEnvelopeV2Schema` 最终 envelope 校验（document 已通过 registry）
 *
 * @param input           待解析的 V2 envelope input（通常来自 V2 Adapter.loadProject /
 *                        saveProject / publishProject / importProject / snapshot.restore）
 * @param registry        当前实例注册表
 * @param expectedProjectId 可选的项目 id 一致性检查
 */
export function parseScreenProjectEnvelopeInputV2(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
  expectedProjectId?: string,
): ScreenContractParseResultV2<ScreenProjectEnvelopeV2> {
  const wireResult = ScreenProjectEnvelopeInputV2Schema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodErrorV2(wireResult.error),
    };
  }
  if (expectedProjectId !== undefined && wireResult.data.id !== expectedProjectId) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: [
        createV2Diagnostic(
          ScreenSdkDiagnosticCode.INVALID_DOCUMENT,
          ['id'],
          'Adapter 返回的项目 id 与当前项目不一致',
        ),
      ],
    };
  }
  const documentResult = parseScreenDocumentV2(wireResult.data.document, registry);
  if (!documentResult.success) return documentResult;
  const envelopeResult = ScreenProjectEnvelopeV2Schema.safeParse({
    ...wireResult.data,
    document: documentResult.data,
  });
  return envelopeResult.success
    ? { success: true, data: envelopeResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodErrorV2(envelopeResult.error),
      };
}

/**
 * V2 transfer parser（Spec §12.3 + Requirement 8）。
 *
 * 校验 V2 transfer wire shape（format='nebula-screen' + formatVersion=2）+ V2 文档
 * 通过 registry-aware parser。
 *
 * Spec §12.3: V1 transfer 不得嵌入 V2 document；V2 transfer 不得嵌入 V1 document。
 * 该约束由 schema-level literal enforcement 实现：
 * - `ScreenProjectTransferV1Schema.document = ScreenDocumentV1Schema`（schemaVersion=1）
 * - `ScreenProjectTransferV2Schema.document = ScreenDocumentV2WireSchema`（schemaVersion=2）
 *
 * V1 transfer 中嵌入 V2 document（schemaVersion=2）会被 V1 schema 的 schemaVersion
 * literal 检查拒绝；V2 transfer 中嵌入 V1 document（schemaVersion=1）会被 V2 wire 的
 * schemaVersion literal 检查拒绝。两条路径都返回 VALIDATION diagnostics。
 *
 * @param input    待解析的 V2 transfer（通常来自 import file parse）
 * @param registry 当前实例注册表
 */
export function parseScreenProjectTransferV2(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResultV2<ScreenProjectTransferV2> {
  const wireResult = ScreenProjectTransferV2Schema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodErrorV2(wireResult.error),
    };
  }
  const documentResult = parseScreenDocumentV2(wireResult.data.document, registry);
  if (!documentResult.success) return documentResult;
  const transferResult = ScreenProjectTransferV2Schema.safeParse({
    ...wireResult.data,
    document: documentResult.data,
  });
  return transferResult.success
    ? { success: true, data: transferResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodErrorV2(transferResult.error),
      };
}

/**
 * V2 export parser（Spec §12.3 + Requirement 8）。
 *
 * 校验 Adapter 返回的结构化 `ScreenProjectExportV2`（fileName + transfer）：
 * - `fileName` 必须为安全 `.json` basename（拒绝路径段 / `..` / 控制字符）
 * - `transfer` 必须为合法 V2 transfer（formatVersion=2 + V2 document）
 * - V2 document 通过 registry-aware parser 校验
 *
 * SDK 校验后自行 `JSON.stringify`、创建 Blob 并触发下载，不信任 Adapter 返回的
 * opaque Blob 内容（Spec §12.3）。
 *
 * @param input    待解析的 V2 export（通常来自 V2 Adapter.exportProject）
 * @param registry 当前实例注册表
 */
export function parseScreenProjectExportV2(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResultV2<ScreenProjectExportV2> {
  const wireResult = ScreenProjectExportV2Schema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodErrorV2(wireResult.error),
    };
  }
  const transferResult = parseScreenProjectTransferV2(wireResult.data.transfer, registry);
  if (!transferResult.success) return transferResult;
  const exportResult = ScreenProjectExportV2Schema.safeParse({
    ...wireResult.data,
    transfer: transferResult.data,
  });
  return exportResult.success
    ? { success: true, data: exportResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodErrorV2(exportResult.error),
      };
}

/**
 * 深拷贝 V2 draft（Spec §12.3）。
 *
 * 与 V1 `cloneScreenProjectDraft` 行为一致，使用 structuredClone 隔离引用。
 */
export function cloneScreenProjectDraftV2(draft: ScreenProjectDraftV2): ScreenProjectDraftV2 {
  return structuredClone(draft);
}

/**
 * 深拷贝 V2 transfer（Spec §12.3）。
 *
 * 与 V1 `cloneScreenProjectTransfer` 行为一致，使用 structuredClone 隔离引用。
 */
export function cloneScreenProjectTransferV2(
  transfer: ScreenProjectTransferV2,
): ScreenProjectTransferV2 {
  return structuredClone(transfer);
}
