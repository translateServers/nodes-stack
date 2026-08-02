/**
 * 动态 Screen Document V3（screen-dynamic-sdk 文档契约）。
 *
 * 与正式 V2 文档的关系：
 * - V3 在组件 `dataSource` 上扩展 `host/xj-metric` 数据源（仅描述意图，不含请求细节）
 * - 组件 manifest 升级为 API v2（`dataCapability` 声明）；V2 组件降级按 `none` 处理
 * - 蓝图动作白名单在 V2 基础上增加 `act:refreshData`（仅对 host-metric 组件开放）
 * - 旧 consumer（V2 parser）对 V3 文档 fail-closed；V3 parser 拒绝 V1/V2 文档
 *
 * 第一阶段边界（v3-boundary-freeze）：
 * - 数据源仅允许 `static` 与 `host/xj-metric`；禁止任意 API/SQL/脚本
 * - 全局变量仅允许 `static`
 * - 蓝图禁止 `requestApi` 全局节点
 */

import {
  CanvasConfigSchema,
  ComponentPositionSchema,
  EventBlueprintSchema,
  FieldMappingSchema,
} from '@nebula/shared';
import { z } from 'zod';
import {
  checkJsonValue,
  validateValueAgainstSchema,
  type ScreenComponentValidationDiagnostic,
} from '@nebula/screen-component-sdk';
import {
  SCREEN_COMPONENT_API_VERSION_V2,
  SCREEN_COMPONENT_DATA_CAPABILITIES,
  supportsScreenComponentDataSource,
  type ScreenComponentDataCapability,
} from '@nebula/screen-component-sdk/dynamic';
import type { EventBlueprint } from '@nebula/shared';
import type {
  ScreenComponentInstanceRegistry,
  ScreenComponentRegistration,
} from '../registry/instance-registry.js';
import {
  createDiagnostic,
  diagnosticsFromZodError,
  ScreenSdkDiagnosticCode,
  type ScreenSdkDiagnostic,
} from './diagnostics.js';
import type { ScreenContractParseResult } from './document.js';

export const DYNAMIC_SCREEN_DOCUMENT_VERSION = 3 as const;

export const HOST_METRIC_DATA_SOURCE_TYPE = 'host/xj-metric' as const;

/** 图片 URL 边界（沿用正式文档 schema） */
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

/** 静态数据源（沿用 V2 语义） */
export const DynamicStaticDataSourceSchema = z
  .object({
    type: z.literal('static'),
    staticData: z.unknown(),
    dataPath: z.string().optional(),
    fieldMapping: FieldMappingSchema.optional(),
  })
  .strict();

export type DynamicStaticDataSource = z.infer<typeof DynamicStaticDataSourceSchema>;

/** 指标数据源绑定（语义由宿主 `host/xj-metric` 契约定义） */
export const HostMetricBindingSchema = z
  .object({
    categoryField: z.string().optional(),
    valueFields: z.array(z.string()).optional(),
    labelField: z.string().optional(),
    tableFields: z.array(z.string()).optional(),
  })
  .strict();

export type HostMetricBinding = z.infer<typeof HostMetricBindingSchema>;

/**
 * `host/xj-metric` 数据源。
 *
 * 只描述意图（指标 ID + 绑定字段），SDK/组件不经手 Token、URL 或 SQL；
 * 数据由宿主 adapter 委托后端执行。
 */
export const HostMetricDataSourceSchema = z
  .object({
    type: z.literal(HOST_METRIC_DATA_SOURCE_TYPE),
    metricId: z.number().int().positive(),
    binding: HostMetricBindingSchema.optional(),
  })
  .strict();

export type HostMetricDataSource = z.infer<typeof HostMetricDataSourceSchema>;

/** V3 数据源联合：仅 static 与 host/xj-metric（strict 拒绝 api/sql/script） */
export const DynamicDataSourceSchema = z.discriminatedUnion('type', [
  DynamicStaticDataSourceSchema,
  HostMetricDataSourceSchema,
]);

export type DynamicDataSourceConfig = z.infer<typeof DynamicDataSourceSchema>;

