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

// ===== 归档触发器配置 =====

/** 旧 trigger/action 图的触发器类型，仅用于读取和迁移历史蓝图。 */
export const LegacyBlueprintTriggerTypeSchema = z.enum([
  'componentClick',
  'pageLoad',
  'componentHover',
  'dataLoaded',
  'dataError',
  'interval',
]);
export type LegacyBlueprintTriggerType = z.infer<typeof LegacyBlueprintTriggerTypeSchema>;

export const LegacyTriggerComponentClickConfigSchema = z.object({
  type: z.literal('componentClick'),
  componentId: z.string().describe('触发组件 ID（空字符串视为未配置，由编译器诊断）'),
});
export type LegacyTriggerComponentClickConfig = z.infer<
  typeof LegacyTriggerComponentClickConfigSchema
>;

export const LegacyTriggerPageLoadConfigSchema = z.object({
  type: z.literal('pageLoad'),
});
export type LegacyTriggerPageLoadConfig = z.infer<typeof LegacyTriggerPageLoadConfigSchema>;

/** 组件悬停触发（任务 10.3） */
export const LegacyTriggerComponentHoverConfigSchema = z.object({
  type: z.literal('componentHover'),
  componentId: z.string().describe('悬停触发的组件 ID'),
});
export type LegacyTriggerComponentHoverConfig = z.infer<
  typeof LegacyTriggerComponentHoverConfigSchema
>;

/** 数据加载完成触发（任务 10.3） */
export const LegacyTriggerDataLoadedConfigSchema = z.object({
  type: z.literal('dataLoaded'),
  componentId: z.string().describe('数据源组件 ID（数据成功加载后触发）'),
});
export type LegacyTriggerDataLoadedConfig = z.infer<typeof LegacyTriggerDataLoadedConfigSchema>;

/** 数据加载错误触发（任务 10.3） */
export const LegacyTriggerDataErrorConfigSchema = z.object({
  type: z.literal('dataError'),
  componentId: z.string().describe('数据源组件 ID（数据加载失败后触发）'),
});
export type LegacyTriggerDataErrorConfig = z.infer<typeof LegacyTriggerDataErrorConfigSchema>;

/** 定时器触发（任务 10.3） */
export const LegacyTriggerIntervalConfigSchema = z
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
export type LegacyTriggerIntervalConfig = z.infer<typeof LegacyTriggerIntervalConfigSchema>;

export const LegacyBlueprintTriggerConfigSchema = z.discriminatedUnion('type', [
  LegacyTriggerComponentClickConfigSchema,
  LegacyTriggerPageLoadConfigSchema,
  LegacyTriggerComponentHoverConfigSchema,
  LegacyTriggerDataLoadedConfigSchema,
  LegacyTriggerDataErrorConfigSchema,
  LegacyTriggerIntervalConfigSchema,
]);
export type LegacyBlueprintTriggerConfig = z.infer<typeof LegacyBlueprintTriggerConfigSchema>;

// ===== 动作配置 =====

/** 旧 trigger/action 图的显隐动作状态。 */
export const LegacyVisibilityActionModeSchema = z.enum(['show', 'hide', 'toggle']);
export type LegacyVisibilityActionMode = z.infer<typeof LegacyVisibilityActionModeSchema>;

export const LegacyActionSetVisibilityConfigSchema = z.object({
  type: z.literal('setVisibility'),
  targetComponentId: z.string().describe('目标组件 ID（空字符串视为未配置，由编译器诊断）'),
  visible: LegacyVisibilityActionModeSchema.describe('显示 / 隐藏 / 切换'),
});
export type LegacyActionSetVisibilityConfig = z.infer<typeof LegacyActionSetVisibilityConfigSchema>;

/** navigate URL 协议白名单：仅允许 http/https */
export const NAVIGATE_URL_PROTOCOL_PATTERN = /^https?:\/\//i;

