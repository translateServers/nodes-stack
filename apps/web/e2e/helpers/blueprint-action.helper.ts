/**
 * 事件蓝图动作 E2E 辅助（任务 7.2 / 7.3 共用）
 *
 * 提供三个能力：
 * - buildBlueprint：构造完整蓝图（trigger → action 链，含参数与连线）
 * - setupProjectWithBlueprint：创建项目 + 组件 + 蓝图 + 发布，返回最新 updatedAt 基线
 * - openAnonymousPreview：在匿名 context 中打开预览页并等待首屏稳定
 *
 * 设计原则：
 * - 与 7.1 不同：7.2/7.3 不验证编辑器 UI，直接通过 API 写入完整蓝图，
 *   测试焦点集中在"动作执行效果"与"运行时边界（深度截断、dangling）"
 * - 所有断言在匿名预览 context 中完成，避免编辑器副作用
 */

import type { Browser, BrowserContext, Page } from '@playwright/test';
import {
  GLOBAL_COMPONENT_ID,
  type BlueprintEdge,
  type BlueprintNode,
  type EventBlueprint,
  type ScreenComponent,
} from '@nebula/shared';

import {
  createScreenProject,
  updateScreenProject,
  publishScreenProject,
  deleteScreenProject,
  type CreateScreenProjectParams,
} from './screen-api.helper';

/** 触发器配置（componentClick / pageLoad）判别联合。 */
export type TriggerConfig = { type: 'componentClick'; componentId: string } | { type: 'pageLoad' };

/** 动作配置判别联合（覆盖 M1 四类动作） */
export type ActionConfig =
  | { type: 'setVisibility'; targetComponentId: string; visible: 'show' | 'hide' | 'toggle' }
  | { type: 'navigate'; url: string; target?: '_blank' | '_self' }
  | { type: 'scrollToComponent'; targetComponentId: string }
  | { type: 'refreshDataSource'; targetComponentId: string };

/** 触发-动作对。 */
export interface TriggerActionPair {
  triggerId: string;
  triggerConfig: TriggerConfig;
  actionId: string;
  actionConfig: ActionConfig;
}

/**
 * 构造一条正式的触发-动作规则。
 */
export function buildBlueprint(pair: TriggerActionPair): EventBlueprint {
  const { triggerId, triggerConfig, actionId, actionConfig } = pair;
  return {
    version: 2,
    nodes: [buildTriggerNode(triggerId, triggerConfig), buildActionNode(actionId, actionConfig)],
    edges: [
      {
        id: `edge-${triggerId}-${actionId}`,
        source: triggerId,
        sourceHandle: triggerHandle(triggerConfig),
        target: actionId,
        targetHandle: actionHandle(actionConfig),
      },
    ],
  };
}

/** 构造一个触发器依次执行两个动作的正式蓝图。 */
export function buildChainBlueprint(
  triggerId: string,
  triggerConfig: TriggerConfig,
  action1Id: string,
  action1Config: ActionConfig,
  action2Id: string,
  action2Config: ActionConfig,
): EventBlueprint {
  return {
    version: 2,
    nodes: [
      buildTriggerNode(triggerId, triggerConfig),
      buildActionNode(action1Id, action1Config),
      buildActionNode(action2Id, action2Config, { x: 700, y: 200 }),
    ],
    edges: [
      {
        id: `edge-${triggerId}-${action1Id}`,
        source: triggerId,
        sourceHandle: triggerHandle(triggerConfig),
        target: action1Id,
        targetHandle: actionHandle(action1Config),
      },
      {
        id: `edge-${triggerId}-${action2Id}`,
        source: triggerId,
        sourceHandle: triggerHandle(triggerConfig),
        target: action2Id,
        targetHandle: actionHandle(action2Config),
      },
    ],
  };
}

/**
 * 构造超出编译器深度限制的正式 delay 链，最后的 hide 动作必须被截断。
 */
export function buildDeepChainBlueprint(
  triggerId: string,
  triggerComponentId: string,
  targetComponentId: string,
  delayCount: number,
): EventBlueprint {
  const nodes: BlueprintNode[] = [
    buildTriggerNode(triggerId, { type: 'componentClick', componentId: triggerComponentId }),
    ...Array.from({ length: delayCount }, (_, index) => ({
      id: `delay-${index + 1}`,
      kind: 'delay' as const,
      position: { x: 400 + index * 40, y: 200 },
      config: { delayMs: 0 },
    })),
    buildActionNode('deep-final-action', {
      type: 'setVisibility',
      targetComponentId,
      visible: 'hide',
    }),
  ];
  const edges: BlueprintEdge[] = [
    {
      id: `edge-${triggerId}-delay-1`,
      source: triggerId,
      sourceHandle: 'evt:click',
      target: 'delay-1',
      targetHandle: 'in',
    },
  ];
  for (let index = 1; index < delayCount; index += 1) {
    edges.push({
      id: `edge-delay-${index}-${index + 1}`,
      source: `delay-${index}`,
      sourceHandle: 'out',
      target: `delay-${index + 1}`,
      targetHandle: 'in',
    });
  }
  edges.push({
    id: 'edge-delay-final-action',
    source: `delay-${delayCount}`,
    sourceHandle: 'out',
    target: 'deep-final-action',
    targetHandle: 'act:hide',
  });
  return { version: 2, nodes, edges };
}

