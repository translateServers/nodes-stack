import { z } from 'zod';

/**
 * 事件蓝图图结构契约（事件蓝图 Spec 任务 1.1-1.3）
 *
 * 蓝图是交互层的项目级位置：`ScreenProjectSchema.blueprint`（可选）。
 * 组件级交互配置仍在组件 `interaction` 字段，两者互不替代。
 *
 * 设计约定：
 * - 图结构版本化：`version` 字段承载未来迁移，不做静默改写
 * - 节点按 kind 判别联合：trigger / condition / action / comment
 * - 边仅承载执行流（无数据流引脚）
 * - Schema 负责结构校验；语义校验（空参数、悬空引用、环）由编译器诊断，
 *   因此 componentId 等字段允许空字符串，保证未完成的图可以保存（非破坏原则）
 */

// ===== 触发器配置 =====

/** 触发器类型（M1：componentClick / pageLoad；M3 扩展 componentHover / dataLoaded / dataError / interval） */
export const BlueprintTriggerTypeSchema = z.enum([
  'componentClick',
  'pageLoad',
  'componentHover',
  'dataLoaded',
  'dataError',
  'interval',
]);
export type BlueprintTriggerType = z.infer<typeof BlueprintTriggerTypeSchema>;

export const TriggerComponentClickConfigSchema = z.object({
  type: z.literal('componentClick'),
  componentId: z.string().describe('触发组件 ID（空字符串视为未配置，由编译器诊断）'),
});
export type TriggerComponentClickConfig = z.infer<typeof TriggerComponentClickConfigSchema>;

export const TriggerPageLoadConfigSchema = z.object({
  type: z.literal('pageLoad'),
});
export type TriggerPageLoadConfig = z.infer<typeof TriggerPageLoadConfigSchema>;

/** 组件悬停触发（任务 10.3） */
export const TriggerComponentHoverConfigSchema = z.object({
  type: z.literal('componentHover'),
  componentId: z.string().describe('悬停触发的组件 ID'),
});
export type TriggerComponentHoverConfig = z.infer<typeof TriggerComponentHoverConfigSchema>;

/** 数据加载完成触发（任务 10.3） */
export const TriggerDataLoadedConfigSchema = z.object({
  type: z.literal('dataLoaded'),
  componentId: z.string().describe('数据源组件 ID（数据成功加载后触发）'),
});
export type TriggerDataLoadedConfig = z.infer<typeof TriggerDataLoadedConfigSchema>;

/** 数据加载错误触发（任务 10.3） */
export const TriggerDataErrorConfigSchema = z.object({
  type: z.literal('dataError'),
  componentId: z.string().describe('数据源组件 ID（数据加载失败后触发）'),
});
export type TriggerDataErrorConfig = z.infer<typeof TriggerDataErrorConfigSchema>;

/** 定时器触发（任务 10.3） */
export const TriggerIntervalConfigSchema = z
  .object({
    type: z.literal('interval'),
    /** 触发间隔（毫秒），必须 > 0；运行时由执行器安排 setInterval */
    intervalMs: z.number().int().positive().describe('触发间隔（毫秒），必须为正整数'),
  })
  .superRefine((config, ctx) => {
    if (config.intervalMs < 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['intervalMs'],
        message: '定时器间隔不得小于 100ms，避免高频触发影响性能',
      });
    }
    if (config.intervalMs > 86_400_000) {
      ctx.addIssue({
        code: 'custom',
        path: ['intervalMs'],
        message: '定时器间隔不得超过 86400000ms（24 小时）',
      });
    }
  });
export type TriggerIntervalConfig = z.infer<typeof TriggerIntervalConfigSchema>;

export const BlueprintTriggerConfigSchema = z.discriminatedUnion('type', [
  TriggerComponentClickConfigSchema,
  TriggerPageLoadConfigSchema,
  TriggerComponentHoverConfigSchema,
  TriggerDataLoadedConfigSchema,
  TriggerDataErrorConfigSchema,
  TriggerIntervalConfigSchema,
]);
export type BlueprintTriggerConfig = z.infer<typeof BlueprintTriggerConfigSchema>;

