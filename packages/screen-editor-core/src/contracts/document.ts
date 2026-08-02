import {
  BlueprintInputSchema,
  CanvasConfigSchema,
  ComponentPositionSchema,
  ComponentStatusSchema,
  ComponentStyleSchema,
  EventBlueprintSchema,
  FieldMappingSchema,
  InteractionConfigSchema,
  LogicConfigSchema,
  migrateLegacyBlueprint,
  type EventBlueprint,
  type LegacyEventBlueprint,
} from '@nebula/shared';
import { z } from 'zod';
import { checkJsonValue, validateValueAgainstSchema } from '@nebula/screen-component-sdk';
import type { ScreenComponentValidationDiagnostic } from '@nebula/screen-component-sdk';
import {
  getScreenSdkSourceHandles,
  getScreenSdkTargetHandles,
  isScreenSdkBlueprintNodeKind,
  isScreenSdkGlobalComponentType,
  isLegacyScreenSdkActionType,
  isLegacyScreenSdkTriggerType,
  SCREEN_SDK_COMPONENT_TYPES,
} from '../core/static-capability-profile.js';
import type {
  ScreenComponentInstanceRegistry,
  ScreenComponentRegistration,
} from '../registry/instance-registry.js';
import {
  createDiagnostic,
  diagnosticsFromZodError,
  ScreenSdkDiagnosticCode,
  type LegacyScreenSdkDiagnostic,
  type ScreenSdkDiagnostic,
} from './diagnostics.js';

export const LEGACY_SCREEN_DOCUMENT_VERSION = 1 as const;
export const LEGACY_SCREEN_TRANSFER_FORMAT_VERSION = 1 as const;
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

export const LegacyScreenDocumentSchema = z
  .object({
    schemaVersion: z.literal(LEGACY_SCREEN_DOCUMENT_VERSION),
    canvas: ScreenSdkCanvasConfigSchema,
    components: z.array(ScreenSdkComponentSchema),
    blueprint: EventBlueprintSchema.optional(),
    globalVariables: z.array(StaticGlobalVariableSchema).default([]),
  })
  .strict();

export type LegacyScreenDocument = z.infer<typeof LegacyScreenDocumentSchema>;

export const LegacyScreenDocumentInputSchema = z
  .object({
    schemaVersion: z.number(),
    canvas: z.unknown(),
    components: z.array(z.unknown()),
    blueprint: z.unknown().optional(),
    globalVariables: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type LegacyScreenDocumentInput = z.infer<typeof LegacyScreenDocumentInputSchema>;

export const LegacyScreenProjectDraftSchema = z
  .object({
    name: ProjectNameSchema,
    description: z.string().nullable().optional(),
    document: LegacyScreenDocumentSchema,
  })
  .strict();

export type LegacyScreenProjectDraft = z.infer<typeof LegacyScreenProjectDraftSchema>;

export const ScreenProjectStatusSchema = z.enum(['draft', 'published']);
export type ScreenProjectStatus = z.infer<typeof ScreenProjectStatusSchema>;

export const LegacyScreenProjectEnvelopeSchema = LegacyScreenProjectDraftSchema.extend({
  id: z.string().min(1),
  status: ScreenProjectStatusSchema,
  revision: NonBlankStringSchema,
}).strict();

export type LegacyScreenProjectEnvelope = z.infer<typeof LegacyScreenProjectEnvelopeSchema>;

export const LegacyScreenProjectEnvelopeInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().nullable().optional(),
    status: ScreenProjectStatusSchema,
    revision: NonBlankStringSchema,
    document: LegacyScreenDocumentInputSchema,
  })
  .strict();

export type LegacyScreenProjectEnvelopeInput = z.infer<
  typeof LegacyScreenProjectEnvelopeInputSchema
>;

export const LegacyScreenProjectTransferSchema = z
  .object({
    format: z.literal('nebula-screen'),
    formatVersion: z.literal(LEGACY_SCREEN_TRANSFER_FORMAT_VERSION),
    name: ProjectNameSchema,
    description: z.string().nullable().optional(),
    document: LegacyScreenDocumentSchema,
  })
  .strict();

export type LegacyScreenProjectTransfer = z.infer<typeof LegacyScreenProjectTransferSchema>;