/** V3 组件 wire 形状 */
export const DynamicScreenComponentWireSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    position: ComponentPositionSchema,
    style: z.record(z.string(), z.unknown()),
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
    dataSource: DynamicDataSourceSchema.optional(),
    status: z.enum(['active', 'hidden']).default('active'),
    zIndex: z.number().int(),
    parentId: z.string().nullable().optional(),
  })
  .strict();

export type DynamicScreenComponentWire = z.infer<typeof DynamicScreenComponentWireSchema>;

/** V3 全局变量：仅 static */
export const DynamicGlobalVariableSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.literal('static'),
    value: z.unknown().optional(),
    description: z.string().optional(),
  })
  .strict();

export type DynamicGlobalVariable = z.infer<typeof DynamicGlobalVariableSchema>;

const DynamicCanvasConfigSchema = CanvasConfigSchema.extend({
  backgroundImage: HttpOrDataUrlSchema.optional(),
}).strict();

/** V3 文档 wire schema（两阶段校验第一阶段） */
export const DynamicScreenDocumentV3Schema = z
  .object({
    schemaVersion: z.literal(DYNAMIC_SCREEN_DOCUMENT_VERSION),
    canvas: DynamicCanvasConfigSchema,
    components: z.array(DynamicScreenComponentWireSchema),
    blueprint: EventBlueprintSchema.optional(),
    globalVariables: z.array(DynamicGlobalVariableSchema).default([]),
  })
  .strict();

export type DynamicScreenDocumentV3 = z.infer<typeof DynamicScreenDocumentV3Schema>;

/** V3 文档 wire 输入（envelope input 使用） */
export const DynamicScreenDocumentV3InputSchema = z
  .object({
    schemaVersion: z.literal(DYNAMIC_SCREEN_DOCUMENT_VERSION),
    canvas: z.unknown(),
    components: z.array(z.unknown()),
    blueprint: z.unknown().optional(),
    globalVariables: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type DynamicScreenDocumentV3Input = z.infer<typeof DynamicScreenDocumentV3InputSchema>;

// ===== registry-aware 校验 =====

const SCREEN_COMPONENT_CATEGORIES: ReadonlySet<string> = new Set(
  SCREEN_COMPONENT_DATA_CAPABILITIES,
);

function isScreenComponentDataCapability(value: unknown): value is ScreenComponentDataCapability {
  return typeof value === 'string' && SCREEN_COMPONENT_CATEGORIES.has(value);
}

/**
 * 从 manifest 读取数据能力声明。
 *
 * v2 manifest（apiVersion = nebula.screen-component/v2）显式声明 dataCapability；
 * v1 manifest 按 `none` 处理（组件不消费数据）。
 */
export function getManifestDataCapability(
  manifest: ScreenComponentRegistration['manifest'],
): ScreenComponentDataCapability {
  const manifestLike = manifest as unknown as {
    readonly apiVersion?: string;
    readonly dataCapability?: unknown;
  };
  if (manifestLike.apiVersion === SCREEN_COMPONENT_API_VERSION_V2) {
    const candidate = manifestLike.dataCapability;
    if (isScreenComponentDataCapability(candidate)) return candidate;
  }
  return 'none';
}

const V3_BLUEPRINT_TARGET_HANDLES: ReadonlySet<string> = new Set([
  'act:show',
  'act:hide',
  'act:toggleVisibility',
  'act:navigate',
  'act:scrollTo',
  'act:refreshData',
]);

const V3_BLUEPRINT_GLOBAL_SOURCE_HANDLES: ReadonlySet<string> = new Set([
  'evt:pageLoad',
  'evt:interval',
  'then',
  'else',
  'out',
]);

const V3_BLUEPRINT_ALLOWED_GLOBAL_TYPES: ReadonlySet<string> = new Set([
  'pageLoad',
  'interval',
  'navigate',
  'scrollTo',
]);

function addUniqueDiagnostic(
  diagnostics: ScreenSdkDiagnostic[],
  diagnostic: ScreenSdkDiagnostic,
): void {
  if (
    !diagnostics.some(
      (existing) =>
        existing.code === diagnostic.code &&
        existing.path.length === diagnostic.path.length &&
        existing.path.every((segment, index) => segment === diagnostic.path[index]),
    )
  ) {
    diagnostics.push(diagnostic);
  }
}

function appendJsonBoundaryDiagnostics(
  value: unknown,
  path: ReadonlyArray<string | number>,
  code: ScreenSdkDiagnosticCode,
  diagnostics: ScreenSdkDiagnostic[],
): void {
  const boundaryDiagnostics: ScreenComponentValidationDiagnostic[] = [];
  const ok = checkJsonValue(value, path, boundaryDiagnostics);
  if (!ok) {
    for (const diagnostic of boundaryDiagnostics) {
      addUniqueDiagnostic(diagnostics, createDiagnostic(code, diagnostic.path, diagnostic.message));
    }
  }
}

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
 * 校验 V3 蓝图语义。
 *
 * - source handle 由 manifest.events 派生（registry-derived allowlist）
 * - target handle 白名单 = V2 静态白名单 + `act:refreshData`
 * - `requestApi` 全局节点拒绝（UNSUPPORTED_BLUEPRINT_NODE）
 * - 全局类型仅允许 pageLoad/interval/navigate/scrollTo
 * - dangling component reference 返回 DANGLING_COMPONENT_REFERENCE
 */
function validateDynamicBlueprint(
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
          '动态文档第一阶段不支持网络请求节点',
        ),
      );
    } else if (node.globalType !== undefined) {
      if (!V3_BLUEPRINT_ALLOWED_GLOBAL_TYPES.has(node.globalType)) {
        addUniqueDiagnostic(
          diagnostics,
          createDiagnostic(
            ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_NODE,
            ['blueprint', 'nodes', index, 'globalType'],
            '蓝图全局节点不在动态白名单中',
          ),
        );
      }
    } else if (!componentIds.has(node.componentId)) {
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
    } else if (
      !V3_BLUEPRINT_GLOBAL_SOURCE_HANDLES.has(edge.sourceHandle) &&
      !getComponentSourceHandles(sourceNode, registrationByComponentId).has(edge.sourceHandle)
    ) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          'INVALID_COMPONENT_EVENT',
          ['blueprint', 'edges', index, 'sourceHandle'],
          '蓝图事件锚点不在组件 manifest.events 声明列表中',
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
    } else if (!V3_BLUEPRINT_TARGET_HANDLES.has(edge.targetHandle)) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.UNSUPPORTED_BLUEPRINT_ACTION,
          ['blueprint', 'edges', index, 'targetHandle'],
          '蓝图动作锚点不在动态白名单中',
        ),
      );
    }
  }
}

