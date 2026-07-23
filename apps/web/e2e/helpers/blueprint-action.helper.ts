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
import type { EventBlueprint, ScreenComponent } from '@nebula/shared';

import {
  createScreenProject,
  updateScreenProject,
  publishScreenProject,
  deleteScreenProject,
  type CreateScreenProjectParams,
} from './screen-api.helper';

/** 触发器配置（componentClick / pageLoad）判别联合 */
export type TriggerConfig = { type: 'componentClick'; componentId: string } | { type: 'pageLoad' };

/** 动作配置判别联合（覆盖 M1 四类动作） */
export type ActionConfig =
  | { type: 'setVisibility'; targetComponentId: string; visible: 'show' | 'hide' | 'toggle' }
  | { type: 'navigate'; url: string; target?: '_blank' | '_self' }
  | { type: 'scrollToComponent'; targetComponentId: string }
  | { type: 'refreshDataSource'; targetComponentId: string };

/** 触发-动作对：单条规则（trigger → action，含 out→in 单边） */
export interface TriggerActionPair {
  triggerId: string;
  triggerConfig: TriggerConfig;
  actionId: string;
  actionConfig: ActionConfig;
}

/**
 * 构造一条"trigger → action"规则的完整蓝图。
 *
 * - 节点 ID 由调用方提供（便于 E2E 中引用），动作位置默认排布在 trigger 右侧 300px
 * - 边 out → in（执行流单引脚约定）
 */
export function buildBlueprint(pair: TriggerActionPair): EventBlueprint {
  const { triggerId, triggerConfig, actionId, actionConfig } = pair;
  return {
    version: 1,
    nodes: [
      {
        id: triggerId,
        kind: 'trigger',
        position: { x: 100, y: 200 },
        config: triggerConfig,
      },
      {
        id: actionId,
        kind: 'action',
        position: { x: 400, y: 200 },
        config: actionConfig as EventBlueprint['nodes'][number]['config'],
      },
    ],
    edges: [
      {
        id: `edge-${triggerId}-${actionId}`,
        source: triggerId,
        sourceHandle: 'out',
        target: actionId,
        targetHandle: 'in',
      },
    ],
  };
}

/** 构造"trigger → action1 → action2"三段链式蓝图（用于 7.3 深度截断） */
export function buildChainBlueprint(
  triggerId: string,
  triggerConfig: TriggerConfig,
  action1Id: string,
  action1Config: ActionConfig,
  action2Id: string,
  action2Config: ActionConfig,
): EventBlueprint {
  return {
    version: 1,
    nodes: [
      { id: triggerId, kind: 'trigger', position: { x: 100, y: 200 }, config: triggerConfig },
      {
        id: action1Id,
        kind: 'action',
        position: { x: 400, y: 200 },
        config: action1Config as EventBlueprint['nodes'][number]['config'],
      },
      {
        id: action2Id,
        kind: 'action',
        position: { x: 700, y: 200 },
        config: action2Config as EventBlueprint['nodes'][number]['config'],
      },
    ],
    edges: [
      {
        id: `edge-${triggerId}-${action1Id}`,
        source: triggerId,
        sourceHandle: 'out',
        target: action1Id,
        targetHandle: 'in',
      },
      {
        id: `edge-${action1Id}-${action2Id}`,
        source: action1Id,
        sourceHandle: 'out',
        target: action2Id,
        targetHandle: 'in',
      },
    ],
  };
}

/**
 * 构造任意深度链式蓝图：trigger → a1 → a2 → ... → aN（用于 7.3 深度截断 E2E）。
 *
 * - 节点位置按 300px 间距水平排布
 * - 边连接：trigger.out → a1.in, a1.out → a2.in, ..., a(N-1).out → aN.in
 * - 编译器 DFS 展开后，第 i 个 action 的 depth = i（trigger depth=0，直连 action depth=0）
 *   即 a1.depth=0, a2.depth=1, ..., a11.depth=10（被 MAX_TRIGGER_DEPTH=10 截断）
 */
export function buildDeepChainBlueprint(
  triggerId: string,
  triggerConfig: TriggerConfig,
  actions: Array<{ id: string; config: ActionConfig }>,
): EventBlueprint {
  const nodes: EventBlueprint['nodes'] = [
    { id: triggerId, kind: 'trigger', position: { x: 100, y: 200 }, config: triggerConfig },
    ...actions.map((a, i) => ({
      id: a.id,
      kind: 'action' as const,
      position: { x: 400 + i * 300, y: 200 },
      config: a.config as EventBlueprint['nodes'][number]['config'],
    })),
  ];

  const edges: EventBlueprint['edges'] = [];
  // trigger → a1
  edges.push({
    id: `edge-${triggerId}-${actions[0].id}`,
    source: triggerId,
    sourceHandle: 'out',
    target: actions[0].id,
    targetHandle: 'in',
  });
  // a_i → a_(i+1)
  for (let i = 0; i < actions.length - 1; i++) {
    edges.push({
      id: `edge-${actions[i].id}-${actions[i + 1].id}`,
      source: actions[i].id,
      sourceHandle: 'out',
      target: actions[i + 1].id,
      targetHandle: 'in',
    });
  }

  return { version: 1, nodes, edges };
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