// ===== 动作配置 =====

/** 显隐动作目标状态 */
export const VisibilityActionModeSchema = z.enum(['show', 'hide', 'toggle']);
export type VisibilityActionMode = z.infer<typeof VisibilityActionModeSchema>;

export const ActionSetVisibilityConfigSchema = z.object({
  type: z.literal('setVisibility'),
  targetComponentId: z.string().describe('目标组件 ID（空字符串视为未配置，由编译器诊断）'),
  visible: VisibilityActionModeSchema.describe('显示 / 隐藏 / 切换'),
});
export type ActionSetVisibilityConfig = z.infer<typeof ActionSetVisibilityConfigSchema>;

/** navigate URL 协议白名单：仅允许 http/https */
export const NAVIGATE_URL_PROTOCOL_PATTERN = /^https?:\/\//i;

export function isAllowedNavigateUrl(url: string): boolean {
  return NAVIGATE_URL_PROTOCOL_PATTERN.test(url);
}

export const ActionNavigateConfigSchema = z
  .object({
    type: z.literal('navigate'),
    url: z.string().describe('目标 URL（空字符串视为未配置，由编译器诊断）'),
    target: z.enum(['_blank', '_self']).default('_blank').describe('打开方式'),
  })
  .superRefine((config, context) => {
    // 空 URL 由编译器空参数诊断处理；非空时必须命中协议白名单（拒绝 javascript: 等）
    if (config.url.length > 0 && !isAllowedNavigateUrl(config.url)) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: '仅允许 http/https 协议的链接',
      });
    }
  });
export type ActionNavigateConfig = z.infer<typeof ActionNavigateConfigSchema>;

export const ActionScrollToComponentConfigSchema = z.object({
  type: z.literal('scrollToComponent'),
  targetComponentId: z.string().describe('目标组件 ID（空字符串视为未配置，由编译器诊断）'),
});
export type ActionScrollToComponentConfig = z.infer<typeof ActionScrollToComponentConfigSchema>;

export const ActionRefreshDataSourceConfigSchema = z.object({
  type: z.literal('refreshDataSource'),
  targetComponentId: z.string().describe('目标组件 ID（空字符串视为未配置，由编译器诊断）'),
});
export type ActionRefreshDataSourceConfig = z.infer<typeof ActionRefreshDataSourceConfigSchema>;

/** HTTP 方法白名单（任务 10.4） */
export const REQUEST_API_METHOD_SCHEMA_ENUM = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type RequestApiMethod = (typeof REQUEST_API_METHOD_SCHEMA_ENUM)[number];

/**
 * requestApi 动作配置（任务 10.4）
 *
 * 发起 HTTP 请求，运行时由执行器调用 fetch：
 * - method 仅允许 GET/POST/PUT/PATCH/DELETE
 * - url 必须为 http/https 协议（与 navigate 一致白名单）
 * - headers / body 由调用方模板插值后传入（任务 10.5）
 * - secretHeaderKeys 标记需要脱敏的 header 键名（日志与诊断中脱敏展示）
 */
export const ActionRequestApiConfigSchema = z
  .object({
    type: z.literal('requestApi'),
    method: z.enum(REQUEST_API_METHOD_SCHEMA_ENUM).describe('HTTP 方法'),
    url: z.string().describe('请求 URL（必须 http/https）'),
    headers: z.record(z.string(), z.string()).default({}).describe('请求头（键值对）'),
    body: z.string().default('').describe('请求体（POST/PUT/PATCH 使用；GET/DELETE 忽略）'),
    /** 需要脱敏的 header 键名（用于日志/诊断中替换为 ***） */
    secretHeaderKeys: z.array(z.string()).default([]).describe('需要脱敏的 header 键名列表'),
    /** 请求超时（毫秒），默认 10000ms */
    timeoutMs: z.number().int().positive().max(300_000).default(10_000).describe('请求超时毫秒'),
  })
  .superRefine((config, ctx) => {
    if (config.url.length > 0 && !isAllowedNavigateUrl(config.url)) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: '仅允许 http/https 协议的请求 URL',
      });
    }
    // GET / DELETE 不应携带 body（schema 不强制拒绝，但产出 warning 诊断由编译器处理）
  });
