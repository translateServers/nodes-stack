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
import {
  createDiagnostic,
  diagnosticsFromZodError,
  ScreenSdkDiagnosticCode,
  type ScreenSdkDiagnostic,
} from './diagnostics.js';

export const SCREEN_DOCUMENT_VERSION = 1 as const;
export const SCREEN_TRANSFER_FORMAT_VERSION = 1 as const;
export const SCREEN_TRANSFER_MAX_BYTES = 10 * 1024 * 1024;

export const SCREEN_SDK_COMPONENT_TYPES = [
  'text',
  'bar-chart',
  'rect',
  'ellipse',
  'image',
  'button',
] as const;

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

export const ScreenDocumentV1Schema = z
  .object({
    schemaVersion: z.literal(SCREEN_DOCUMENT_VERSION),
    canvas: CanvasConfigSchema,
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
    } else if (
      node?.kind === 'trigger' &&
      !['componentClick', 'componentHover', 'pageLoad', 'interval'].includes(String(config?.type))
    ) {
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
    } else if (
      node?.kind === 'action' &&
      !['setVisibility', 'navigate', 'scrollToComponent'].includes(String(config?.type))
    ) {
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
    if (!['component', 'condition', 'delay', 'comment'].includes(String(node?.kind))) {
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
      !['pageLoad', 'interval', 'navigate', 'scrollTo'].includes(globalType)
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
  if (node.kind === 'condition') return new Set(['then', 'else']);
  if (node.kind === 'delay') return new Set(['out']);
  if (node.kind === 'comment') return new Set();
  if (node.globalType === 'pageLoad') return new Set(['evt:pageLoad']);
  if (node.globalType === 'interval') return new Set(['evt:interval']);
  if (node.globalType !== undefined) return new Set();
  return new Set(['evt:click', 'evt:hover']);
}

function allowedTargetHandles(node: EventBlueprintV2['nodes'][number]): ReadonlySet<string> {
  if (node.kind === 'condition' || node.kind === 'delay') return new Set(['in']);
  if (node.kind === 'comment') return new Set();
  if (node.globalType === 'navigate') return new Set(['act:navigate']);
  if (node.globalType === 'scrollTo') return new Set(['act:scrollTo']);
  if (node.globalType !== undefined) return new Set();
  return new Set(['act:show', 'act:hide', 'act:toggleVisibility']);
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