export function isAllowedNavigateUrl(url: string): boolean {
  return NAVIGATE_URL_PROTOCOL_PATTERN.test(url);
}

export const LegacyActionNavigateConfigSchema = z
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
export type LegacyActionNavigateConfig = z.infer<typeof LegacyActionNavigateConfigSchema>;

export const LegacyActionScrollToComponentConfigSchema = z.object({
  type: z.literal('scrollToComponent'),
  targetComponentId: z.string().describe('目标组件 ID（空字符串视为未配置，由编译器诊断）'),
});
export type LegacyActionScrollToComponentConfig = z.infer<
  typeof LegacyActionScrollToComponentConfigSchema
>;

export const LegacyActionRefreshDataSourceConfigSchema = z.object({
  type: z.literal('refreshDataSource'),
  targetComponentId: z.string().describe('目标组件 ID（空字符串视为未配置，由编译器诊断）'),
});
export type LegacyActionRefreshDataSourceConfig = z.infer<
  typeof LegacyActionRefreshDataSourceConfigSchema
>;

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
export const LegacyActionRequestApiConfigSchema = z
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
export type LegacyActionRequestApiConfig = z.infer<typeof LegacyActionRequestApiConfigSchema>;

export const LegacyBlueprintActionConfigSchema = z.discriminatedUnion('type', [
  LegacyActionSetVisibilityConfigSchema,
  LegacyActionNavigateConfigSchema,
  LegacyActionScrollToComponentConfigSchema,
  LegacyActionRefreshDataSourceConfigSchema,
  LegacyActionRequestApiConfigSchema,
]);
export type LegacyBlueprintActionConfig = z.infer<typeof LegacyBlueprintActionConfigSchema>;

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

export const LegacyBlueprintNodeKindSchema = z.enum(['trigger', 'condition', 'action', 'comment']);
export type LegacyBlueprintNodeKind = z.infer<typeof LegacyBlueprintNodeKindSchema>;

export const BlueprintNodePositionSchema = z.object({
  x: z.number().describe('节点 X 坐标'),
  y: z.number().describe('节点 Y 坐标'),
});
export type BlueprintNodePosition = z.infer<typeof BlueprintNodePositionSchema>;

const BlueprintNodeBaseSchema = z.object({
  id: z.string().min(1).describe('节点唯一标识'),
  position: BlueprintNodePositionSchema,
});

export const LegacyBlueprintTriggerNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('trigger'),
  config: LegacyBlueprintTriggerConfigSchema,
});
export type LegacyBlueprintTriggerNode = z.infer<typeof LegacyBlueprintTriggerNodeSchema>;

export const LegacyBlueprintConditionNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('condition'),
  config: ConditionNodeConfigSchema,
});
export type LegacyBlueprintConditionNode = z.infer<typeof LegacyBlueprintConditionNodeSchema>;

export const LegacyBlueprintActionNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('action'),
  config: LegacyBlueprintActionConfigSchema,
});
export type LegacyBlueprintActionNode = z.infer<typeof LegacyBlueprintActionNodeSchema>;

export const LegacyBlueprintCommentNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('comment'),
  config: CommentNodeConfigSchema,
});
export type LegacyBlueprintCommentNode = z.infer<typeof LegacyBlueprintCommentNodeSchema>;

/** 节点判别联合：未知 kind 或未知动作/触发器类型被拒绝并给出可读错误 */
export const LegacyBlueprintNodeSchema = z.discriminatedUnion('kind', [
  LegacyBlueprintTriggerNodeSchema,
  LegacyBlueprintConditionNodeSchema,
  LegacyBlueprintActionNodeSchema,
  LegacyBlueprintCommentNodeSchema,
]);
export type LegacyBlueprintNode = z.infer<typeof LegacyBlueprintNodeSchema>;

/**
 * 执行流引脚约定：
 * - trigger：输出 `out`
 * - action：输入 `in`，输出 `out`
 * - condition：输入 `in`，输出 `then` / `else`（M3）
 * - comment：无引脚（不参与执行流）
 */