export type ActionRequestApiConfig = z.infer<typeof ActionRequestApiConfigSchema>;

export const BlueprintActionConfigSchema = z.discriminatedUnion('type', [
  ActionSetVisibilityConfigSchema,
  ActionNavigateConfigSchema,
  ActionScrollToComponentConfigSchema,
  ActionRefreshDataSourceConfigSchema,
  ActionRequestApiConfigSchema,
]);
export type BlueprintActionConfig = z.infer<typeof BlueprintActionConfigSchema>;

// ===== 条件节点配置（M3 交付，契约先行预留） =====

/** 条件表达式字段来源 */
export const ConditionValueSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('componentProp'),
    componentId: z.string().describe('读取属性的组件 ID'),
    key: z.string().describe('属性键（读取组件 props 对应字段）'),
  }),
  z.object({
    kind: z.literal('componentData'),
    componentId: z.string().describe('读取数据的组件 ID'),
    path: z.string().describe('数据路径（点分隔，从组件最新解析数据中读取）'),
  }),
]);
export type ConditionValueSource = z.infer<typeof ConditionValueSourceSchema>;

export const ConditionOperatorSchema = z.enum([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'empty',
  'notEmpty',
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const ConditionExpressionSchema = z.object({
  source: ConditionValueSourceSchema.describe('左值来源'),
  operator: ConditionOperatorSchema.describe('比较运算符'),
  value: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .describe('比较值（empty/notEmpty 无需比较值）'),
});
export type ConditionExpression = z.infer<typeof ConditionExpressionSchema>;

export const ConditionNodeConfigSchema = z.object({
  type: z.literal('condition'),
  expression: ConditionExpressionSchema.describe('条件表达式（结构化，不产生自定义脚本）'),
});
export type ConditionNodeConfig = z.infer<typeof ConditionNodeConfigSchema>;

// ===== 注释节点配置 =====

export const CommentNodeConfigSchema = z.object({
  text: z.string().describe('注释文本（不参与编译执行）'),
});
export type CommentNodeConfig = z.infer<typeof CommentNodeConfigSchema>;

// ===== 节点与边 =====

export const BlueprintNodeKindSchema = z.enum(['trigger', 'condition', 'action', 'comment']);
export type BlueprintNodeKind = z.infer<typeof BlueprintNodeKindSchema>;

export const BlueprintNodePositionSchema = z.object({
  x: z.number().describe('节点 X 坐标'),
  y: z.number().describe('节点 Y 坐标'),
});
export type BlueprintNodePosition = z.infer<typeof BlueprintNodePositionSchema>;

const BlueprintNodeBaseSchema = z.object({
  id: z.string().min(1).describe('节点唯一标识'),
  position: BlueprintNodePositionSchema,
});

export const BlueprintTriggerNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('trigger'),
  config: BlueprintTriggerConfigSchema,
});
export type BlueprintTriggerNode = z.infer<typeof BlueprintTriggerNodeSchema>;

export const BlueprintConditionNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('condition'),
  config: ConditionNodeConfigSchema,
});
export type BlueprintConditionNode = z.infer<typeof BlueprintConditionNodeSchema>;

export const BlueprintActionNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('action'),
  config: BlueprintActionConfigSchema,
});
export type BlueprintActionNode = z.infer<typeof BlueprintActionNodeSchema>;

export const BlueprintCommentNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('comment'),
  config: CommentNodeConfigSchema,
});
export type BlueprintCommentNode = z.infer<typeof BlueprintCommentNodeSchema>;

/** 节点判别联合：未知 kind 或未知动作/触发器类型被拒绝并给出可读错误 */
export const BlueprintNodeSchema = z.discriminatedUnion('kind', [
  BlueprintTriggerNodeSchema,
  BlueprintConditionNodeSchema,
  BlueprintActionNodeSchema,
  BlueprintCommentNodeSchema,
]);
export type BlueprintNode = z.infer<typeof BlueprintNodeSchema>;