// ===== 正式 Screen Document =====

export const SCREEN_DOCUMENT_VERSION = 2 as const;
export const SCREEN_TRANSFER_FORMAT_VERSION = 2 as const;

/**
 * 正式 wire 组件 schema。
 *
 * 与归档严格组件 schema 的差异：
 * - `type` 接受任意字符串（registry 在运行时按 type 查 manifest 校验）
 * - `props` 为 JSON record（manifest propsSchema 在运行时校验）
 * - 保留 dataSource / logic / interaction 可选字段：内置组件（如 bar-chart）继续使用；
 *   正式 parser 对 `source='host'` 外部组件拒绝这些字段并返回
 *   `UNSUPPORTED_COMPONENT_CAPABILITY`（Requirement 14，Task 5.2 实现）
 *
 * `.strict()` 拒绝 `tagName` / `moduleUrl` / `script` 等字段（Requirement 12：
 * 项目文档不得声明或触发组件脚本加载）。
 */
const ScreenComponentWireSchema = z
  .object({
    ...ScreenSdkComponentBaseShape,
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
  })
  .strict();

export type ScreenComponentWire = z.infer<typeof ScreenComponentWireSchema>;

/**
 * 正式 wire 文档 schema（两阶段校验第一阶段）。
 *
 * 仅校验文档容器、组件公共字段和 JSON 边界；组件特定 schema 由注册表在运行时提供。
 * 与归档严格文档的差异：`schemaVersion=2`，组件使用 permissive wire 形状。
 *
 * `.strict()` 拒绝未知顶层字段（如 `tagName` / `moduleUrl` / `script`）。
 */
export const ScreenDocumentWireSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_DOCUMENT_VERSION),
    canvas: ScreenSdkCanvasConfigSchema,
    components: z.array(ScreenComponentWireSchema),
    blueprint: EventBlueprintSchema.optional(),
    globalVariables: z.array(StaticGlobalVariableSchema).default([]),
  })
  .strict();

/**
 * 正式文档 domain 类型。
 *
 * 结构与 `ScreenDocumentWireSchema` 的推断类型一致：registry 校验在 parser
 * 阶段完成（Task 5.2），通过后的文档实例结构与 wire 形状相同。
 */
export type ScreenDocument = z.infer<typeof ScreenDocumentWireSchema>;

/**
 * 正式文档 wire 输入类型。
 *
 * 与归档输入对应：用于 envelope input 中尚未通过 domain 校验的
 * 文档字段。`schemaVersion` 仍必须是 2，其余字段保持 unknown 以便后续两阶段校验。
 */
export const ScreenDocumentInputSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_DOCUMENT_VERSION),
    canvas: z.unknown(),
    components: z.array(z.unknown()),
    blueprint: z.unknown().optional(),
    globalVariables: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type ScreenDocumentInput = z.infer<typeof ScreenDocumentInputSchema>;

/**
 * SDK 文档使用正式模型；归档文档只能通过迁移函数读取。
 */
export type ScreenSdkDocument = ScreenDocument;

export const ScreenProjectDraftSchema = z
  .object({
    name: ProjectNameSchema,
    description: z.string().nullable().optional(),
    document: ScreenDocumentWireSchema,
  })
  .strict();

export type ScreenProjectDraft = z.infer<typeof ScreenProjectDraftSchema>;

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

/**
 * 正式 transfer schema。
 *
 * `formatVersion=2` 只能包含正式文档。归档 transfer 只能在迁移边界读取。
 */
export const ScreenProjectTransferSchema = z
  .object({
    format: z.literal('nebula-screen'),
    formatVersion: z.literal(SCREEN_TRANSFER_FORMAT_VERSION),
    name: ProjectNameSchema,
    description: z.string().nullable().optional(),
    document: ScreenDocumentWireSchema,
  })
  .strict();

export type ScreenProjectTransfer = z.infer<typeof ScreenProjectTransferSchema>;

/**
 * 正式 export schema。
 *
 * Adapter 返回结构化 `fileName` + `transfer`；SDK 校验后自行 `JSON.stringify`、
 * 创建 Blob 并触发下载，不信任 Adapter 返回的 opaque Blob 内容。
 *
 * fileName 安全规则与导出文件契约一致：safe `.json` basename，
 * 拒绝路径段、`..`、控制字符。
 */