/**
 * 解析 V3 动态文档。
 *
 * 两阶段校验：
 * 1. Wire 校验（`DynamicScreenDocumentV3Schema`，strict 拒绝未知数据源/字段）
 * 2. Registry-aware 校验：
 *    - JSON boundary（props/staticData/global variable value）
 *    - 组件类型必须存在（MISSING_COMPONENT_DEFINITION）
 *    - props 按 manifest.propsSchema 校验（INVALID_COMPONENT_PROPS）
 *    - 数据能力约束（UNSUPPORTED_COMPONENT_CAPABILITY）：
 *      - `host/xj-metric` 数据源要求 manifest 声明 host-metric
 *      - static 数据源要求 manifest 支持数据能力（static 或 host-metric）
 *      - `none` 能力的组件禁止附加 dataSource
 *    - 蓝图语义校验（见 validateDynamicBlueprint）
 *
 * 失败时返回 failure result，不修改输入（Fail Closed）。
 */
export function parseDynamicScreenDocumentV3(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenContractParseResult<DynamicScreenDocumentV3> {
  const wireResult = DynamicScreenDocumentV3Schema.safeParse(input);
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

  const registrationByComponentId = new Map<string, ScreenComponentRegistration | undefined>();
  const componentIds = new Set<string>();

  for (const [index, component] of wire.components.entries()) {
    componentIds.add(component.id);
    appendJsonBoundaryDiagnostics(
      component.props,
      ['components', index, 'props'],
      ScreenSdkDiagnosticCode.INVALID_COMPONENT_PROPS,
      diagnostics,
    );
    if (
      component.dataSource !== undefined &&
      component.dataSource.type === 'static' &&
      Object.hasOwn(component.dataSource, 'staticData')
    ) {
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
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          'MISSING_COMPONENT_DEFINITION',
          ['components', index, 'type'],
          `组件类型 "${component.type}" 未在注册表中定义`,
        ),
      );
      continue;
    }

    const propsDiagnostics: ScreenComponentValidationDiagnostic[] = [];
    validateValueAgainstSchema(
      component.props,
      registration.manifest.propsSchema,
      ['components', index, 'props'],
      propsDiagnostics,
    );
    for (const diagnostic of propsDiagnostics) {
      addUniqueDiagnostic(
        diagnostics,
        createDiagnostic(
          ScreenSdkDiagnosticCode.INVALID_COMPONENT_PROPS,
          diagnostic.path,
          diagnostic.message,
        ),
      );
    }

    // 数据能力约束
    const capability = getManifestDataCapability(registration.manifest);
    if (component.dataSource !== undefined) {
      if (!supportsScreenComponentDataSource(capability)) {
        addUniqueDiagnostic(
          diagnostics,
          createDiagnostic(
            'UNSUPPORTED_COMPONENT_CAPABILITY',
            ['components', index, 'dataSource'],
            `组件能力 ${capability} 不允许附加数据源`,
          ),
        );
      } else if (
        component.dataSource.type === HOST_METRIC_DATA_SOURCE_TYPE &&
        capability !== 'host-metric'
      ) {
        addUniqueDiagnostic(
          diagnostics,
          createDiagnostic(
            'UNSUPPORTED_COMPONENT_CAPABILITY',
            ['components', index, 'dataSource', 'type'],
            `组件能力 ${capability} 不支持 host/xj-metric 数据源`,
          ),
        );
      }
    }
  }

  if (wire.blueprint !== undefined) {
    validateDynamicBlueprint(wire.blueprint, registrationByComponentId, componentIds, diagnostics);
  }

  if (diagnostics.length > 0) {
    return { success: false, code: 'VALIDATION', diagnostics };
  }
  return { success: true, data: wire };
}

