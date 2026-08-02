import {
  ApiDataSourceConfigSchema,
  ComponentPositionSchema,
  ComponentStatusSchema,
  ComponentStyleSchema,
  DataSourceConfigSchema,
  FieldMappingSchema,
  InteractionConfigSchema,
  LogicConfigSchema,
  ParamBindingSchema,
  RefreshStrategySchema,
  ScreenComponentSchema,
  type ScreenComponent,
} from '@nebula/shared';
import {
  checkJsonValue,
  validateValueAgainstSchema,
  type ScreenComponentJsonValue,
  type ScreenComponentValidationDiagnostic,
} from '@nebula/screen-component-sdk';
import { z } from 'zod';
import type { ScreenEditorCapabilityProfile } from '../runtime-profile.js';
import type {
  ScreenComponentInstanceRegistry,
  ScreenComponentRegistration,
} from '../registry/instance-registry.js';

export const EDITABLE_COMPONENT_CONFIG_KEYS = [
  'name',
  'position',
  'style',
  'props',
  'dataSource',
  'logic',
  'interaction',
  'status',
  'zIndex',
] as const;

export type EditableScreenComponentConfig = Pick<
  ScreenComponent,
  (typeof EDITABLE_COMPONENT_CONFIG_KEYS)[number]
>;

export type ProtectedScreenComponentIdentity = Pick<ScreenComponent, 'id' | 'type' | 'parentId'>;

export interface ReplaceComponentConfigCommand {
  readonly baseline: EditableScreenComponentConfig;
  readonly componentId: string;
  readonly next: EditableScreenComponentConfig;
}

export type ReplaceComponentConfigResult =
  | 'conflict'
  | 'missing'
  | 'readonly'
  | 'unchanged'
  | 'updated';

export interface ComponentJsonConfigDiagnostic {
  readonly message: string;
  readonly path: ReadonlyArray<string | number>;
  readonly severity: 'error' | 'info' | 'warning';
}

export interface ComponentJsonConfigValidationOptions {
  readonly capabilityProfile: ScreenEditorCapabilityProfile;
  readonly identity: ProtectedScreenComponentIdentity;
  readonly registry: ScreenComponentInstanceRegistry;
}

export type ComponentJsonConfigValidationResult =
  | {
      readonly config: EditableScreenComponentConfig;
      readonly diagnostics: readonly [];
      readonly success: true;
    }
  | {
      readonly diagnostics: readonly ComponentJsonConfigDiagnostic[];
      readonly success: false;
    };

export interface ComponentJsonSchemaOptions {
  readonly capabilityProfile: ScreenEditorCapabilityProfile;
  readonly registration: ScreenComponentRegistration;
}

export type ComponentJsonSchema = Readonly<Record<string, unknown>>;

const StrictFieldMappingSchema = FieldMappingSchema.strict();
const StrictLogicConfigSchema = LogicConfigSchema.strict();
const StrictInteractionConfigSchema = InteractionConfigSchema.strict();
const StrictComponentPositionSchema = ComponentPositionSchema.strict();
const StrictComponentStatusSchema = ComponentStatusSchema.strict();
const StrictComponentStyleSchema = ComponentStyleSchema.strict();
const StrictApiDataSourceConfigSchema = ApiDataSourceConfigSchema.strict();
const StrictParamBindingSchema = ParamBindingSchema.strict();
const StrictRefreshStrategySchema = RefreshStrategySchema.strict();

const StrictDataSourceCommonShape = {
  dataPath: z.string().optional(),
  fieldMapping: StrictFieldMappingSchema.optional(),
};

const StrictStaticDataSourceConfigSchema = z
  .object({
    ...StrictDataSourceCommonShape,
    apiConfig: StrictApiDataSourceConfigSchema.optional(),
    staticData: z.unknown(),
    type: z.literal('static'),
  })
  .strict();

const StrictApiDataSourceSchema = z
  .object({
    ...StrictDataSourceCommonShape,
    apiConfig: StrictApiDataSourceConfigSchema,
    staticData: z.unknown().optional(),
    type: z.literal('api'),
  })
  .strict();

const StrictDatasetDataSourceSchema = z
  .object({
    ...StrictDataSourceCommonShape,
    apiConfig: StrictApiDataSourceConfigSchema.optional(),
    datasetId: z.string().min(1),
    overrideFieldMapping: StrictFieldMappingSchema.optional(),
    overrideLogic: StrictLogicConfigSchema.optional(),
    overrideRefresh: StrictRefreshStrategySchema.optional(),
    paramBindings: z.record(z.string(), StrictParamBindingSchema).optional(),
    staticData: z.unknown().optional(),
    type: z.literal('dataset'),
  })
  .strict();