function buildTriggerNode(id: string, config: TriggerConfig): BlueprintNode {
  if (config.type === 'pageLoad') {
    return {
      id,
      kind: 'component',
      componentId: GLOBAL_COMPONENT_ID,
      globalType: 'pageLoad',
      position: { x: 100, y: 200 },
    };
  }
  return {
    id,
    kind: 'component',
    componentId: config.componentId,
    position: { x: 100, y: 200 },
  };
}

function buildActionNode(
  id: string,
  config: ActionConfig,
  position = { x: 400, y: 200 },
): BlueprintNode {
  switch (config.type) {
    case 'setVisibility':
    case 'scrollToComponent':
    case 'refreshDataSource':
      return { id, kind: 'component', componentId: config.targetComponentId, position };
    case 'navigate':
      return {
        id,
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'navigate',
        config: { globalType: 'navigate', url: config.url, target: config.target ?? '_blank' },
        position,
      };
  }
}

function triggerHandle(config: TriggerConfig): string {
  return config.type === 'pageLoad' ? 'evt:pageLoad' : 'evt:click';
}

function actionHandle(config: ActionConfig): string {
  switch (config.type) {
    case 'setVisibility':
      return config.visible === 'toggle' ? 'act:toggleVisibility' : `act:${config.visible}`;
    case 'navigate':
      return 'act:navigate';
    case 'scrollToComponent':
      return 'act:scrollTo';
    case 'refreshDataSource':
      return 'act:refreshData';
  }
}

/**
 * 创建项目 + 组件 + 蓝图 + 发布，返回项目 ID 与最新 updatedAt 基线。
 *
 * 流程：
 * 1. createScreenProject
 * 2. updateScreenProject（components + blueprint）
 * 3. publishScreenProject
 *
 * 失败时自动清理（删除已创建的项目）。
 */
export async function setupProjectWithBlueprint(options: {
  name: string;
  components: ScreenComponent[];
  blueprint: EventBlueprint;
  canvas?: CreateScreenProjectParams['canvas'];
}): Promise<{ projectId: string; updatedAt: string }> {
  const { name, components, blueprint, canvas } = options;
  const project = await createScreenProject({ name, canvas });

  try {
    const updated = await updateScreenProject(project.id, {
      components,
      blueprint,
      expectedUpdatedAt: project.updatedAt,
    });
    const published = await publishScreenProject(project.id, {
      expectedUpdatedAt: updated.updatedAt,
    });
    return { projectId: project.id, updatedAt: published.updatedAt };
  } catch (err) {
    await deleteScreenProject(project.id).catch(() => {});
    throw err;
  }
}

/**
 * 在匿名 context 中打开预览页，返回 page 与 context 用于断言与清理。
 *
 * 调用方需在 finally 中调用 dispose() 关闭 context。
 */
export async function openAnonymousPreview(
  browser: Browser,
  projectId: string,
): Promise<{ page: Page; context: BrowserContext; dispose: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const previewApiResponse = page.waitForResponse(
    (res) => res.url().includes(`/screen/${projectId}/preview`) && res.request().method() === 'GET',
  );
  await page.goto(`/screen-preview/${projectId}`);
  const res = await previewApiResponse;
  if (!res.ok()) {
    throw new Error(`预览 API 应返回 200，实际: ${res.status()}`);
  }
  await page.waitForLoadState('networkidle');
  return {
    page,
    context,
    dispose: async () => {
      try {
        await context.close();
      } catch {
        // 忽略 context 关闭错误
      }
    },
  };
}

/**
 * 在每个页面加载前注入 scrollIntoView 调用追踪 spy。
 *
 * 用于 scrollToComponent 动作 E2E：预览页容器为 overflow-hidden，
 * 直接断言滚动位置不可行，改用 spy 断言 scrollIntoView 被调用且目标元素正确。
 *
 * spy 写入 window.__scrollIntoViewCalls: string[]（按调用顺序记录 data-preview-component-id）
 */
export async function injectScrollIntoViewSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const proto = Element.prototype as Element & {
      __originalScrollIntoView?: typeof Element.prototype.scrollIntoView;
    };
    if (!proto.__originalScrollIntoView) {
      proto.__originalScrollIntoView = proto.scrollIntoView.bind(proto);
    }
    const calls: string[] = [];
    (window as unknown as { __scrollIntoViewCalls: string[] }).__scrollIntoViewCalls = calls;
    proto.scrollIntoView = function (this: Element, ...args: unknown[]): void {
      const id = this.getAttribute('data-preview-component-id');
      if (id) calls.push(id);
      proto.__originalScrollIntoView?.apply(this, args as never);
    };
  });
}

/** 读取 scrollIntoView 调用记录（由 injectScrollIntoViewSpy 注入） */
export async function getScrollIntoViewCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    return (window as unknown as { __scrollIntoViewCalls?: string[] }).__scrollIntoViewCalls ?? [];
  });
}