export const LegacyBlueprintEdgeSchema = z.object({
  id: z.string().min(1).describe('边唯一标识'),
  source: z.string().min(1).describe('源节点 ID'),
  sourceHandle: z.string().min(1).describe('源引脚标识'),
  target: z.string().min(1).describe('目标节点 ID'),
  targetHandle: z.string().min(1).describe('目标引脚标识'),
});
export type LegacyBlueprintEdge = z.infer<typeof LegacyBlueprintEdgeSchema>;

// ===== 蓝图顶层结构 =====

export const LEGACY_EVENT_BLUEPRINT_VERSION = 1 as const;

export const LegacyEventBlueprintSchema = z.object({
  version: z.literal(LEGACY_EVENT_BLUEPRINT_VERSION).describe('归档蓝图结构版本'),
  nodes: z.array(LegacyBlueprintNodeSchema).describe('节点列表'),
  edges: z.array(LegacyBlueprintEdgeSchema).describe('执行流边列表'),
});
export type LegacyEventBlueprint = z.infer<typeof LegacyEventBlueprintSchema>;

// ===== 跨项目剪贴板载荷（任务 5.5） =====

export const BLUEPRINT_CLIPBOARD_KIND = 'nebula-blueprint-clipboard';

export const LegacyBlueprintClipboardSchema = z.object({
  kind: z.literal(BLUEPRINT_CLIPBOARD_KIND),
  nodes: z.array(LegacyBlueprintNodeSchema),
  edges: z.array(LegacyBlueprintEdgeSchema),
});
export type LegacyBlueprintClipboard = z.infer<typeof LegacyBlueprintClipboardSchema>;

// ===== 正式事件蓝图（组件即节点模型） =====

/**
 * 正式事件蓝图 Schema（组件即节点模型）
 *
 * 正式模型采用"组件即节点"：
 * - 组件节点（component）同时承担触发与动作角色，事件输出与动作输入均挂在组件节点上
 * - 全局节点是组件节点的子类型（componentId === 'global'），承载页面级触发与全局动作
 * - 条件节点、延时节点、注释节点保留独立 kind
 * - 边的 sourceHandle / targetHandle 改为语义化格式（evt:* / act:* / out / then / else / in）
 *
 * 旧 trigger/action schema 仅保留供迁移使用。
 */

/** 正式蓝图结构版本号。 */
export const EVENT_BLUEPRINT_VERSION = 2 as const;

/** 全局节点 componentId 固定值 */
export const GLOBAL_COMPONENT_ID = 'global';

// ===== 正式全局节点配置 =====

/**
 * 全局 navigate 节点配置
 *
 * 复用归档 navigate 配置的字段结构与 URL 协议白名单校验
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
 * 复用归档 requestApi 配置的字段定义与校验逻辑
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
 * 复用归档 scrollToComponent 配置的字段结构
 * （不含 type 字段，改用 globalType 判别）。
 */
export const GlobalScrollToConfigSchema = z.object({
  globalType: z.literal('scrollTo'),
  targetComponentId: z.string().describe('目标组件 ID（空字符串视为未配置，由编译器诊断）'),
});
export type GlobalScrollToConfig = z.infer<typeof GlobalScrollToConfigSchema>;

/**
 * 全局 interval 节点配置（定时器触发）
 *
 * 复用归档 interval 配置的 intervalMs 范围校验逻辑
 * （不含 type 字段，改用 globalType 判别）。
 */