const StrictDynamicDataSourceConfigSchema = z.discriminatedUnion('type', [
  StrictStaticDataSourceConfigSchema,
  StrictApiDataSourceSchema,
  StrictDatasetDataSourceSchema,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDiagnosticPath(path: ReadonlyArray<PropertyKey>): Array<string | number> {
  return path.filter((segment): segment is string | number => {
    return typeof segment === 'string' || typeof segment === 'number';
  });
}

function toDiagnosticsFromZod(error: z.ZodError): ComponentJsonConfigDiagnostic[] {
  return error.issues.map((issue) => ({
    message: issue.message,
    path: toDiagnosticPath(issue.path),
    severity: 'error',
  }));
}

function toDiagnosticsFromComponentValidation(
  diagnostics: readonly ScreenComponentValidationDiagnostic[],
): ComponentJsonConfigDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    message: diagnostic.message,
    path: diagnostic.path,
    severity: 'error',
  }));
}

function appendUniqueDiagnostics(
  target: ComponentJsonConfigDiagnostic[],
  diagnostics: readonly ComponentJsonConfigDiagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    const exists = target.some(
      (candidate) =>
        candidate.severity === diagnostic.severity &&
        candidate.message === diagnostic.message &&
        candidate.path.join('.') === diagnostic.path.join('.'),
    );
    if (!exists) target.push(diagnostic);
  }
}

function createEditableComponentConfigSchema(
  options: ComponentJsonSchemaOptions,
): z.ZodObject<z.ZodRawShape> {
  const supportsComponentDataConfig = options.registration.source === 'built-in';
  const dataSourceSchema =
    options.capabilityProfile === 'static'
      ? StrictStaticDataSourceConfigSchema
      : StrictDynamicDataSourceConfigSchema;
  const baseShape = {
    name: z.string().min(1).describe('组件名称'),
    position: StrictComponentPositionSchema.describe('位置与尺寸'),
    props: z.record(z.string(), z.unknown()).describe('组件专属配置'),
    status: StrictComponentStatusSchema.describe('组件状态'),
    style: StrictComponentStyleSchema.describe('基础样式'),
    zIndex: z.number().int().describe('层级'),
  };
  const shape = supportsComponentDataConfig
    ? {
        ...baseShape,
        dataSource: dataSourceSchema.optional().describe('数据源配置'),
        interaction: StrictInteractionConfigSchema.optional().describe('交互配置'),
        logic: StrictLogicConfigSchema.optional().describe('数据逻辑配置'),
      }
    : baseShape;

  return z.object(shape).strict();
}

function cloneSchema(value: unknown): Record<string, unknown> {
  const cloned = structuredClone(value);
  if (!isRecord(cloned)) {
    throw new Error('组件 JSON Schema 必须是 object');
  }
  return cloned;
}

function applyDefaultProps(
  schema: Record<string, unknown>,
  defaultValue: ScreenComponentJsonValue | undefined,
): Record<string, unknown> {
  const result = cloneSchema(schema);
  if (defaultValue !== undefined && !Object.hasOwn(result, 'default')) {
    result['default'] = structuredClone(defaultValue);
  }

  const properties = result['properties'];
  if (!isRecord(properties) || !isRecord(defaultValue)) return result;

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!isRecord(propertySchema)) continue;
    const propertyDefault = defaultValue[key];
    properties[key] = applyDefaultProps(
      propertySchema,
      propertyDefault === undefined ? undefined : propertyDefault,
    );
  }
  return result;
}

function getProperties(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema['properties'];
  if (!isRecord(properties)) {
    throw new Error('组件 JSON Schema 缺少 properties');
  }
  return properties;
}

function getRegistration(
  registry: ScreenComponentInstanceRegistry,
  type: string,
): ScreenComponentRegistration | undefined {
  return registry.get(type);
}

function getEditableConfigFromComponent(component: ScreenComponent): EditableScreenComponentConfig {
  return {
    name: component.name,
    position: structuredClone(component.position),
    props: structuredClone(component.props),
    status: structuredClone(component.status),
    style: structuredClone(component.style),
    zIndex: component.zIndex,
    ...(component.dataSource === undefined
      ? {}
      : { dataSource: structuredClone(component.dataSource) }),
    ...(component.logic === undefined ? {} : { logic: structuredClone(component.logic) }),
    ...(component.interaction === undefined
      ? {}
      : { interaction: structuredClone(component.interaction) }),
  };
}

