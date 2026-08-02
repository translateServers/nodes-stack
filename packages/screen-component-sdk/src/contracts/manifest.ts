/**
 * Component Manifest V1（Spec §7.2）
 *
 * 可序列化组件描述，包含身份、默认值、props schema、属性面板和事件。
 * manifest 是组件注册表的权威数据源，驱动组件库、校验、属性面板和蓝图。
 */

import type { ScreenComponentJsonValue, ScreenComponentProps } from './json.js';
import type { ScreenComponentPropertySection } from './property.js';
import type { ScreenComponentEventDefinition } from './event.js';

/** 组件协议 API 版本标识 */
export const SCREEN_COMPONENT_API_VERSION = 'nebula.screen-component/v1' as const;

/** SDK 内置 icon token；外部组件只接受这些值或使用 category fallback */
export const SCREEN_COMPONENT_ICON_TOKENS = [
  'chart',
  'text',
  'media',
  'shape',
  'button',
  'table',
  'container',
  'code',
] as const;

export type ScreenComponentIconToken = (typeof SCREEN_COMPONENT_ICON_TOKENS)[number];

/** 组件分类（与 @nebula/shared 的 ComponentCategory 对齐） */
export const SCREEN_COMPONENT_CATEGORIES = [
  'chart',
  'text',
  'media',
  'decoration',
  'table',
  'container',
] as const;

export type ScreenComponentCategory = (typeof SCREEN_COMPONENT_CATEGORIES)[number];

/**
 * 组件 Manifest V1
 *
 * Identity rules (Spec §7.2):
 * - 外部组件 `type` 使用带命名空间和契约主版本的稳定标识，例如 `acme.kpi/v1`
 * - 外部 type 必须匹配 `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+/v([1-9][0-9]*)$`
 * - `type` 不得使用内置保留前缀 `nebula.`，第三方不得覆盖内置 type
 * - text/bar-chart/rect/ellipse/image/button 是为兼容既有文档保留的内置 type 例外
 * - `implementationVersion` 是 SemVer，同一 type 的 minor/patch 必须向后兼容
 * - 破坏 props 或事件契约时必须发布新 type，例如 `acme.kpi/v2`
 * - `tagName` 必须满足 Custom Element 命名规则，并以 `-v<major>` 结尾
 * - `order` 如提供必须是有限整数；缺省为 0
 * - 文档只保存 `type`，不得保存 `tagName`、实现版本、构造函数或脚本 URL
 */
export interface ScreenComponentManifestV1 {
  apiVersion: typeof SCREEN_COMPONENT_API_VERSION;
  type: string;
  implementationVersion: string;
  tagName: string;
  name: string;
  category: ScreenComponentCategory;
  icon?: ScreenComponentIconToken;
  description?: string;
  keywords?: readonly string[];
  order?: number;
  defaultSize: { readonly width: number; readonly height: number };
  defaultProps: Readonly<ScreenComponentProps>;
  propsSchema: Readonly<Record<string, ScreenComponentJsonValue>>;
  propertyPanel?: readonly ScreenComponentPropertySection[];
  events?: readonly ScreenComponentEventDefinition[];
}

/** 内置保留 type（Spec §7.2 Identity rules） */
export const BUILTIN_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'bar-chart',
  'rect',
  'ellipse',
  'image',
  'button',
]);

/** 内置保留前缀（Spec §7.2: 第三方不得使用 `nebula.` 前缀） */
export const BUILTIN_TYPE_PREFIX = 'nebula.';

/**
 * 外部组件 type 正则（Spec §7.2）
 * 捕获组 1 是契约主版本号
 */
export const EXTERNAL_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+\/v([1-9][0-9]*)$/;

/**
 * Custom Element tagName 命名规则（Spec §7.2）
 * 必须包含连字符，并以 `-v<major>` 结尾
 */
export const TAG_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+-v([1-9][0-9]*)$/;

/** propsSchema 允许的 JSON Schema 关键字（Spec §7.3 V1 受限子集） */
export const PROPS_SCHEMA_ALLOWED_TYPES = [
  'object',
  'array',
  'string',
  'number',
  'integer',
  'boolean',
  'null',
] as const;

export type PropsSchemaType = (typeof PROPS_SCHEMA_ALLOWED_TYPES)[number];

/** propsSchema 允许的关键字白名单（Spec §7.3） */
export const PROPS_SCHEMA_ALLOWED_KEYWORDS: ReadonlySet<string> = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'enum',
  'const',
  'minimum',
  'maximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'items',
  'minItems',
  'maxItems',
  'title',
  'description',
]);

/** 禁止的 schema 关键字（Spec §7.3） */
export const PROPS_SCHEMA_FORBIDDEN_KEYWORDS: ReadonlySet<string> = new Set([
  '$ref',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  '$defs',
  'definitions',
  'if',
  'then',
  'else',
  'format',
  'contentEncoding',
  'contentMediaType',
  'default',
]);