const SAFE_JSON_FILE_NAME_PATTERN = /^[^/\\]{1,255}\.json$/i;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

export const ScreenProjectExportSchema = z
  .object({
    fileName: z
      .string()
      .max(255)
      .regex(SAFE_JSON_FILE_NAME_PATTERN, '导出文件名必须是安全的 .json basename')
      .refine((value) => !value.includes('..'), '导出文件名不能包含 .. 路径段')
      .refine((value) => !containsControlCharacter(value), '导出文件名不能包含控制字符'),
    transfer: ScreenProjectTransferSchema,
  })
  .strict();

export type ScreenProjectExport = z.infer<typeof ScreenProjectExportSchema>;

export type LegacyScreenContractParseResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      code: 'VALIDATION' | 'UNSUPPORTED_DOCUMENT_FEATURE';
      diagnostics: LegacyScreenSdkDiagnostic[];
    };

/**
 * 正式 parser 结果，使用统一诊断协议。
 */
export type ScreenContractParseResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      code: 'VALIDATION' | 'UNSUPPORTED_DOCUMENT_FEATURE';
      diagnostics: ScreenSdkDiagnostic[];
    };

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function addUniqueLegacyDiagnostic(
  diagnostics: ScreenSdkDiagnostic[],
  diagnostic: ScreenSdkDiagnostic,
): void {
  const key = `${diagnostic.code}:${diagnostic.path.join('.')}`;
  if (!diagnostics.some((item) => `${item.code}:${item.path.join('.')}` === key)) {
    diagnostics.push(diagnostic);
  }
}

const addUniqueDiagnostic = addUniqueLegacyDiagnostic;

const COMPONENT_PROP_KEYS: Record<ScreenSdkComponentType, ReadonlySet<string>> = {
  text: new Set(['content']),
  'bar-chart': new Set(['title', 'data']),
  rect: new Set(),
  ellipse: new Set(),
  image: new Set(['src', 'alt']),
  button: new Set(['text']),
};

function scanLegacyComponents(
  document: UnknownRecord,
  diagnostics: ScreenSdkDiagnostic[],
): Set<string> {
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
          '组件类型不在历史 SDK 支持列表中',
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
              '组件包含历史 SDK 未声明的属性',
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
          '历史 SDK 仅支持静态数据源',
        ),
      );
    }
  }
  return componentIds;
}

function scanLegacyGlobalVariables(
  document: UnknownRecord,
  diagnostics: ScreenSdkDiagnostic[],
): void {
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
          '历史 SDK 仅支持静态全局变量',
        ),
      );
    }
  }
}

function scanLegacyBlueprint(
  blueprint: UnknownRecord,
  diagnostics: ScreenSdkDiagnostic[],
): boolean {
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
          '蓝图节点类型不在历史 SDK 白名单中',
        ),
      );
    } else if (node?.kind === 'trigger' && !isLegacyScreenSdkTriggerType(config?.type)) {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_EVENT,
          ['blueprint', 'nodes', index, 'config', 'type'],
          '蓝图事件不在历史 SDK 白名单中',
        ),
      );
    } else if (node?.kind === 'action' && config?.type === 'requestApi') {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          ['blueprint', 'nodes', index, 'config', 'type'],
          '历史 SDK 不支持网络请求节点',
        ),
      );
    } else if (node?.kind === 'action' && !isLegacyScreenSdkActionType(config?.type)) {
      supported = false;
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_ACTION,
          ['blueprint', 'nodes', index, 'config', 'type'],
          '蓝图动作不在历史 SDK 白名单中',
        ),
      );
    }
  }
  return supported;
}

function scanRawFormalBlueprint(
  blueprint: UnknownRecord,
  diagnostics: ScreenSdkDiagnostic[],
): boolean {
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
          '蓝图节点类型不在历史 SDK 白名单中',
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
          '全局蓝图节点不在历史 SDK 白名单中',
        ),
      );
    }
  }
  return supported;
}

function allowedSourceHandles(node: EventBlueprint['nodes'][number]): ReadonlySet<string> {
  return getScreenSdkSourceHandles(node);
}