function parseConfigWithSchema(
  input: unknown,
  options: ComponentJsonSchemaOptions,
):
  | { readonly config: EditableScreenComponentConfig; readonly success: true }
  | { readonly diagnostics: readonly ComponentJsonConfigDiagnostic[]; readonly success: false } {
  const result = createEditableComponentConfigSchema(options).safeParse(input);
  if (!result.success) {
    return { diagnostics: toDiagnosticsFromZod(result.error), success: false };
  }

  const configResult = z
    .object({
      dataSource: DataSourceConfigSchema.optional(),
      interaction: InteractionConfigSchema.optional(),
      logic: LogicConfigSchema.optional(),
      name: z.string().min(1),
      position: ComponentPositionSchema,
      props: z.record(z.string(), z.unknown()),
      status: ComponentStatusSchema,
      style: ComponentStyleSchema,
      zIndex: z.number().int(),
    })
    .strict()
    .safeParse(result.data);

  if (!configResult.success) {
    return { diagnostics: toDiagnosticsFromZod(configResult.error), success: false };
  }

  return { config: configResult.data, success: true };
}

export function extractEditableComponentConfig(
  component: ScreenComponent,
): EditableScreenComponentConfig {
  return getEditableConfigFromComponent(component);
}

export function serializeEditableComponentConfig(config: EditableScreenComponentConfig): string {
  return JSON.stringify(config, null, 2);
}

export function formatEditableComponentJson(value: string): string {
  return JSON.stringify(JSON.parse(value), null, 2);
}

export function isStructurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => isStructurallyEqual(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left)
    .filter((key) => left[key] !== undefined)
    .sort();
  const rightKeys = Object.keys(right)
    .filter((key) => right[key] !== undefined)
    .sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key, index) =>
      key === rightKeys[index] &&
      Object.hasOwn(right, key) &&
      isStructurallyEqual(left[key], right[key]),
  );
}

export function createEditableComponentJsonSchema(
  options: ComponentJsonSchemaOptions,
): ComponentJsonSchema {
  const generated = z.toJSONSchema(createEditableComponentConfigSchema(options), {
    target: 'draft-07',
    unrepresentable: 'any',
  });
  const schema = cloneSchema(generated);
  const properties = getProperties(schema);
  properties['props'] = applyDefaultProps(
    cloneSchema(options.registration.manifest.propsSchema),
    options.registration.manifest.defaultProps,
  );
  return schema;
}

export function validateEditableComponentJson(
  value: string,
  options: ComponentJsonConfigValidationOptions,
): ComponentJsonConfigValidationResult {
  let input: unknown;
  try {
    input = JSON.parse(value);
  } catch {
    return {
      diagnostics: [{ message: 'JSON 格式错误，请检查输入', path: [], severity: 'error' }],
      success: false,
    };
  }

  if (!isRecord(input)) {
    return {
      diagnostics: [{ message: '组件配置必须是 JSON object', path: [], severity: 'error' }],
      success: false,
    };
  }

  const registration = getRegistration(options.registry, options.identity.type);
  if (registration === undefined) {
    return {
      diagnostics: [
        {
          message: `组件类型 "${options.identity.type}" 未在注册表中定义`,
          path: ['type'],
          severity: 'error',
        },
      ],
      success: false,
    };
  }

  const diagnostics: ComponentJsonConfigDiagnostic[] = [];
  const jsonDiagnostics: ScreenComponentValidationDiagnostic[] = [];
  checkJsonValue(input, [], jsonDiagnostics);
  appendUniqueDiagnostics(diagnostics, toDiagnosticsFromComponentValidation(jsonDiagnostics));

  if (registration.source === 'host') {
    for (const key of ['dataSource', 'logic', 'interaction'] as const) {
      if (Object.hasOwn(input, key)) {
        diagnostics.push({
          message: `外部组件不支持 ${key} 配置`,
          path: [key],
          severity: 'error',
        });
      }
    }
  }

  if (diagnostics.length > 0) return { diagnostics, success: false };

  const parsedConfig = parseConfigWithSchema(input, {
    capabilityProfile: options.capabilityProfile,
    registration,
  });
  if (!parsedConfig.success) return parsedConfig;

  const candidate: unknown = {
    ...options.identity,
    ...parsedConfig.config,
  };
  const componentResult = ScreenComponentSchema.safeParse(candidate);
  if (!componentResult.success) {
    return { diagnostics: toDiagnosticsFromZod(componentResult.error), success: false };
  }

  const propsDiagnostics: ScreenComponentValidationDiagnostic[] = [];
  const validProps = validateValueAgainstSchema(
    componentResult.data.props,
    registration.manifest.propsSchema,
    ['props'],
    propsDiagnostics,
  );
  if (!validProps) {
    return {
      diagnostics: toDiagnosticsFromComponentValidation(propsDiagnostics),
      success: false,
    };
  }

  if (
    options.capabilityProfile === 'static' &&
    componentResult.data.dataSource !== undefined &&
    componentResult.data.dataSource.type !== 'static'
  ) {
    return {
      diagnostics: [
        {
          message: 'static 模式仅支持 static 数据源配置',
          path: ['dataSource', 'type'],
          severity: 'error',
        },
      ],
      success: false,
    };
  }

  return {
    config: getEditableConfigFromComponent(componentResult.data),
    diagnostics: [],
    success: true,
  };
}