/**
 * 执行流引脚约定：
 * - trigger：输出 `out`
 * - action：输入 `in`，输出 `out`
 * - condition：输入 `in`，输出 `then` / `else`（M3）
 * - comment：无引脚（不参与执行流）
 */
export const BlueprintEdgeSchema = z.object({
  id: z.string().min(1).describe('边唯一标识'),
  source: z.string().min(1).describe('源节点 ID'),
  sourceHandle: z.string().min(1).describe('源引脚标识'),
  target: z.string().min(1).describe('目标节点 ID'),
  targetHandle: z.string().min(1).describe('目标引脚标识'),
});
export type BlueprintEdge = z.infer<typeof BlueprintEdgeSchema>;

// ===== 蓝图顶层结构 =====

export const EVENT_BLUEPRINT_VERSION = 1;

export const EventBlueprintSchema = z.object({
  version: z.literal(EVENT_BLUEPRINT_VERSION).describe('蓝图结构版本，未来演进经版本迁移'),
  nodes: z.array(BlueprintNodeSchema).describe('节点列表'),
  edges: z.array(BlueprintEdgeSchema).describe('执行流边列表'),
});
export type EventBlueprint = z.infer<typeof EventBlueprintSchema>;

// ===== 跨项目剪贴板载荷（任务 5.5） =====

export const BLUEPRINT_CLIPBOARD_KIND = 'nebula-blueprint-clipboard';

export const BlueprintClipboardSchema = z.object({
  kind: z.literal(BLUEPRINT_CLIPBOARD_KIND),
  nodes: z.array(BlueprintNodeSchema),
  edges: z.array(BlueprintEdgeSchema),
});
export type BlueprintClipboard = z.infer<typeof BlueprintClipboardSchema>;

// ===== V2 事件蓝图（组件即节点模型） =====

/**
 * V2 事件蓝图 Schema（组件即节点模型）
 *
 * V2 采用"组件即节点"模型：
 * - 组件节点（component）同时承担触发与动作角色，事件输出与动作输入均挂在组件节点上
 * - 全局节点是组件节点的子类型（componentId === 'global'），承载页面级触发与全局动作
 * - 条件节点、延时节点、注释节点保留独立 kind
 * - 边的 sourceHandle / targetHandle 改为语义化格式（evt:* / act:* / out / then / else / in）
 *
 * V1 schema 保留供迁移使用，不修改任何 V1 导出。
 */

/** V2 蓝图结构版本号 */
export const EVENT_BLUEPRINT_VERSION_V2 = 2;

/** 全局节点 componentId 固定值 */
export const GLOBAL_COMPONENT_ID = 'global';

// ===== V2 全局节点配置 =====

/**
 * 全局 navigate 节点配置
 *
 * 复用 V1 ActionNavigateConfigSchema 字段结构与 URL 协议白名单校验
 * （不含 type 字段，改用 globalType 判别）。
 */
export const GlobalNavigateConfigSchema = z
  .object({
    globalType: z.literal('navigate'),
    url: z.string().describe('目标 URL（空字符串视为未配置，由编译器诊断）'),
    target: z.enum(['_blank', '_self']).default('_blank').describe('打开方式'),
  })
  .superRefine((config, context) => {
    if (config.url.length > 0 && !isAllowedNavigateUrl(config.url)) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: '仅允许 http/https 协议的链接',
      });
    }
  });
export type GlobalNavigateConfig = z.infer<typeof GlobalNavigateConfigSchema>;

/**
 * 全局 requestApi 节点配置
 *
 * 复用 V1 ActionRequestApiConfigSchema 字段定义与校验逻辑
 * （不含 type 字段，改用 globalType 判别）。
 * 保留 URL 协议白名单校验、HTTP 方法白名单、超时范围与脱敏键名。
 */