function allowedTargetHandles(node: EventBlueprint['nodes'][number]): ReadonlySet<string> {
  return getScreenSdkTargetHandles(node);
}

function scanFormalBlueprint(
  blueprint: EventBlueprint,
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
          '静态 SDK 不支持网络请求节点',
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
          '蓝图事件锚点不在静态 SDK 白名单中',
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
          '蓝图动作锚点不在静态 SDK 白名单中',
        ),
      );
    }
  }
}

function getMigrationWarningPath(
  blueprint: LegacyEventBlueprint,
  sourceId: string,
): ReadonlyArray<string | number> {
  const edgeIndex = blueprint.edges.findIndex((edge) => edge.id === sourceId);
  if (edgeIndex >= 0) return ['blueprint', 'edges', edgeIndex];
  const nodeIndex = blueprint.nodes.findIndex((node) => node.id === sourceId);
  return nodeIndex >= 0 ? ['blueprint', 'nodes', nodeIndex] : ['blueprint'];
}

function migrateLegacyBlueprintForSdk(
  blueprint: LegacyEventBlueprint,
): ScreenContractParseResult<EventBlueprint> {
  const migration = migrateLegacyBlueprint(blueprint);
  if (migration.warnings.length > 0) {
    return {
      success: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: migration.warnings.map((warning) =>
        createDiagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          getMigrationWarningPath(blueprint, warning.sourceId),
          '历史蓝图包含无法无损迁移的节点或边',
        ),
      ),
    };
  }

  return { success: true, data: migration.blueprint };
}

export function validateScreenSdkCapabilities(input: unknown): ScreenSdkDiagnostic[] {
  const diagnostics: ScreenSdkDiagnostic[] = [];
  const document = asRecord(input);
  if (document === undefined) return diagnostics;

  const componentIds = scanLegacyComponents(document, diagnostics);
  scanLegacyGlobalVariables(document, diagnostics);
  const rawBlueprint = asRecord(document.blueprint);
  if (rawBlueprint === undefined) return diagnostics;

  if (rawBlueprint.version === 1) {
    const supported = scanLegacyBlueprint(rawBlueprint, diagnostics);
    if (!supported) return diagnostics;
    const parsed = BlueprintInputSchema.safeParse(rawBlueprint);
    if (parsed.success && parsed.data.version === 1) {
      const migration = migrateLegacyBlueprintForSdk(parsed.data);
      if (!migration.success) {
        for (const diagnostic of migration.diagnostics) {
          addUniqueDiagnostic(diagnostics, diagnostic);
        }
      } else {
        scanFormalBlueprint(migration.data, componentIds, diagnostics);
      }
    }
  } else if (rawBlueprint.version === 2) {
    scanRawFormalBlueprint(rawBlueprint, diagnostics);
    const parsed = EventBlueprintSchema.safeParse(rawBlueprint);
    if (parsed.success) scanFormalBlueprint(parsed.data, componentIds, diagnostics);
  } else {
    addUniqueDiagnostic(
      diagnostics,
      createDiagnostic(
        ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
        ['blueprint', 'version'],
        '蓝图版本不受当前 SDK 支持',
      ),
    );
  }
  return diagnostics;
}

function normalizeBlueprint(input: unknown): ScreenContractParseResult<EventBlueprint | undefined> {
  if (input === undefined) return { success: true, data: undefined };
  const parsed = BlueprintInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(parsed.error, ['blueprint']),
    };
  }
  if (parsed.data.version === 1) return migrateLegacyBlueprintForSdk(parsed.data);
  const blueprint = parsed.data;
  const normalized = EventBlueprintSchema.safeParse(blueprint);
  return normalized.success
    ? { success: true, data: normalized.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodError(normalized.error, ['blueprint']),
      };
}