/**
 * 生成 V3 动态文档 JSON Schema（供 XJ 后端与文档校验服务使用）。
 *
 * 与 wire schema 对齐：strict 容器、数据源 oneOf、未知字段拒绝。
 */
export function generateDynamicScreenDocumentJsonSchema(): Record<string, unknown> {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Nebula Dynamic Screen Document V3',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'canvas', 'components'],
    properties: {
      schemaVersion: { const: DYNAMIC_SCREEN_DOCUMENT_VERSION },
      canvas: {
        type: 'object',
        additionalProperties: false,
        properties: {
          width: { type: 'number', minimum: 1 },
          height: { type: 'number', minimum: 1 },
          backgroundColor: { type: 'string' },
          backgroundImage: { type: 'string' },
          scaleMode: { enum: ['fit', 'full', 'width', 'height', 'none'] },
        },
      },
      components: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'name', 'position', 'style', 'type', 'props', 'status', 'zIndex'],
          properties: {
            id: { type: 'string', minLength: 1 },
            name: { type: 'string', minLength: 1 },
            type: { type: 'string', minLength: 1 },
            position: {
              type: 'object',
              additionalProperties: false,
              required: ['x', 'y', 'width', 'height'],
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number', exclusiveMinimum: 0 },
                height: { type: 'number', exclusiveMinimum: 0 },
              },
            },
            style: { type: 'object' },
            props: { type: 'object' },
            status: { enum: ['active', 'hidden'] },
            zIndex: { type: 'integer' },
            parentId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            dataSource: {
              oneOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'staticData'],
                  properties: {
                    type: { const: 'static' },
                    staticData: {},
                    dataPath: { type: 'string' },
                    fieldMapping: { type: 'object' },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'metricId'],
                  properties: {
                    type: { const: HOST_METRIC_DATA_SOURCE_TYPE },
                    metricId: { type: 'integer', minimum: 1 },
                    binding: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        categoryField: { type: 'string' },
                        valueFields: { type: 'array', items: { type: 'string' } },
                        labelField: { type: 'string' },
                        tableFields: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      blueprint: { type: 'object' },
      globalVariables: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'name', 'type'],
          properties: {
            id: { type: 'string', minLength: 1 },
            name: { type: 'string', minLength: 1 },
            type: { const: 'static' },
            value: {},
            description: { type: 'string' },
          },
        },
      },
    },
  };
}