export const GlobalRequestApiConfigSchema = z
  .object({
    globalType: z.literal('requestApi'),
    method: z.enum(REQUEST_API_METHOD_SCHEMA_ENUM).describe('HTTP 方法'),
    url: z.string().describe('请求 URL（必须 http/https）'),
    headers: z.record(z.string(), z.string()).default({}).describe('请求头（键值对）'),
    body: z.string().default('').describe('请求体（POST/PUT/PATCH 使用；GET/DELETE 忽略）'),
    secretHeaderKeys: z.array(z.string()).default([]).describe('需要脱敏的 header 键名列表'),
    timeoutMs: z.number().int().positive().max(300_000).default(10_000).describe('请求超时毫秒'),
  })
  .superRefine((config, ctx) => {
    if (config.url.length > 0 && !isAllowedNavigateUrl(config.url)) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: '仅允许 http/https 协议的请求 URL',
      });
    }
  });
export type GlobalRequestApiConfig = z.infer<typeof GlobalRequestApiConfigSchema>;

/**
 * 全局 scrollTo 节点配置
 *
 * 复用 V1 ActionScrollToComponentConfigSchema 字段结构
 * （不含 type 字段，改用 globalType 判别）。
 */
export const GlobalScrollToConfigSchema = z.object({
  globalType: z.literal('scrollTo'),
  targetComponentId: z.string().describe('目标组件 ID（空字符串视为未配置，由编译器诊断）'),
});
export type GlobalScrollToConfig = z.infer<typeof GlobalScrollToConfigSchema>;

/**
 * 全局节点配置判别联合（按 globalType 判别）
 *
 * 仅包含需要配置的全局节点类型（navigate / requestApi / scrollTo）。
 * pageLoad 全局节点无配置字段，config 为 undefined。
 */
export const GlobalNodeConfigSchema = z.discriminatedUnion('globalType', [
  GlobalNavigateConfigSchema,
  GlobalRequestApiConfigSchema,
  GlobalScrollToConfigSchema,
]);
export type GlobalNodeConfig = z.infer<typeof GlobalNodeConfigSchema>;

// ===== V2 节点 Schema =====

/**
 * 组件节点（V2 核心节点类型）
 *
 * - 普通组件节点：componentId 为组件 ID，无 globalType，无 config
 *   （事件与动作锚点从组件注册表派生）
 * - 全局节点：componentId 固定为 'global'，globalType 标识子类型，
 *   config 为对应全局配置（pageLoad 除外，pageLoad 无 config）
 *
 * superRefine 校验：
 * - 全局节点 componentId 必须为 'global'
 * - navigate/requestApi/scrollTo 全局节点必须提供 config 且 globalType 一致
 * - pageLoad 全局节点不应有 config
 * - 普通组件节点不应有 globalType / config
 */
export const ComponentNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('component'),
  componentId: z.string().describe('组件 ID；全局节点固定为 "global"'),
  globalType: z
    .enum(['pageLoad', 'navigate', 'requestApi', 'scrollTo'])
    .optional()
    .describe('全局节点子类型；普通组件节点缺省'),
  config: GlobalNodeConfigSchema.optional().describe(
    '全局节点配置；pageLoad 与普通组件节点无 config',
  ),
}).superRefine((node, ctx) => {
  const { globalType, config } = node;
  if (globalType !== undefined) {
    if (node.componentId !== GLOBAL_COMPONENT_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['componentId'],
        message: '全局节点的 componentId 必须为 "global"',
      });
    }
    if (globalType === 'pageLoad') {
      if (config !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['config'],
          message: 'pageLoad 全局节点不应有 config',
        });
      }
    } else if (config === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['config'],
        message: `${globalType} 全局节点必须提供 config`,
      });
    } else if (config.globalType !== globalType) {
      ctx.addIssue({
        code: 'custom',
        path: ['globalType'],
        message: 'globalType 与 config.globalType 不一致',
      });
    }
  } else if (config !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['config'],
      message: '普通组件节点不应有 config',
    });
  }
});
export type ComponentNode = z.infer<typeof ComponentNodeSchema>;

/**
 * 延时节点（V2 新增）
 *
 * delayMs 范围：0 ~ 60000ms（含边界），由 superRefine 显式报错。
 */