export function parseLegacyScreenDocument(
  input: unknown,
): ScreenContractParseResult<LegacyScreenDocument> {
  const wireResult = LegacyScreenDocumentInputSchema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(wireResult.error),
    };
  }
  if (wireResult.data.schemaVersion !== LEGACY_SCREEN_DOCUMENT_VERSION) {
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
  const domainResult = LegacyScreenDocumentSchema.safeParse({
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

export function parseLegacyScreenProjectEnvelopeInput(
  input: unknown,
  expectedProjectId?: string,
): ScreenContractParseResult<LegacyScreenProjectEnvelope> {
  const wireResult = LegacyScreenProjectEnvelopeInputSchema.safeParse(input);
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
  const documentResult = parseLegacyScreenDocument(wireResult.data.document);
  if (!documentResult.success) return documentResult;
  const envelopeResult = LegacyScreenProjectEnvelopeSchema.safeParse({
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

export function cloneLegacyScreenProjectDraft(
  draft: LegacyScreenProjectDraft,
): LegacyScreenProjectDraft {
  return structuredClone(draft);
}

export function cloneLegacyScreenProjectTransfer(
  transfer: LegacyScreenProjectTransfer,
): LegacyScreenProjectTransfer {
  return structuredClone(transfer);
}

// ===== 正式 Document Parser =====

function addUniqueFormalDiagnostic(
  diagnostics: ScreenSdkDiagnostic[],
  diagnostic: ScreenSdkDiagnostic,
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
  diagnostics: ScreenSdkDiagnostic[],
): void {
  const validationDiagnostics: ScreenComponentValidationDiagnostic[] = [];
  if (checkJsonValue(value, path, validationDiagnostics)) return;

  for (const diagnostic of validationDiagnostics) {
    addUniqueFormalDiagnostic(
      diagnostics,
      createDiagnostic(code, diagnostic.path, diagnostic.message),
    );
  }
}

/**
 * 获取正式蓝图组件节点的允许 source handle 集合（registry-derived allowlist）。
 *
 * 与归档静态 allowlist 的差异：组件节点（kind='component',
 * globalType=undefined）的 source handle 不再使用静态 `evt:click`/`evt:hover`
 * 白名单，而是从组件 manifest.events 派生 `evt:${event.id}`。
 *
 * 全局节点（pageLoad/interval）、condition/delay/comment 使用固定锚点。
 * 若组件未在 registry 中注册（已报告 MISSING_COMPONENT_DEFINITION），返回空集
 * 以跳过 sourceHandle 校验，避免产生重复的噪声诊断。
 */
function getComponentSourceHandles(
  node: EventBlueprint['nodes'][number],
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
 * 校验正式蓝图的语义完整性。
 *
 * source handle 由当前组件注册表中的事件声明派生。
 * - source handle 使用 registry-derived allowlist（`evt:${event.id}` from manifest.events）
 *   替代静态 `evt:click`/`evt:hover` 白名单；未声明的事件返回 INVALID_COMPONENT_EVENT
 * - target handle 继续使用静态白名单（act:show/hide/toggleVisibility/navigate/scrollTo）
 * - requestApi 全局节点继续拒绝（UNSUPPORTED_BLUEPRINT_NODE）
 * - dangling component reference 继续返回 DANGLING_COMPONENT_REFERENCE
 */
function validateBlueprint(
  blueprint: EventBlueprint,
  registrationByComponentId: ReadonlyMap<string, ScreenComponentRegistration | undefined>,
  componentIds: ReadonlySet<string>,
  diagnostics: ScreenSdkDiagnostic[],
): void {
  const nodeMap = new Map(blueprint.nodes.map((node) => [node.id, node]));

  for (const [index, node] of blueprint.nodes.entries()) {
    if (node.kind !== 'component') {
      if (node.kind === 'condition') {
        const componentId = node.config.expression.source.componentId;
        if (!componentIds.has(componentId)) {
          addUniqueFormalDiagnostic(
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
      addUniqueFormalDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
          ['blueprint', 'nodes', index, 'globalType'],
          '静态 SDK 不支持网络请求节点',
        ),
      );
    } else if (node.globalType === undefined && !componentIds.has(node.componentId)) {
      addUniqueFormalDiagnostic(
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
      addUniqueFormalDiagnostic(
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
      addUniqueFormalDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'edges', index, 'source'],
          '蓝图边引用了不存在的源节点',
        ),
      );
    } else if (
      !getComponentSourceHandles(sourceNode, registrationByComponentId).has(edge.sourceHandle)
    ) {
      // source handle 不在 manifest.events 派生的 allowlist 中
      addUniqueFormalDiagnostic(
        diagnostics,
        createDiagnostic(
          'INVALID_COMPONENT_EVENT',
          ['blueprint', 'edges', index, 'sourceHandle'],
          '蓝图事件锚点不在组件 manifest.events 声明列表中',
        ),
      );
    }

    if (targetNode === undefined) {
      addUniqueFormalDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.DANGLING_COMPONENT_REFERENCE,
          ['blueprint', 'edges', index, 'target'],
          '蓝图边引用了不存在的目标节点',
        ),
      );
    } else if (!getScreenSdkTargetHandles(targetNode).has(edge.targetHandle)) {
      addUniqueFormalDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_ACTION,
          ['blueprint', 'edges', index, 'targetHandle'],
          '蓝图动作锚点不在 SDK 白名单中',
        ),
      );
    }
  }
}

/**
 * 解析正式 ScreenDocument。
 *
 * 两阶段校验：
 * 1. **Wire 校验**：`ScreenDocumentWireSchema` 校验文档容器和组件公共字段。
 *    拒绝 tagName/moduleUrl/script（Requirement 12）。
 * 2. **Registry-aware 校验**（本函数核心）：
 *    - 对 props/staticData/global variable value 执行 JSON boundary 校验
 *    - 按 `component.type` 查询 registry → 缺失返回 `MISSING_COMPONENT_DEFINITION`
 *    - 用 `manifest.propsSchema` 校验 props → 不合法返回 `INVALID_COMPONENT_PROPS`
 *    - 外部组件（source='host'）出现 dataSource/logic/interaction 返回
 *      `UNSUPPORTED_COMPONENT_CAPABILITY`（Requirement 14）
 *    - 蓝图 source handle 必须在 `manifest.events` 派生的 allowlist 中 →
 *      不匹配返回 `INVALID_COMPONENT_EVENT`
 *    - 蓝图 target handle / requestApi / dangling reference 继续使用静态校验
 *
 * 失败时项目保持不变（Spec §3.4 Fail Closed）：返回 failure result，不修改输入。
 *
 * @param input    待解析的正式文档（通常来自 Adapter.loadProject）
 * @param registry 当前实例注册表（提供组件 manifest）
 * @returns 成功返回 ScreenDocument；失败返回统一 diagnostics
 */
export function parseScreenDocument(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResult<ScreenDocument> {
  const wireResult = ScreenDocumentWireSchema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(wireResult.error),
    };
  }

  const wire = wireResult.data;
  const diagnostics: ScreenSdkDiagnostic[] = [];

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
      addUniqueFormalDiagnostic(
        diagnostics,
        createDiagnostic(
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
      addUniqueFormalDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.INVALID_COMPONENT_PROPS,
          diagnostic.path,
          diagnostic.message,
        ),
      );
    }

    // 外部组件能力校验（Requirement 14: 外部组件不得声明 dataSource/logic/interaction）
    if (registration.source === 'host') {
      if (component.dataSource !== undefined) {
        addUniqueFormalDiagnostic(
          diagnostics,
          createDiagnostic(
            'UNSUPPORTED_COMPONENT_CAPABILITY',
            ['components', index, 'dataSource'],
            '外部组件不支持 dataSource 配置',
          ),
        );
      }
      if (component.logic !== undefined) {
        addUniqueFormalDiagnostic(
          diagnostics,
          createDiagnostic(
            'UNSUPPORTED_COMPONENT_CAPABILITY',
            ['components', index, 'logic'],
            '外部组件不支持 logic 配置',
          ),
        );
      }
      if (component.interaction !== undefined) {
        addUniqueFormalDiagnostic(
          diagnostics,
          createDiagnostic(
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
    validateBlueprint(wire.blueprint, registrationByComponentId, componentIds, diagnostics);
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

// ===== 归档文档迁移 =====

/**
 * 历史文档迁移状态。
 *
 * `migrationPending=true` 表示历史文档已被无损规范化，但尚未通过正式保存路径持久化。
 * publish 操作在 migrationPending=true 时被阻止。
 *
 * 状态由 SDK session 在 load/save 时维护，不持久化到文档 schema 中。
 */
export interface ScreenProjectMigrationState {
  readonly migrationPending: boolean;
}

/**
 * 判断当前 migration 状态是否允许 publish（Spec §12.3 + Requirement 13）。
 *
 * migrationPending=true 时 publish 被阻止，直到保存成功后状态重置为 false。
 */
export function canPublishWithMigration(state: ScreenProjectMigrationState): boolean {
  return !state.migrationPending;
}

/**
 * 历史文档规范化结果。
 */
export type LegacyScreenDocumentMigrationResult =
  | { success: true; envelope: ScreenProjectEnvelopeInput; migrationPending: true }
  | {
      success: false;
      code: 'VALIDATION' | 'UNSUPPORTED_DOCUMENT_FEATURE';
      diagnostics: ScreenSdkDiagnostic[];
    };

/**
 * 将合法历史文档无损规范化为正式 wire 形状。
 *
 * 规范化保持组件 id/type/props/position/style/dataSource/logic/interaction/status/
 * zIndex/parentId、canvas、blueprint、globalVariables 完全一致；仅将 schemaVersion
 * 从 1 提升为 2，并将组件 props 从 strict discriminated union 透传为 JSON record。
 *
 * 历史 strict props 必然满足正式 permissive wire 形状（仅要求 type 为非空字符串、
 * props 为 record）；registry-aware 校验由调用方通过 `parseScreenDocument()` 完成。
 *
 * 调用方必须先通过 `parseLegacyScreenDocument()` 校验历史文档合法性后再调用本函数。
 */
export function migrateLegacyScreenDocument(document: LegacyScreenDocument): ScreenDocument {
  return {
    schemaVersion: SCREEN_DOCUMENT_VERSION,
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
 * 将历史 envelope input 无损规范化为正式 envelope input。
 *
 * 用于读取旧 Adapter/导入数据时，SDK 内部规范化并标记 migration pending。
 *
 * 流程：
 * 1. 校验历史 envelope input
 * 2. 解析历史 document，并映射诊断
 * 3. 无损规范化为正式 wire 文档
 * 4. 可选使用 registry 做组件校验
 * 5. 构造正式 envelope input，标记 `migrationPending=true`
 */
export function migrateLegacyScreenProjectEnvelopeInput(
  input: unknown,
  registry?: ScreenComponentInstanceRegistry,
): LegacyScreenDocumentMigrationResult {
  const envelopeResult = LegacyScreenProjectEnvelopeInputSchema.safeParse(input);
  if (!envelopeResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(envelopeResult.error),
    };
  }

  const documentResult = parseLegacyScreenDocument(envelopeResult.data.document);
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

  const document = migrateLegacyScreenDocument(documentResult.data);

  if (registry !== undefined) {
    const parseResult = parseScreenDocument(document, registry);
    if (!parseResult.success) {
      return {
        success: false,
        code: parseResult.code,
        diagnostics: parseResult.diagnostics,
      };
    }
  }

  const envelope: ScreenProjectEnvelopeInput = {
    id: envelopeResult.data.id,
    name: envelopeResult.data.name,
    description: envelopeResult.data.description,
    status: envelopeResult.data.status,
    revision: envelopeResult.data.revision,
    document: {
      schemaVersion: SCREEN_DOCUMENT_VERSION,
      canvas: document.canvas,
      components: document.components,
      ...(document.blueprint !== undefined ? { blueprint: document.blueprint } : {}),
      globalVariables: document.globalVariables,
    },
  };

  return {
    success: true,
    envelope,
    migrationPending: true,
  };
}

// ===== 正式 Adapter / Transfer / Snapshot parsers =====

/**
 * 正式 draft parser。
 *
 * 两阶段校验：
 * 1. Wire: `ScreenProjectDraftSchema` 校验 draft 与文档 wire 形状
 *    - `.strict()` 拒绝 `tagName` / `moduleUrl` / `script` 等字段（Requirement 12）
 * 2. Registry: `parseScreenDocument` 按组件 type 查询 manifest，校验 props/events
 *
 * 用于 save input、snapshot create input 的 draft 校验。
 *
 * @param input    待解析的 draft（通常来自 save/snapshot create input）
 * @param registry 当前实例注册表
 */
export function parseScreenProjectDraft(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResult<ScreenProjectDraft> {
  const wireResult = ScreenProjectDraftSchema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(wireResult.error),
    };
  }

  const documentResult = parseScreenDocument(wireResult.data.document, registry);
  if (!documentResult.success) {
    return documentResult;
  }

  const draftResult = ScreenProjectDraftSchema.safeParse({
    ...wireResult.data,
    document: documentResult.data,
  });
  return draftResult.success
    ? { success: true, data: draftResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodError(draftResult.error),
      };
}

/**
 * 正式 envelope input parser。
 *
 * 流程：
 * 1. Wire: `ScreenProjectEnvelopeInputSchema` 校验 envelope 形状与文档 wire 输入
 * 2. 可选 projectId 一致性检查（防止 Adapter 返回错误项目）
 * 3. Registry: `parseScreenDocument` 校验组件 type/props/events/capability
 * 4. Domain: `ScreenProjectEnvelopeSchema` 最终 envelope 校验（document 已通过 registry）
 *
 * @param input           待解析的 envelope input（通常来自 adapter load/save/publish/import/snapshot）
 * @param registry        当前实例注册表
 * @param expectedProjectId 可选的项目 id 一致性检查
 */
export function parseScreenProjectEnvelopeInput(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
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
  const documentResult = parseScreenDocument(wireResult.data.document, registry);
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

/**
 * 正式 transfer parser。
 *
 * 校验 transfer wire shape（format='nebula-screen' + formatVersion=2）和正式文档，
 * 再执行 registry-aware parser。
 *
 * @param input    待解析的 transfer（通常来自 import file parse）
 * @param registry 当前实例注册表
 */
export function parseScreenProjectTransfer(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResult<ScreenProjectTransfer> {
  const wireResult = ScreenProjectTransferSchema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(wireResult.error),
    };
  }
  const documentResult = parseScreenDocument(wireResult.data.document, registry);
  if (!documentResult.success) return documentResult;
  const transferResult = ScreenProjectTransferSchema.safeParse({
    ...wireResult.data,
    document: documentResult.data,
  });
  return transferResult.success
    ? { success: true, data: transferResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodError(transferResult.error),
      };
}

/**
 * 正式 export parser。
 *
 * 校验 Adapter 返回的结构化 `ScreenProjectExport`（fileName + transfer）：
 * - `fileName` 必须为安全 `.json` basename（拒绝路径段 / `..` / 控制字符）
 * - `transfer` 必须为合法正式 transfer（formatVersion=2）
 * - document 通过 registry-aware parser 校验
 *
 * SDK 校验后自行 `JSON.stringify`、创建 Blob 并触发下载，不信任 Adapter 返回的
 * opaque Blob 内容（Spec §12.3）。
 *
 * @param input    待解析的 export（通常来自 Adapter.exportProject）
 * @param registry 当前实例注册表
 */
export function parseScreenProjectExport(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResult<ScreenProjectExport> {
  const wireResult = ScreenProjectExportSchema.safeParse(input);
  if (!wireResult.success) {
    return {
      success: false,
      code: 'VALIDATION',
      diagnostics: diagnosticsFromZodError(wireResult.error),
    };
  }
  const transferResult = parseScreenProjectTransfer(wireResult.data.transfer, registry);
  if (!transferResult.success) return transferResult;
  const exportResult = ScreenProjectExportSchema.safeParse({
    ...wireResult.data,
    transfer: transferResult.data,
  });
  return exportResult.success
    ? { success: true, data: exportResult.data }
    : {
        success: false,
        code: 'VALIDATION',
        diagnostics: diagnosticsFromZodError(exportResult.error),
      };
}

/**
 * 深拷贝正式 draft。
 *
 * 使用 structuredClone 隔离引用。
 */
export function cloneScreenProjectDraft(draft: ScreenProjectDraft): ScreenProjectDraft {
  return structuredClone(draft);
}

/**
 * 深拷贝正式 transfer。
 *
 * 使用 structuredClone 隔离引用。
 */
export function cloneScreenProjectTransfer(transfer: ScreenProjectTransfer): ScreenProjectTransfer {
  return structuredClone(transfer);
}