export const GlobalIntervalConfigSchema = z
  .object({
    globalType: z.literal('interval'),
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
export type GlobalIntervalConfig = z.infer<typeof GlobalIntervalConfigSchema>;

/**
 * 全局节点配置判别联合（按 globalType 判别）
 *
 * 仅包含需要配置的全局节点类型（navigate / requestApi / scrollTo / interval）。
 * pageLoad 全局节点无配置字段，config 为 undefined。
 */
export const GlobalNodeConfigSchema = z.discriminatedUnion('globalType', [
  GlobalNavigateConfigSchema,
  GlobalRequestApiConfigSchema,
  GlobalScrollToConfigSchema,
  GlobalIntervalConfigSchema,
]);
export type GlobalNodeConfig = z.infer<typeof GlobalNodeConfigSchema>;

// ===== 正式节点 Schema =====

/**
 * 组件节点（正式核心节点类型）
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
    .enum(['pageLoad', 'navigate', 'requestApi', 'scrollTo', 'interval'])
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
 * 条件节点
 *
 * 复用 ConditionNodeConfigSchema（含 type: 'condition' + expression）。
 * 输入 'in'，输出 'then' / 'else'。
 */
export const ConditionNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('condition'),
  config: ConditionNodeConfigSchema,
});
export type ConditionNode = z.infer<typeof ConditionNodeSchema>;

/**
 * 注释节点
 *
 * 复用 CommentNodeConfigSchema。注释节点不参与执行流。
 */
export const CommentNodeSchema = BlueprintNodeBaseSchema.extend({
  kind: z.literal('comment'),
  config: CommentNodeConfigSchema,
});
export type CommentNode = z.infer<typeof CommentNodeSchema>;

/** 正式节点判别联合（按 kind 判别）。 */
export const BlueprintNodeSchema = z.discriminatedUnion('kind', [
  ComponentNodeSchema,
  ConditionNodeSchema,
  DelayNodeSchema,
  CommentNodeSchema,
]);
export type BlueprintNode = z.infer<typeof BlueprintNodeSchema>;

// ===== 正式边 Schema =====

/**
 * 正式执行流边
 *
 * sourceHandle / targetHandle 改为语义化格式：
 * - 组件事件输出：'evt:{eventId}'（如 'evt:click'）
 * - 组件动作输入：'act:{actionId}'（如 'act:show'）
 * - 逻辑节点输出：'out' / 'then' / 'else'
 * - 逻辑节点输入：'in'
 *
 * Schema 仅校验结构；引脚与节点 kind 的匹配由编译器诊断。
 */
export const BlueprintEdgeSchema = z.object({
  id: z.string().min(1).describe('边唯一标识'),
  source: z.string().min(1).describe('源节点 ID'),
  sourceHandle: z.string().min(1).describe('源引脚标识（evt:* / out / then / else）'),
  target: z.string().min(1).describe('目标节点 ID'),
  targetHandle: z.string().min(1).describe('目标引脚标识（act:* / in）'),
});
export type BlueprintEdge = z.infer<typeof BlueprintEdgeSchema>;

// ===== 正式蓝图顶层结构 =====

/**
 * 正式事件蓝图顶层结构
 *
 * 采用"组件即节点"模型，version 固定为 2。
 */
export const EventBlueprintSchema = z.object({
  version: z.literal(EVENT_BLUEPRINT_VERSION).describe('蓝图结构版本'),
  nodes: z.array(BlueprintNodeSchema).describe('节点列表'),
  edges: z.array(BlueprintEdgeSchema).describe('执行流边列表'),
});
export type EventBlueprint = z.infer<typeof EventBlueprintSchema>;

// ===== 正式跨项目剪贴板载荷 =====

/**
 * 正式跨项目剪贴板载荷
 *
 * 复用稳定的 BLUEPRINT_CLIPBOARD_KIND 标识，节点与边采用正式 schema。
 */
export const BlueprintClipboardSchema = z.object({
  kind: z.literal(BLUEPRINT_CLIPBOARD_KIND),
  nodes: z.array(BlueprintNodeSchema),
  edges: z.array(BlueprintEdgeSchema),
});
export type BlueprintClipboard = z.infer<typeof BlueprintClipboardSchema>;