export const DelayNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('delay'),
  config: z.object({
    delayMs: z.number().int().describe('延时时长（毫秒），范围 0 ~ 60000'),
  }),
}).superRefine((node, ctx) => {
  const { delayMs } = node.config;
  if (delayMs < 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['config', 'delayMs'],
      message: '延时不得为负数',
    });
  }
  if (delayMs > 60_000) {
    ctx.addIssue({
      code: 'custom',
      path: ['config', 'delayMs'],
      message: '延时不得超过 60000ms（60 秒）',
    });
  }
});
export type DelayNode = z.infer<typeof DelayNodeSchema>;

/**
 * 条件节点（V2）
 *
 * 复用 V1 ConditionNodeConfigSchema（含 type: 'condition' + expression）。
 * 保留 V1 设计：输入 'in'，输出 'then' / 'else'。
 */
export const ConditionNodeV2Schema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('condition'),
  config: ConditionNodeConfigSchema,
});
export type ConditionNodeV2 = z.infer<typeof ConditionNodeV2Schema>;

/**
 * 注释节点（V2）
 *
 * 复用 V1 CommentNodeConfigSchema。注释节点不参与执行流。
 */
export const CommentNodeV2Schema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('comment'),
  config: CommentNodeConfigSchema,
});
export type CommentNodeV2 = z.infer<typeof CommentNodeV2Schema>;

/** V2 节点判别联合（按 kind 判别） */
export const BlueprintNodeV2Schema = z.discriminatedUnion('kind', [
  ComponentNodeSchema,
  ConditionNodeV2Schema,
  DelayNodeSchema,
  CommentNodeV2Schema,
]);
export type BlueprintNodeV2 = z.infer<typeof BlueprintNodeV2Schema>;

// ===== V2 边 Schema =====

/**
 * V2 执行流边
 *
 * sourceHandle / targetHandle 改为语义化格式：
 * - 组件事件输出：'evt:{eventId}'（如 'evt:click'）
 * - 组件动作输入：'act:{actionId}'（如 'act:show'）
 * - 逻辑节点输出：'out' / 'then' / 'else'
 * - 逻辑节点输入：'in'
 *
 * Schema 仅校验结构；引脚与节点 kind 的匹配由编译器诊断。
 */
export const BlueprintEdgeV2Schema = z.object({
  id: z.string().min(1).describe('边唯一标识'),
  source: z.string().min(1).describe('源节点 ID'),
  sourceHandle: z.string().min(1).describe('源引脚标识（evt:* / out / then / else）'),
  target: z.string().min(1).describe('目标节点 ID'),
  targetHandle: z.string().min(1).describe('目标引脚标识（act:* / in）'),
});
export type BlueprintEdgeV2 = z.infer<typeof BlueprintEdgeV2Schema>;

// ===== V2 蓝图顶层结构 =====

/**
 * V2 事件蓝图顶层结构
 *
 * 采用"组件即节点"模型，version 固定为 2。
 */
export const EventBlueprintV2Schema = z.object({
  version: z.literal(EVENT_BLUEPRINT_VERSION_V2).describe('蓝图结构版本 V2'),
  nodes: z.array(BlueprintNodeV2Schema).describe('节点列表'),
  edges: z.array(BlueprintEdgeV2Schema).describe('执行流边列表'),
});
export type EventBlueprintV2 = z.infer<typeof EventBlueprintV2Schema>;

// ===== V2 跨项目剪贴板载荷 =====

/**
 * V2 跨项目剪贴板载荷
 *
 * 复用 V1 BLUEPRINT_CLIPBOARD_KIND 标识，节点与边采用 V2 schema。
 */
export const BlueprintClipboardV2Schema = z.object({
  kind: z.literal(BLUEPRINT_CLIPBOARD_KIND),
  nodes: z.array(BlueprintNodeV2Schema),
  edges: z.array(BlueprintEdgeV2Schema),
});
export type BlueprintClipboardV2 = z.infer<typeof BlueprintClipboardV2Schema>;
